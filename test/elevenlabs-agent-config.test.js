import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentPayload, clientTools } from '../scripts/elevenlabs-agent-config.js';

test('CallE agent config exposes the three browser client tools and trusted dynamic variables', () => {
  assert.deepEqual(clientTools.map((tool) => tool.tool_config.name), [
    'get_authorized_field',
    'record_negotiation_action',
    'report_outcome',
  ]);
  assert.ok(clientTools.every((tool) => tool.tool_config.type === 'client' && tool.tool_config.expects_response));

  const payload = buildAgentPayload(['tool-field', 'tool-action', 'tool-outcome']);
  assert.deepEqual(payload.conversation_config.agent.prompt.tool_ids, ['tool-field', 'tool-action', 'tool-outcome']);
  assert.equal(payload.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.run_id, 'demo-run');
  assert.match(payload.conversation_config.agent.prompt.prompt, /Never accept, cancel, or claim to change a contract/);
});
