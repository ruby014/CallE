import assert from 'node:assert/strict';
import test from 'node:test';
import { seedFixtures, SEED_SOURCE } from '../scripts/seed-fixtures.js';

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.includes(document[key]);
    return document[key] === expected;
  });
}

function createDb(documents) {
  const state = { documents: [...documents] };
  return {
    state,
    collection(name) {
      assert.equal(name, 'memories');
      return {
        async deleteMany(filter) {
          state.documents = state.documents.filter((document) => !matches(document, filter));
        },
      };
    },
  };
}

function createMemoryService() {
  let sequence = 0;
  return {
    async saveMemory(db, principal, input) {
      const record = {
        _id: `fixture-${sequence += 1}`,
        tenantId: principal.tenantId,
        ownerId: principal.userId,
        status: 'active',
        ...input,
      };
      db.state.documents.push(record);
      return record;
    },
    async correctMemory(db, principal, id, input) {
      const original = db.state.documents.find((document) => document._id === id);
      original.status = 'superseded';
      return this.saveMemory(db, principal, input);
    },
  };
}

test('seed reset removes only prior CallE fixtures for the fixed demo tenants', async () => {
  const db = createDb([
    { _id: 'old-a', tenantId: 'tenant-a', source: SEED_SOURCE },
    { _id: 'shared-a', tenantId: 'tenant-a', source: 'another-demo' },
    { _id: 'other-tenant', tenantId: 'tenant-c', source: SEED_SOURCE },
  ]);

  await seedFixtures({ db, memoryService: createMemoryService() });

  assert.equal(db.state.documents.some((document) => document._id === 'old-a'), false);
  assert.equal(db.state.documents.some((document) => document._id === 'shared-a'), true);
  assert.equal(db.state.documents.some((document) => document._id === 'other-tenant'), true);
  assert.equal(
    db.state.documents.filter((document) => document.source === SEED_SOURCE && ['tenant-a', 'tenant-b'].includes(document.tenantId)).length,
    5,
  );
});
