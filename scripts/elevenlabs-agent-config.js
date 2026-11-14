export const AGENT_NAME = 'CallE demo negotiation agent';

export const clientTools = [
  {
    tool_config: {
      type: 'client', name: 'get_authorized_field', expects_response: true,
      description: 'Request only a phone number or date of birth that the user authorized for this active negotiation run. Never request SIN, payment-card, or other fields.',
      parameters: {
        type: 'object', required: ['field'],
        properties: { field: { type: 'string', enum: ['phone', 'dob'], description: 'The authorized field needed for verification.' } },
      },
    },
  },
  {
    tool_config: {
      type: 'client', name: 'record_negotiation_action', expects_response: true,
      description: 'Record a concrete counteroffer before saying it. Cite only memory IDs supplied in this conversation.',
      parameters: {
        type: 'object', required: ['type', 'monthlyPrice', 'memoryIdsUsed'],
        properties: {
          type: { type: 'string', enum: ['counter_offer'], description: 'Always counter_offer for a proposed monthly price.' },
          monthlyPrice: { type: 'number', description: 'The proposed monthly price.' },
          memoryIdsUsed: { type: 'array', items: { type: 'string', description: 'A retrieved memory ID from this run.' }, description: 'Retrieved memory IDs used for this proposal.' },
        },
      },
    },
  },
  {
    tool_config: {
      type: 'client', name: 'report_outcome', expects_response: true,
      description: 'Report the structured negotiation result once the representative has clearly stated it. This does not accept, cancel, or change a contract.',
      parameters: {
        type: 'object', required: ['status'],
        properties: {
          status: { type: 'string', enum: ['offer_obtained', 'no_offer', 'verification_blocked'], description: 'The final negotiation status.' },
          monthlyPrice: { type: 'number', description: 'The obtained monthly price, required only when status is offer_obtained.' },
          durationMonths: { type: 'integer', description: 'The obtained offer duration in months, required only when status is offer_obtained.' },
        },
      },
    },
  },
];

export function isCompatibleExistingClientTool(tool) {
  return !tool || tool.tool_config?.type === 'client';
}

export function describeApiError(payload) {
  const detail = payload?.detail ?? payload?.message ?? payload;
  return typeof detail === 'string' ? detail : JSON.stringify(detail);
}

export function buildAgentPayload(toolIds) {
  return {
    name: AGENT_NAME,
    tags: ['calle', 'demo'],
    conversation_config: {
      agent: {
        language: 'en',
        first_message: 'Hello, I am CallE, an AI agent authorized to negotiate a service offer for a fictional customer. I would like to discuss the available options.',
        dynamic_variables: {
          dynamic_variable_placeholders: {
            run_id: 'demo-run', provider: 'DemoNet', goal: 'Lower the monthly price.', limits: '{"maxMonthlyPrice":80}', memories: '[]',
          },
        },
        prompt: {
          tool_ids: toolIds,
          built_in_tools: {
            end_call: {
              type: 'system', name: 'end_call', params: { system_tool_type: 'end_call' },
              description: 'End the call once a final outcome has been reported, or when no agreement is reachable. Give a brief polite goodbye as the message.',
            },
          },
          prompt: `You are CallE, an AI agent conducting a browser role-play with a teammate acting as a fictional service-provider representative. Identify yourself as an AI agent. Your goal is {{goal}} with these limits: {{limits}}. The only verified prior offers available to you are {{memories}}.

Use a verified retrieved offer only when it is present in {{memories}}. Never invent prior offers or leverage. Before speaking a counteroffer, call record_negotiation_action with type counter_offer, the exact monthly price, and only IDs from the supplied memories. If the representative requests verification, call get_authorized_field only for phone or dob and wait for its result. If it denies access, request an alternate method; never request or disclose SIN, payment-card details, or any other field. Never cancel or claim to change a contract beyond the offer. When the conversation ends, call report_outcome with offer_obtained, no_offer, or verification_blocked.

Close the deal: when the representative offers a price at or below the user goal, do not just thank them. Repeat the exact monthly price and duration back, say clearly that you accept the offer on the user's behalf, and ask the representative to confirm it is applied. Only after they confirm, call report_outcome with offer_obtained, then call end_call.

Know when to walk away: make at most three counteroffers within your limits. If the representative will not go to or below your limit after that, refuses to move, or verification is blocked, do not keep talking. Say one brief, polite closing line, call report_outcome with no_offer (or verification_blocked), then call end_call. Also call end_call after reporting an offer_obtained outcome. After reporting an outcome, do not keep talking.`,
        },
      },
    },
  };
}
