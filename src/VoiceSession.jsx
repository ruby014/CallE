import {
  ConversationProvider,
  useConversationClientTool,
  useConversationControls,
  useConversationStatus,
} from '@elevenlabs/react';
import { useState } from 'react';
import { apiFetch } from './api.js';

function serializeToolResult(value) {
  return JSON.stringify(value);
}

function VoiceSessionControls({ agentId, context, onAction, onOutcome, onFieldRequest, onError }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState('');

  useConversationClientTool('get_authorized_field', async ({ field }) => {
    try {
      const result = await apiFetch(`/api/runs/${context.runId}/field`, {
        method: 'POST',
        body: { field },
      });
      onFieldRequest?.(result);
      return serializeToolResult(result);
    } catch (cause) {
      onError?.(cause);
      throw cause;
    }
  });

  useConversationClientTool('record_negotiation_action', async (action) => {
    try {
      const result = await apiFetch(`/api/runs/${context.runId}/actions`, {
        method: 'POST',
        body: action,
      });
      onAction?.(action);
      return serializeToolResult(result);
    } catch (cause) {
      onError?.(cause);
      throw cause;
    }
  });

  useConversationClientTool('report_outcome', async (outcome) => {
    try {
      const result = await apiFetch(`/api/runs/${context.runId}/complete`, {
        method: 'POST',
        body: outcome,
      });
      onOutcome?.(result);
      return serializeToolResult(result);
    } catch (cause) {
      onError?.(cause);
      throw cause;
    }
  });

  async function start() {
    setError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      setError('Microphone access is required to start the voice session.');
      onError?.(cause);
      return;
    }

    try {
      stream.getTracks().forEach((track) => track.stop());
      await startSession({
        agentId,
        dynamicVariables: {
          run_id: context.runId,
          customer_name: context.customerName || 'the customer',
          provider: context.provider,
          goal: context.goal,
          limits: JSON.stringify(context.limits),
          memories: JSON.stringify(context.memories),
        },
        onError: (cause) => {
          setError('Unable to start the voice session.');
          onError?.(cause);
        },
      });
    } catch (cause) {
      setError('Unable to start the voice session.');
      onError?.(cause);
    }
  }

  return (
    <section className="voice-session" aria-label="Voice session">
      <p>Voice status: {status}</p>
      {error && <p role="alert">{error}</p>}
      {status === 'connected' ? (
        <button type="button" onClick={() => endSession()}>End voice session</button>
      ) : (
        <button type="button" onClick={start} disabled={status === 'connecting'}>Start voice session</button>
      )}
    </section>
  );
}

export default function VoiceSession(props) {
  return (
    <ConversationProvider>
      <VoiceSessionControls {...props} />
    </ConversationProvider>
  );
}
