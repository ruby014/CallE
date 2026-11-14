export function loadConfig(env = process.env) {
  const pins = new Map();
  if (env.DEMO_PIN_A) pins.set(env.DEMO_PIN_A, 'A');
  if (env.DEMO_PIN_B) pins.set(env.DEMO_PIN_B, 'B');
  return {
    pins,
    mongoUri: env.MONGODB_URI,
    dbName: env.MONGODB_DB || 'calle',
    vectorIndexName: env.VECTOR_INDEX_NAME || 'memory_vector_index',
    voyageApiKey: env.VOYAGE_API_KEY,
  };
}
