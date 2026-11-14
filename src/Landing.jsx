const STEPS = [
  { n: '1', title: 'Tell CallE the goal', text: 'Pick a provider, set a price ceiling and decide what CallE may share for this one call.' },
  { n: '2', title: 'It recalls what worked', text: 'Atlas Vector Search finds your approved, unexpired memories, filtered to you and only you.' },
  { n: '3', title: 'It negotiates by voice', text: 'CallE speaks with the provider, anchoring on the best past offer instead of starting cold.' },
  { n: '4', title: 'You stay in control', text: 'Review the trace, approve what gets remembered, correct it, or forget it entirely.' },
];

const PILLARS = [
  { icon: '🔒', title: 'No leaks between tenants', text: 'Tenant and reader come from the server session, never the request. Vector search is pre-filtered on them, and every hit is re-read.' },
  { icon: '⏳', title: 'Memory that expires and heals', text: 'Corrections supersede the old version. Forgetting deletes the document and its embedding. Expiry is enforced on every read.' },
  { icon: '🧪', title: 'Proof, not vibes', text: 'Run the same call with memory on and off. The trace shows which memories were retrieved and which action cited them.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="nav">
        <a className="brand" href="#/"><span className="logo">C</span> CallE</a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#governance">Governance</a>
          <a className="btn btn-primary" href="#/demo">Launch demo</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill">MongoDB Atlas Vector Search · ElevenLabs voice</span>
          <h1>Your bill, negotiated.<br /><span className="gradient">Memory you can govern.</span></h1>
          <p className="lead">
            CallE is an AI agent that phones your provider and negotiates for you. It remembers what worked last time,
            and every memory is private, expiring, correctable and provable.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary btn-lg" href="#/demo">Try the live demo</a>
            <a className="btn btn-ghost btn-lg" href="#how">See how it works</a>
          </div>
          <p className="fine">Demo uses synthetic data. CallE never shares a SIN or card number.</p>
        </div>

        <div className="mock" aria-hidden="true">
          <div className="mock-head"><span className="dot live" /> Live call with DemoNet</div>
          <div className="bubble rep"><small>Rep</small>I can offer $85 a month for 12 months.</div>
          <div className="bubble agent"><small>CallE</small>Last time DemoNet offered me $75 a month. I'd like to stay at $75.</div>
          <div className="memory-chip">🧠 Memory used · v1 · expires Dec 31</div>
          <div className="mock-foot"><span>Counter</span><strong>$85 → $75</strong></div>
        </div>
      </section>

      <section id="how" className="section">
        <h2>How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="card" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="governance" className="section">
        <h2>Agent memory someone can answer for</h2>
        <p className="section-sub">Three questions every team should ask about what an agent remembers.</p>
        <div className="pillars">
          {PILLARS.map((p) => (
            <div className="card" key={p.title}>
              <span className="icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section banner">
        <h2>Ready to see it change a call?</h2>
        <p>Sign in as one of two fictional tenants, negotiate, then try to leak, correct and forget a memory.</p>
        <a className="btn btn-primary btn-lg" href="#/demo">Launch the demo</a>
      </section>

      <footer className="foot">
        <span>CallE · MongoDB Agents in Context hackathon</span>
        <span>React · Express · MongoDB Atlas · Voyage AI · ElevenLabs · Vercel</span>
      </footer>
    </div>
  );
}
