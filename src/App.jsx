import { useEffect, useState } from 'react';
import VoiceSession from './VoiceSession.jsx';
import { apiFetch } from './api.js';

const DEFAULT_RUN = { provider: 'DemoNet', goal: '', maxMonthlyPrice: 80, recipientEmail: 'demo@example.test', useMemory: true, phone: false, dob: false };
const readableError = (error) => error instanceof Error ? error.message : 'Something went wrong.';

export default function App({ agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID }) {
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [form, setForm] = useState(DEFAULT_RUN);
  const [context, setContext] = useState(null);
  const [memories, setMemories] = useState([]);
  const [editingMemory, setEditingMemory] = useState(null);
  const [actions, setActions] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => { apiFetch('/api/session').then((data) => setUser(data.user)).catch(() => {}); }, []);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function login(event) {
    event.preventDefault();
    setLoginError('');
    try { setUser((await apiFetch('/api/session', { method: 'POST', body: { pin } })).user); } catch { setLoginError('Invalid PIN'); }
  }

  async function startRun(event) {
    event.preventDefault();
    setError(''); setStarting(true); setContext(null); setActions([]); setOutcome(null);
    try {
      setContext(await apiFetch('/api/runs', { method: 'POST', body: {
        provider: form.provider, goal: form.goal, limits: { maxMonthlyPrice: Number(form.maxMonthlyPrice) },
        useMemory: form.useMemory, permissions: { phone: form.phone, dob: form.dob }, recipientEmail: form.recipientEmail,
      } }));
    } catch (cause) { setError(`Unable to prepare negotiation: ${readableError(cause)}`); } finally { setStarting(false); }
  }

  async function refreshMemories() {
    try { setMemories(await apiFetch('/api/memories')); } catch (cause) { setError(`Unable to load memories: ${readableError(cause)}`); }
  }
  async function forgetMemory(id) {
    try { await apiFetch(`/api/memories/${id}`, { method: 'DELETE' }); await refreshMemories(); } catch (cause) { setError(`Unable to forget memory: ${readableError(cause)}`); }
  }
  async function correctMemory(event) {
    event.preventDefault();
    try {
      await apiFetch(`/api/memories/${editingMemory.id}`, { method: 'PATCH', body: {
        content: editingMemory.content,
        source: editingMemory.source,
        expiresAt: editingMemory.expiresAt,
      } });
      setEditingMemory(null);
      await refreshMemories();
    } catch (cause) { setError(`Unable to correct memory: ${readableError(cause)}`); }
  }
  useEffect(() => { if (user) refreshMemories(); }, [user]);

  if (!user) return <main className="app-shell"><h1>CallE</h1><form className="panel" onSubmit={login}>
    <label htmlFor="demo-pin">Demo PIN</label><input id="demo-pin" type="password" value={pin} onChange={(event) => setPin(event.target.value)} />
    <button type="submit">Enter</button>{loginError && <p role="alert">{loginError}</p>}
  </form></main>;

  return <main className="app-shell">
    <header><h1>CallE</h1><p>Signed in as {user}</p></header>
    <form className="panel run-form" onSubmit={startRun}>
      <h2>Prepare negotiation</h2>
      <label htmlFor="provider">Provider</label><input id="provider" value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} required />
      <label htmlFor="goal">Goal</label><input id="goal" value={form.goal} onChange={(event) => updateForm('goal', event.target.value)} required />
      <label htmlFor="maximum-price">Maximum monthly price</label><input id="maximum-price" type="number" min="1" value={form.maxMonthlyPrice} onChange={(event) => updateForm('maxMonthlyPrice', event.target.value)} required />
      <label htmlFor="recipient-email">Result email</label><input id="recipient-email" type="email" value={form.recipientEmail} onChange={(event) => updateForm('recipientEmail', event.target.value)} required />
      <label><input type="checkbox" checked={form.useMemory} onChange={(event) => updateForm('useMemory', event.target.checked)} /> Use prior eligible memories</label>
      <fieldset><legend>Authorize for this call only</legend>
        <label><input type="checkbox" checked={form.phone} onChange={(event) => updateForm('phone', event.target.checked)} /> Synthetic phone number</label>
        <label><input type="checkbox" checked={form.dob} onChange={(event) => updateForm('dob', event.target.checked)} /> Synthetic date of birth</label>
      </fieldset>
      <button type="submit" disabled={starting}>{starting ? 'Preparing…' : 'Start negotiation'}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="panel" aria-labelledby="memory-heading"><h2 id="memory-heading">Saved memories</h2>
      {memories.length ? <ul>{memories.map((memory) => <li key={memory.id}><span>{memory.content}</span>{' '}
        <button type="button" onClick={() => setEditingMemory({ ...memory, expiresAt: memory.expiresAt ? new Date(memory.expiresAt).toISOString().slice(0, 10) : '' })}>Correct</button>{' '}
        <button type="button" onClick={() => forgetMemory(memory.id)}>Forget</button></li>)}</ul> : <p>No active memories saved.</p>}
      {editingMemory && <form onSubmit={correctMemory}>
        <h3>Correct memory</h3>
        <label htmlFor="memory-content">Memory</label><input id="memory-content" value={editingMemory.content} onChange={(event) => setEditingMemory((memory) => ({ ...memory, content: event.target.value }))} required />
        <label htmlFor="memory-source">Source</label><input id="memory-source" value={editingMemory.source} onChange={(event) => setEditingMemory((memory) => ({ ...memory, source: event.target.value }))} required />
        <label htmlFor="memory-expiry">Expires</label><input id="memory-expiry" type="date" value={editingMemory.expiresAt} onChange={(event) => setEditingMemory((memory) => ({ ...memory, expiresAt: event.target.value }))} required />
        <button type="submit">Save correction</button> <button type="button" onClick={() => setEditingMemory(null)}>Cancel</button>
      </form>}
    </section>
    {context && <>
      <section className="panel" aria-labelledby="retrieved-heading"><h2 id="retrieved-heading">Retrieved for this run</h2>
        {context.memories.length ? <ul>{context.memories.map((memory) => <li key={memory.id}>{memory.content} <small>({memory.source})</small></li>)}</ul> : <p>No eligible memories retrieved.</p>}
      </section>
      {agentId ? <VoiceSession agentId={agentId} context={context} onAction={(action) => setActions((current) => [...current, action])} onFieldRequest={(field) => setActions((current) => [...current, { type: 'field_request', ...field }])} onOutcome={setOutcome} onError={(cause) => setError(readableError(cause))} /> : <p className="error" role="alert">Voice is not configured. Set VITE_ELEVENLABS_AGENT_ID to the public ElevenLabs agent ID.</p>}
      <section className="panel" aria-labelledby="trace-heading"><h2 id="trace-heading">Run trace</h2>
        {actions.length ? <pre>{JSON.stringify(actions, null, 2)}</pre> : <p>No agent actions recorded yet.</p>}
        {outcome && <><h3>Outcome and email</h3><pre>{JSON.stringify(outcome, null, 2)}</pre></>}
      </section>
    </>}
  </main>;
}
