import { loadConfig } from './config.js';

const EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4-lite';
const DIMENSIONS = 1024;

function validateVector(vector) {
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(Number.isFinite)) {
    throw new Error(`Embedding provider returned an invalid ${DIMENSIONS}-dimension vector`);
  }
  return vector;
}

export async function embedText(text, inputType) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Embedding text is required');
  if (inputType !== 'document' && inputType !== 'query') throw new Error('Embedding input type is invalid');

  const { voyageApiKey } = loadConfig();
  if (!voyageApiKey) throw new Error('VOYAGE_API_KEY is not configured');

  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${voyageApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: MODEL,
      input_type: inputType,
      output_dimension: DIMENSIONS,
    }),
  });

  if (!response.ok) throw new Error(`Embedding provider request failed with status ${response.status}`);
  const payload = await response.json();
  return validateVector(payload.data?.[0]?.embedding);
}
