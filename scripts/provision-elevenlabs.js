import 'dotenv/config';
import { AGENT_NAME, buildAgentPayload, clientTools } from './elevenlabs-agent-config.js';

const API_ROOT = 'https://api.elevenlabs.io/v1/convai';

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`ElevenLabs ${method} ${path} failed (${response.status}): ${payload.detail?.message ?? payload.detail ?? payload.message ?? 'unknown error'}`);
  return payload;
}

async function provisionTools() {
  const existing = await request('/tools');
  const byName = new Map((existing.tools ?? []).map((tool) => [tool.tool_config?.name, tool]));
  const ids = [];
  for (const tool of clientTools) {
    const prior = byName.get(tool.tool_config.name);
    if (prior?.tool_config?.type !== 'client') throw new Error(`Existing tool ${tool.tool_config.name} is not a client tool.`);
    const result = prior
      ? await request(`/tools/${prior.id}`, { method: 'PATCH', body: tool })
      : await request('/tools', { method: 'POST', body: tool });
    ids.push(result.id);
  }
  return ids;
}

async function provisionAgent(toolIds) {
  const payload = buildAgentPayload(toolIds);
  const agents = await request(`/agents?search=${encodeURIComponent(AGENT_NAME)}&page_size=100`);
  const existing = (agents.agents ?? []).find((agent) => agent.name === AGENT_NAME && !agent.archived);
  return existing
    ? request(`/agents/${existing.agent_id}`, { method: 'PATCH', body: payload })
    : request('/agents/create', { method: 'POST', body: payload });
}

if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is not configured.');
const agent = await provisionAgent(await provisionTools());
console.log(`ElevenLabs agent configured: ${agent.agent_id}`);
console.log(`Set VITE_ELEVENLABS_AGENT_ID=${agent.agent_id} in .env and your host environment.`);
