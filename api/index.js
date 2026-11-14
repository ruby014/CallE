import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { getDb } from '../server/db.js';
import { createMongoSessionStore } from '../server/sessions.js';

export default createApp({ config: loadConfig(), sessionStore: createMongoSessionStore(getDb) });
