import { useEffect, useState } from 'react';
import VoiceSession from './VoiceSession.jsx';
import { apiFetch } from './api.js';

const DEFAULT_RUN = { provider: 'DemoNet', goal: '', maxMonthlyPrice: 80, recipientEmail: 'demo@example.test', useMemory: true, phone: false, dob: false };
const readableError = (error) => error instanceof Error ? error.message : 'Something went wrong.';
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'no expiry';

function Trace({ actions, outcome, onSaveOffer, saved }) {
  const run = outcome?.run;
  const email = outcome?.email;
  return (
    <section className="card" aria-labelledby="trace-heading">
      <h2 id="trace-heading">Run trace</h2>
      {actions.length ? (
        <ul className="timeline">
          {actions.map((action, index) => (
            <li key={index}>
              {action.type === 'counter_offer' && <>
                <strong>Counter-offer ${action.monthlyPrice}/month</strong>
                <span className="muted">
                  {action.memoryIdsUsed?.length ? `cites ${action.memoryIdsUsed.length} memory (agent-reported)` : 'no memory cited'}
                </span>
              </>}
              {action.type === 'field_request' && <>
                <strong>Verification field requested</strong>
                <span className={action.allowed ? 'badge ok' : 'badge no'}>{action.allowed ? 'allowed for this call' : 'denied'}</span>
              </>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">No agent actions recorded yet.</p>}

      {run && (
        <div className="outcome">
          <h3>Outcome</h3>
          <p>
            <span className="badge">{run.outcome?.status?.replace('_', ' ')}</span>{' '}
            {run.outcome?.monthlyPrice != null && <strong>${run.outcome.monthlyPrice}/month for {run.outcome.durationMonths} months</strong>}
          </p>
          {email && (
            <div className="email">
              <div className="email-head"><strong>{email.subject}</strong><span className="badge">{email.status}</span></div>
              <p>{email.body}</p>
            </div>
          )}
          {run.outcome?.status === 'offer_obtained' && (
            <button type="button" className="btn btn-primary" onClick={onSaveOffer} disabled={saved}>
              {saved ? 'Saved to memory' : 'Approve and save offer to memory'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => { apiFetch('/api/session').then((data) => setUser(data.user)).catch(() => {}); }, []);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function login(event) {
    event.preventDefault();
    setLoginError('');
    try { setUser((await apiFetch('/api/session', { method: 'POST', body: { pin } })).user); } catch { setLoginError('Invalid PIN'); }
  }

  async function signOut() {
    try { await apiFetch('/api/session/logout', { method: 'POST' }); } catch { /* cookie may already be gone */ }
    setUser(null); setPin(''); setContext(null); setMemories([]); setActions([]); setOutcome(null); setSaved(false); setError('');
  }

  async function startRun(event) {
    event.preventDefault();
    setError(''); setStarting(true); setContext(null); setActions([]); setOutcome(null); setSaved(false);
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
  async function saveOffer() {
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await apiFetch(`/api/runs/${context.runId}/memory`, { method: 'POST', body: { approved: true, expiresAt } });
      setSaved(true);
      await refreshMemories();
    } catch (cause) { setError(`Unable to save memory: ${readableError(cause)}`); }
  }
  useEffect(() => { if (user) refreshMemories(); }, [user]);

  if (!user) return (
    <div className="workspace">
      <main className="login">
        <a className="brand" href="#/"><span className="logo">C</span> CallE</a>
        <form className="card login-card" onSubmit={login}>
          <h1>Enter the demo</h1>
          <p className="muted">Use PIN A or B to sign in as one of two fictional tenants. Each has private memory.</p>
          <label htmlFor="demo-pin">Demo PIN</label>
          <input id="demo-pin" type="password" autoFocus value={pin} onChange={(event) => setPin(event.target.value)} />
          <button type="submit" className="btn btn-primary">Enter</button>
          {loginError && <p className="error" role="alert">{loginError}</p>}
        </form>
        <a className="muted" href="#/">← Back to home</a>
      </main>
    </div>
  );

  return (
    <div className="workspace">
      <header className="topbar">
        <a className="brand" href="#/"><span className="logo">C</span> CallE</a>
        <div className="topbar-right">
          <span className="user-chip">Signed in as {user}</span>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Switch user</button>
        </div>
      </header>

      <main className="grid">
        <div className="col">
          <form className="card run-form" onSubmit={startRun}>
            <h2>1. Prepare negotiation</h2>
            <div className="field-row">
              <div><label htmlFor="provider">Provider</label><input id="provider" value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} required /></div>
              <div><label htmlFor="maximum-price">Maximum monthly price</label><input id="maximum-price" type="number" min="1" value={form.maxMonthlyPrice} onChange={(event) => updateForm('maxMonthlyPrice', event.target.value)} required /></div>
            </div>
            <label htmlFor="goal">Goal</label><input id="goal" placeholder="e.g. Lower my internet bill" value={form.goal} onChange={(event) => updateForm('goal', event.target.value)} required />
            <label htmlFor="recipient-email">Result email</label><input id="recipient-email" type="email" value={form.recipientEmail} onChange={(event) => updateForm('recipientEmail', event.target.value)} required />
            <label className="toggle"><input type="checkbox" checked={form.useMemory} onChange={(event) => updateForm('useMemory', event.target.checked)} /> Use prior eligible memories</label>
            <fieldset><legend>Authorize for this call only</legend>
              <label className="toggle"><input type="checkbox" checked={form.phone} onChange={(event) => updateForm('phone', event.target.checked)} /> Synthetic phone number</label>
              <label className="toggle"><input type="checkbox" checked={form.dob} onChange={(event) => updateForm('dob', event.target.checked)} /> Synthetic date of birth</label>
              <p className="muted small">SIN and card numbers can never be authorized.</p>
            </fieldset>
            <button type="submit" className="btn btn-primary" disabled={starting}>{starting ? 'Preparing…' : 'Start negotiation'}</button>
          </form>

          <section className="card" aria-labelledby="memory-heading">
            <h2 id="memory-heading">Saved memories</h2>
            {memories.length ? (
              <ul className="memory-list">
                {memories.map((memory) => (
                  <li key={memory.id}>
                    <div>
                      <span>{memory.content}</span>
                      <small className="muted">v{memory.version} · {memory.source} · expires {formatDate(memory.expiresAt)}</small>
                    </div>
                    <div className="actions">
                      <button type="button" className="btn btn-sm" onClick={() => setEditingMemory({ ...memory, expiresAt: memory.expiresAt ? new Date(memory.expiresAt).toISOString().slice(0, 10) : '' })}>Correct</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => forgetMemory(memory.id)}>Forget</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No active memories saved.</p>}
            {editingMemory && (
              <form className="edit-form" onSubmit={correctMemory}>
                <h3>Correct memory</h3>
                <label htmlFor="memory-content">Memory</label><input id="memory-content" value={editingMemory.content} onChange={(event) => setEditingMemory((memory) => ({ ...memory, content: event.target.value }))} required />
                <label htmlFor="memory-source">Source</label><input id="memory-source" value={editingMemory.source} onChange={(event) => setEditingMemory((memory) => ({ ...memory, source: event.target.value }))} required />
                <label htmlFor="memory-expiry">Expires</label><input id="memory-expiry" type="date" value={editingMemory.expiresAt} onChange={(event) => setEditingMemory((memory) => ({ ...memory, expiresAt: event.target.value }))} required />
                <div className="actions"><button type="submit" className="btn btn-primary btn-sm">Save correction</button><button type="button" className="btn btn-sm" onClick={() => setEditingMemory(null)}>Cancel</button></div>
              </form>
            )}
          </section>
        </div>

        <div className="col">
          {error && <p className="error banner-error" role="alert">{error}</p>}
          {!context && <section className="card empty"><h2>2. Negotiate</h2><p className="muted">Prepare a negotiation to retrieve memories and start the voice call.</p></section>}
          {context && <>
            <section className="card" aria-labelledby="retrieved-heading"><h2 id="retrieved-heading">Retrieved for this run</h2>
              {context.memories.length ? <ul className="memory-list">{context.memories.map((memory) => <li key={memory.id}><div><span>{memory.content}</span> <small className="muted">({memory.source})</small></div></li>)}</ul> : <p className="muted">No eligible memories retrieved.</p>}
            </section>
            {agentId ? <VoiceSession agentId={agentId} context={context} onAction={(action) => setActions((current) => [...current, action])} onFieldRequest={(field) => setActions((current) => [...current, { type: 'field_request', allowed: field.allowed }])} onOutcome={setOutcome} onError={(cause) => setError(readableError(cause))} /> : <p className="error" role="alert">Voice is not configured. Set VITE_ELEVENLABS_AGENT_ID to the public ElevenLabs agent ID.</p>}
            <Trace actions={actions} outcome={outcome} onSaveOffer={saveOffer} saved={saved} />
          </>}
        </div>
      </main>
    </div>
  );
}
