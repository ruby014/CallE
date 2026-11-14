import crypto from 'node:crypto';

export const COOKIE_NAME = 'calle_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const PRINCIPALS = {
  A: {
    tenantId: 'tenant-a',
    userId: 'user-a',
    label: 'Alex Morgan (Tenant A)',
    profile: { phone: '555-0100', dob: '1990-01-01' },
  },
  B: {
    tenantId: 'tenant-b',
    userId: 'user-b',
    label: 'Jordan Lee (Tenant B)',
    profile: { phone: '555-0199', dob: '1985-05-05' },
  },
};

export function principalForSlot(slot) {
  return PRINCIPALS[slot] ?? null;
}

export function createMemorySessionStore() {
  const sessions = new Map();
  return {
    async create(principal) {
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, { principal, expiresAt: Date.now() + SESSION_TTL_MS });
      return id;
    },
    async get(id) {
      const s = sessions.get(id);
      return s && s.expiresAt > Date.now() ? s.principal : null;
    },
  };
}

// Sessions live in Atlas so Vercel cold starts and parallel instances share them.
export function createMongoSessionStore(getDb) {
  return {
    async create(principal) {
      const id = crypto.randomBytes(32).toString('hex');
      const db = await getDb();
      await db.collection('sessions').insertOne({
        _id: id,
        principal,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      return id;
    },
    async get(id) {
      const db = await getDb();
      const doc = await db.collection('sessions').findOne({ _id: id, expiresAt: { $gt: new Date() } });
      return doc ? doc.principal : null;
    },
  };
}

export async function resolveSession(sessionStore, cookieValue) {
  if (typeof cookieValue !== 'string' || !cookieValue) return null;
  return sessionStore.get(cookieValue);
}
