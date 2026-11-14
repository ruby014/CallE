import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const eleven = vi.hoisted(() => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
  status: 'disconnected',
  tools: new Map(),
}));

vi.mock('@elevenlabs/react', () => ({
  ConversationProvider: ({ children }) => children,
  useConversationControls: () => ({
    startSession: eleven.startSession,
    endSession: eleven.endSession,
  }),
  useConversationStatus: () => ({ status: eleven.status }),
  useConversationClientTool: (name, handler) => eleven.tools.set(name, handler),
}));

import VoiceSession from './VoiceSession.jsx';

const context = {
  runId: 'run-a',
  provider: 'DemoNet',
  goal: 'Lower the monthly price.',
  limits: { maxMonthlyPrice: 80 },
  memories: [],
};

const originalMediaDevices = navigator.mediaDevices;

beforeEach(() => {
  eleven.startSession.mockReset();
  eleven.endSession.mockReset();
  eleven.tools.clear();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  });
});

describe('VoiceSession', () => {
  it('shows an alert and does not report an outcome when microphone access is denied', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    const onOutcome = vi.fn();

    render(<VoiceSession agentId="agent-test" context={context} onOutcome={onOutcome} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice session' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Microphone access is required');
    expect(eleven.startSession).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('shows an alert and does not report an outcome when session start fails', async () => {
    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop: vi.fn() }] });
    eleven.startSession.mockRejectedValueOnce(new Error('Connection failed'));
    const onOutcome = vi.fn();

    render(<VoiceSession agentId="agent-test" context={context} onOutcome={onOutcome} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice session' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Unable to start the voice session');
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('shows an alert when the SDK reports an asynchronous session error', async () => {
    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop: vi.fn() }] });
    eleven.startSession.mockImplementationOnce(({ onError }) => onError(new Error('Connection failed')));
    const onOutcome = vi.fn();

    render(<VoiceSession agentId="agent-test" context={context} onOutcome={onOutcome} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice session' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Unable to start the voice session');
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('binds each agent tool to the active run context', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ allowed: false }) }));
    render(<VoiceSession agentId="agent-test" context={context} />);

    expect([...eleven.tools.keys()]).toEqual(expect.arrayContaining([
      'get_authorized_field', 'record_negotiation_action', 'report_outcome',
    ]));
    await eleven.tools.get('get_authorized_field')({ field: 'phone' });
    expect(global.fetch).toHaveBeenCalledWith('/api/runs/run-a/field', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ field: 'phone' }), credentials: 'same-origin',
    }));
  });
});
