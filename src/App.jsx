import React, { useEffect, useState } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUser(d.user))
      .catch(() => {});
  }, []);

  async function login(e) {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (r.ok) setUser((await r.json()).user);
    else setError('Invalid PIN');
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '2rem auto' }}>
      <h1>CallE</h1>
      {user ? (
        <p>Signed in as {user}</p>
      ) : (
        <form onSubmit={login}>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Demo PIN" />
          <button type="submit">Enter</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </main>
  );
}
