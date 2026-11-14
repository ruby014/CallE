import 'dotenv/config';
import { getDb } from '../server/db.js';

try {
  const db = await getDb();
  await db.command({ ping: 1 });
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  console.log(`Atlas OK: db "${db.databaseName}", collections: ${collections.join(', ') || '(none)'}`);
  process.exit(0);
} catch (err) {
  console.error(`Atlas connection FAILED: ${err.message}`);
  process.exit(1);
}
