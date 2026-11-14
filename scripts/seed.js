import 'dotenv/config';
import { getDb } from '../server/db.js';
import { createMemoryService } from '../server/memory.js';
import { seedFixtures } from './seed-fixtures.js';

const memoryService = createMemoryService();
const db = await getDb();
await seedFixtures({ db, memoryService });

console.log('Seeded fictional Tenant A and Tenant B memory records.');
