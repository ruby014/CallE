import { getDb } from './db.js';
import { createMemoryService } from './memory.js';
import { createMongoRunStore, createRunService } from './runs.js';

export function createServices() {
  const memory = createMemoryService();
  const withDb = (fn) => async (...args) => fn(await getDb(), ...args);

  const activeFilter = (principal, now) => ({
    tenantId: principal.tenantId,
    allowedReaderIds: principal.userId,
    status: 'active',
    expiresAt: { $gt: now },
  });
  const publicShape = ({ _id, embedding: _e, ...rest }) => ({ id: _id, ...rest });

  const memories = {
    async list(principal) {
      const db = await getDb();
      const docs = await db.collection('memories').find(activeFilter(principal, new Date())).sort({ createdAt: -1 }).toArray();
      return docs.map(publicShape);
    },
    save: async (principal, input) => publicShape(await memory.saveMemory(await getDb(), principal, input)),
    correct: async (principal, id, input) => publicShape(await memory.correctMemory(await getDb(), principal, id, input)),
    forget: async (principal, id) => memory.forgetMemory(await getDb(), principal, id),
  };

  const runs = createRunService({
    store: createMongoRunStore(getDb),
    retrieveMemories: async (principal, query, now) =>
      (await memory.retrieveMemories(await getDb(), principal, query, now)).map(publicShape),
    getActiveMemoryIds: async (principal, ids, now) => {
      const db = await getDb();
      const docs = await db.collection('memories')
        .find({ _id: { $in: ids }, ...activeFilter(principal, now) }, { projection: { _id: 1 } })
        .toArray();
      return new Set(docs.map((d) => d._id));
    },
    saveMemory: memories.save,
  });

  return { memories, runs };
}
