import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { getDb } from './db.js';
import { createServices } from './services.js';
import { createMongoSessionStore } from './sessions.js';

const app = createApp({
  config: loadConfig(),
  sessionStore: createMongoSessionStore(getDb),
  ...createServices(),
});
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`CallE API on http://localhost:${port}`));
