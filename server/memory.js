import crypto from 'node:crypto';
import { loadConfig } from './config.js';
import { embedText as voyageEmbedText } from './embeddings.js';

const COLLECTION = 'memories';
const VECTOR_DIMENSIONS = 1024;

function withoutEmbedding(memory) {
  const { embedding: _embedding, ...result } = memory;
  return result;
}

function assertVector(vector) {
  if (!Array.isArray(vector) || vector.length !== VECTOR_DIMENSIONS || !vector.every(Number.isFinite)) {
    throw new Error(`Embedding failed: expected a ${VECTOR_DIMENSIONS}-dimension numeric vector`);
  }
  return vector;
}

function memoryFilter(principal, now) {
  return {
    tenantId: principal.tenantId,
    allowedReaderIds: principal.userId,
    status: 'active',
    expiresAt: { $gt: now },
  };
}

function ownerFilter(principal, id) {
  return { _id: id, tenantId: principal.tenantId, ownerId: principal.userId, status: 'active' };
}

function createRecord({ id, principal, input, embedding, now, version, supersedesId }) {
  return {
    _id: id,
    tenantId: principal.tenantId,
    ownerId: principal.userId,
    allowedReaderIds: [principal.userId],
    content: input.content,
    source: input.source,
    status: 'active',
    version,
    supersedesId,
    createdAt: now,
    expiresAt: input.expiresAt,
    embedding,
  };
}

function assertMemoryInput(input) {
  if (!input || typeof input.content !== 'string' || !input.content.trim()) throw new Error('Memory content is required');
  if (typeof input.source !== 'string' || !input.source.trim()) throw new Error('Memory source is required');
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.valueOf())) throw new Error('Memory expiry is required');
}

export function createMemoryService({
  embedText = voyageEmbedText,
  now = () => new Date(),
  newId = crypto.randomUUID,
  vectorIndexName = loadConfig().vectorIndexName,
} = {}) {
  async function getEmbedding(text, inputType) {
    try {
      return assertVector(await embedText(text, inputType));
    } catch (error) {
      throw new Error(`Embedding failed: ${error.message}`);
    }
  }

  return {
    async retrieveMemories(db, principal, query, retrievalTime = now()) {
      const embedding = await getEmbedding(query, 'query');
      const filter = memoryFilter(principal, retrievalTime);
      const candidates = await db.collection(COLLECTION).aggregate([
        {
          $vectorSearch: {
            index: vectorIndexName,
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 100,
            limit: 10,
            filter,
          },
        },
      ]).toArray();

      const memories = [];
      for (const candidate of candidates) {
        const current = await db.collection(COLLECTION).findOne({ _id: candidate._id, ...filter });
        if (current) memories.push(withoutEmbedding(current));
      }
      return memories;
    },

    async saveMemory(db, principal, input) {
      assertMemoryInput(input);
      const embedding = await getEmbedding(input.content, 'document');
      const record = createRecord({
        id: newId(),
        principal,
        input,
        embedding,
        now: now(),
        version: 1,
        supersedesId: null,
      });
      await db.collection(COLLECTION).insertOne(record);
      return withoutEmbedding(record);
    },

    async correctMemory(db, principal, id, input) {
      assertMemoryInput(input);
      const collection = db.collection(COLLECTION);
      const session = db.client?.startSession();
      if (!session) throw new Error('MongoDB session support is required for memory corrections');

      let corrected;
      try {
        await session.withTransaction(async () => {
          const original = await collection.findOne(ownerFilter(principal, id), { session });
          if (!original) throw new Error('Memory not found');
          const embedding = await getEmbedding(input.content, 'document');
          const replacement = createRecord({
            id: newId(),
            principal,
            input,
            embedding,
            now: now(),
            version: original.version + 1,
            supersedesId: original._id,
          });
          await collection.insertOne(replacement, { session });
          const update = await collection.updateOne(ownerFilter(principal, id), { $set: { status: 'superseded' } }, { session });
          if (update.matchedCount !== 1) throw new Error('Memory not found');
          corrected = withoutEmbedding(replacement);
        });
      } finally {
        await session.endSession();
      }
      return corrected;
    },

    async forgetMemory(db, principal, id) {
      const result = await db.collection(COLLECTION).deleteOne(ownerFilter(principal, id));
      if (result.deletedCount !== 1) throw new Error('Memory not found');
    },
  };
}

const defaultService = createMemoryService();

export const retrieveMemories = defaultService.retrieveMemories;
export const saveMemory = defaultService.saveMemory;
export const correctMemory = defaultService.correctMemory;
export const forgetMemory = defaultService.forgetMemory;
