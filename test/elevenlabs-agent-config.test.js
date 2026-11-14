import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentPayload, clientTools, describeApiError, isCompatibleExistingClientTool } from '../scripts/elevenlabs-agent-config.js';

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
  assert.match(payload.conversation_config.agent.prompt.prompt, /Never cancel or claim to change a contract beyond the offer/);
});

test('a missing client tool is eligible for creation', () => {
  assert.equal(isCompatibleExistingClientTool(undefined), true);
  assert.equal(isCompatibleExistingClientTool({ tool_config: { type: 'client' } }), true);
  assert.equal(isCompatibleExistingClientTool({ tool_config: { type: 'webhook' } }), false);
});

test('API validation details remain readable', () => {
  assert.equal(describeApiError({ detail: [{ loc: ['body', 'tool_config'], msg: 'invalid value' }] }), '[{"loc":["body","tool_config"],"msg":"invalid value"}]');
});

test('client tool parameter leaves describe the values the agent must supply', () => {
  const action = clientTools.find((tool) => tool.tool_config.name === 'record_negotiation_action').tool_config.parameters;
  assert.ok(action.properties.type.description);
  assert.ok(action.properties.monthlyPrice.description);
  assert.ok(action.properties.memoryIdsUsed.items.description);

  const outcome = clientTools.find((tool) => tool.tool_config.name === 'report_outcome').tool_config.parameters;
  assert.ok(outcome.properties.status.description);
  assert.ok(outcome.properties.monthlyPrice.description);
  assert.ok(outcome.properties.durationMonths.description);
});

test('CallE agent can hang up: end_call system tool plus a no-deal exit rule', () => {
  const { prompt } = buildAgentPayload([]).conversation_config.agent;
  assert.equal(prompt.built_in_tools.end_call.type, 'system');
  assert.equal(prompt.built_in_tools.end_call.params.system_tool_type, 'end_call');
  assert.match(prompt.prompt, /report_outcome[^.]*then call end_call/i);
  assert.match(prompt.prompt, /do not keep talking/i);
  assert.match(prompt.prompt, /accept the offer on the user's behalf/i);
});

test('agent speaks for the named customer, not a fictional one', () => {
  const { prompt, first_message: first } = buildAgentPayload([]).conversation_config.agent;
  assert.match(first, /\{\{customer_name\}\}/);
  assert.match(prompt.prompt, /\{\{customer_name\}\}/);
  assert.doesNotMatch(first, /fictional/i);
});
