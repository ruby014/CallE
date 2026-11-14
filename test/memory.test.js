import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryService } from '../server/memory.js';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const VECTOR = Array.from({ length: 1024 }, () => 0.25);
const PRINCIPAL_A = { tenantId: 'tenant-a', userId: 'user-a' };
const PRINCIPAL_B = { tenantId: 'tenant-b', userId: 'user-b' };

function memory(overrides = {}) {
  return {
    _id: crypto.randomUUID(),
    tenantId: 'tenant-a',
    ownerId: 'user-a',
    allowedReaderIds: ['user-a'],
    content: 'Prior offer was $75 per month.',
    source: 'seeded-demo',
    status: 'active',
    version: 1,
    supersedesId: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    embedding: VECTOR,
    ...overrides,
  };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      return actual > expected.$gt;
    }
    return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
  });
}

function createDb(documents, vectorCandidates = documents) {
  const state = { documents: [...documents], aggregatePipeline: null };
  const collection = {
    aggregate(pipeline) {
      state.aggregatePipeline = pipeline;
      return { toArray: async () => vectorCandidates.map((document) => ({ ...document })) };
    },
    async findOne(filter) {
      return state.documents.find((document) => matches(document, filter)) ?? null;
    },
    async insertOne(document) {
      state.documents.push({ ...document });
      return { insertedId: document._id };
    },
    async updateOne(filter, update) {
      const document = state.documents.find((candidate) => matches(candidate, filter));
      if (!document) return { matchedCount: 0 };
      Object.assign(document, update.$set);
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      const index = state.documents.findIndex((document) => matches(document, filter));
      if (index === -1) return { deletedCount: 0 };
      state.documents.splice(index, 1);
      return { deletedCount: 1 };
    },
  };

  return {
    state,
    collection(name) {
      assert.equal(name, 'memories');
      return collection;
    },
    client: {
      startSession() {
        return {
          async withTransaction(work) {
            return work();
          },
          async endSession() {},
        };
      },
    },
  };
}

function createService(embedText = async () => VECTOR) {
  return createMemoryService({ embedText, now: () => NOW, newId: () => 'new-memory-id' });
}

test('retrieval returns only the principal active unexpired memory after a stale vector result', async () => {
  const activeA = memory({ _id: 'active-A' });
  const foreignTenant = memory({ _id: 'tenant-B', tenantId: 'tenant-b', ownerId: 'user-b', allowedReaderIds: ['user-b'] });
  const unreadable = memory({ _id: 'unreadable-A', allowedReaderIds: ['user-other'] });
  const expiredAtBoundary = memory({ _id: 'expired-A', expiresAt: NOW });
  const staleCandidate = memory({ _id: 'deleted-A' });
  const db = createDb([activeA, foreignTenant, unreadable, expiredAtBoundary], [activeA, foreignTenant, unreadable, expiredAtBoundary, staleCandidate]);

  const result = await createService().retrieveMemories(db, PRINCIPAL_A, 'lower my bill', NOW);

  assert.deepEqual(result.map((document) => document._id), ['active-A']);
  assert.equal(db.state.aggregatePipeline[0].$vectorSearch.filter.tenantId, 'tenant-a');
  assert.equal(db.state.aggregatePipeline[0].$vectorSearch.filter.status, 'active');
  assert.deepEqual(db.state.aggregatePipeline[0].$vectorSearch.filter.allowedReaderIds, 'user-a');
  assert.deepEqual(db.state.aggregatePipeline[0].$vectorSearch.filter.expiresAt, { $gt: NOW });
});

test('retrieval rejects when query embedding fails', async () => {
  const db = createDb([]);

  await assert.rejects(
    () => createService(async () => { throw new Error('provider unavailable'); }).retrieveMemories(db, PRINCIPAL_A, 'lower my bill', NOW),
    /embedding/i,
  );
});

test('save memory derives tenant and owner and creates a document embedding', async () => {
  const db = createDb([]);
  const calls = [];
  const saved = await createService(async (text, inputType) => {
    calls.push({ text, inputType });
    return VECTOR;
  }).saveMemory(db, PRINCIPAL_A, {
    content: 'Representative offered $75 per month.',
    source: 'user-approved',
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    tenantId: 'forged-tenant',
    ownerId: 'forged-owner',
  });

  assert.equal(saved._id, 'new-memory-id');
  assert.equal(saved.tenantId, 'tenant-a');
  assert.equal(saved.ownerId, 'user-a');
  assert.deepEqual(saved.allowedReaderIds, ['user-a']);
  assert.equal(saved.status, 'active');
  assert.equal(saved.version, 1);
  assert.deepEqual(calls, [{ text: 'Representative offered $75 per month.', inputType: 'document' }]);
});

test('a foreign tenant cannot correct another tenant memory', async () => {
  const db = createDb([memory({ _id: 'memory-A' })]);

  await assert.rejects(
    () => createService().correctMemory(db, PRINCIPAL_B, 'memory-A', {
      content: 'Corrected offer.',
      source: 'user-correction',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    }),
    /not found/i,
  );
});

test('correction creates a new active version and supersedes the prior version', async () => {
  const original = memory({ _id: 'memory-A', version: 2 });
  const db = createDb([original]);

  const corrected = await createService().correctMemory(db, PRINCIPAL_A, 'memory-A', {
    content: 'Corrected offer was $80 per month.',
    source: 'user-correction',
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
  });

  assert.equal(corrected._id, 'new-memory-id');
  assert.equal(corrected.version, 3);
  assert.equal(corrected.supersedesId, 'memory-A');
  assert.equal(corrected.status, 'active');
  assert.equal(db.state.documents.find((document) => document._id === 'memory-A').status, 'superseded');
});

test('forgetting a memory removes its document and embedding', async () => {
  const db = createDb([memory({ _id: 'memory-A' })]);

  await createService().forgetMemory(db, PRINCIPAL_A, 'memory-A');

  assert.equal(db.state.documents.length, 0);
});
