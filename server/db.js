import { MongoClient } from 'mongodb';
import { loadConfig } from './config.js';

// Cached on globalThis so warm Vercel invocations reuse one connection pool.
export function getDb() {
  const cfg = loadConfig();
  if (!cfg.mongoUri) throw new Error('MONGODB_URI is not configured');
  globalThis.__calleMongo ??= new MongoClient(cfg.mongoUri, { maxPoolSize: 5 }).connect();
  return globalThis.__calleMongo.then((client) => client.db(cfg.dbName));
}
