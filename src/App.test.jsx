import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./VoiceSession.jsx', () => ({
  default: ({ context }) => <p data-testid="voice-session">Voice run: {context.runId}</p>,
}));

import App from './App.jsx';

beforeEach(() => {
  global.fetch = vi.fn((path, options) => {
    if (path === '/api/session' && options?.method !== 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ user: 'Tenant A' }) });
    }
    if (path === '/api/runs') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          runId: 'run-a', provider: 'DemoNet', goal: 'Lower the price', limits: { maxMonthlyPrice: 80 },
          memories: [{ id: 'memory-a', content: 'Prior offer was $75.', source: 'demo', expiresAt: null }],
        }),
      });
    }
    if (path === '/api/memories') return Promise.resolve({ ok: true, json: async () => [] });
    throw new Error(`Unexpected fetch: ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('creates a fresh run and presents only its retrieved memories to the voice session', async () => {
    render(<App agentId="agent-test" />);
    await screen.findByText('Signed in as Tenant A');

    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Lower the price' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start negotiation' }));

    await screen.findByTestId('voice-session');
    expect(screen.getByText('Prior offer was $75.')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith('/api/runs', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({
        provider: 'DemoNet',
        goal: 'Lower the price',
        limits: { maxMonthlyPrice: 80 },
        useMemory: true,
        permissions: { phone: false, dob: false },
        recipientEmail: 'demo@example.test',
      }),
    }));
  });

  it('sends a correction with the required source and expiry', async () => {
    global.fetch.mockImplementation((path, options) => {
      if (path === '/api/session') return Promise.resolve({ ok: true, json: async () => ({ user: 'Tenant A' }) });
      if (path === '/api/memories' && options?.method !== 'PATCH') return Promise.resolve({ ok: true, json: async () => ([{
        id: 'memory-a', content: 'Prior offer was $75.', source: 'seed', expiresAt: '2030-01-01T00:00:00.000Z',
      }]) });
      if (path === '/api/memories/memory-a' && options?.method === 'PATCH') return Promise.resolve({ ok: true, json: async () => ({}) });
      throw new Error(`Unexpected fetch: ${path}`);
    });
    render(<App agentId="agent-test" />);
    await screen.findByRole('button', { name: 'Correct' });
    fireEvent.click(screen.getByRole('button', { name: 'Correct' }));
    fireEvent.change(screen.getByLabelText('Memory'), { target: { value: 'Prior offer was $80.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/memories/memory-a', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ content: 'Prior offer was $80.', source: 'seed', expiresAt: '2030-01-01' }),
    })));
  });
});
