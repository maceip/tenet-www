import React, { useEffect, useRef, useState } from "react";

const URL = "https://public.computer";
const GH = "https://github.com/maceip/tenet-www";
// Resolve public/ assets against the Vite base (/tenet/) so they work at the subpath.
const asset = (p) => import.meta.env.BASE_URL + p;

// The live demo, scripted as a terminal transcript. Each entry: [class, text].
const DEMO = [
  ["cmd", "agent: find me an airbnb in berlin — i don't want to deal with it"],
  ["dim", "3 candidates found. about to book the cheapest, 4.8★ …"],
  ["dim", "consulting the tenet expert network before committing"],
  ["pay", "HTTP 402 Payment Required · €0.05 EURD · algorand"],
  ["ok", "✓ paid · tx 4F9A…21BC ↗"],
  ["dim", "routing question over the mixnet → berlin local expert"],
  ["exp", "expert: listing A is Marzahn — 40 min out, recycled photos. classic scam. skip."],
  ["exp", "expert: book listing B — Neukölln / Reuterkiez. that's where berlin actually lives."],
  ["sw", "↳ switched pick: A → B"],
  ["done", "decision made. you didn't have to."],
];

const STEPS = [
  ["1", "Ask once", "Your agent submits the decision to the live network."],
  ["2", "Match privately", "An attested TEE matcher selects experts from manifests — without leaking the question."],
  ["3", "Route sealed traffic", "The question travels the mixnet; relays forward bytes without reading them."],
  ["4", "Answer from local knowledge", "The chosen expert combines local context with a frontier model and answers."],
  ["5", "Pay the expert", "Settled in EURD over x402 on Algorand. Real money, so someone's accountable."],
];

function Terminal() {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (n >= DEMO.length) return;
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 500 : 850);
    return () => clearTimeout(t);
  }, [n]);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [n]);
  return (
    <div className="term">
      <div className="term-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="term-title">self-driving-commerce — berlin</span>
      </div>
      <div className="term-body" ref={ref}>
        {DEMO.slice(0, n).map(([c, t], i) => (
          <div key={i} className={`line ${c}`}>{t}</div>
        ))}
        {n < DEMO.length && <span className="cursor">▌</span>}
        {n >= DEMO.length && (
          <button className="replay" onClick={() => setN(0)}>↻ replay</button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <nav className="nav">
        <a className="brand" href={URL}>TENET</a>
        <div className="nav-right">
          <a href="#demo">demo</a>
          <a href="#how">how</a>
          <a href={GH}>github</a>
          <a className="pill" href={URL}>public.computer</a>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <img className="wordmark" src={asset("slides/wordmark.jpeg")} alt="tenet — self driving commerce" />
        <p className="lede">
          Your agent makes the decision you'd rather not — and <strong>pays an expert it can't fool.</strong>
        </p>
        <div className="cta">
          <a className="btn" href="#demo">See the demo</a>
          <a className="btn ghost" href="#how">How it works</a>
        </div>
        <p className="kicker">self-driving commerce · x402 · Algorand · EURD</p>
      </header>

      {/* PROBLEM */}
      <section className="band">
        <h2 className="big">Ask once.</h2>
        <p className="body wide">
          Stop arguing with Airbnb support. Stop trusting SEO and astroturfed reviews. When the single
          source is captured, you can't tell the right option from the scam — so before your agent commits
          money, it pays real experts to tell you which one is real.
        </p>
      </section>

      {/* VS */}
      <section className="vs">
        <div className="vs-col">
          <div className="vs-art"><span className="blob" /></div>
          <h3>One large model</h3>
          <p className="muted">One opinion. Same blind spots. Bribable. Out of date.</p>
        </div>
        <div className="vs-mid">vs</div>
        <div className="vs-col">
          <div className="vs-art net">
            {Array.from({ length: 7 }).map((_, i) => <span key={i} className="node" />)}
          </div>
          <h3>A network of experts</h3>
          <p className="muted">Independent, reputation-staked, paid per call. Corrupt a weighted majority — or don't bother.</p>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="demo">
        <div className="demo-copy">
          <span className="tag">live demo</span>
          <h2 className="big">The agent pays to<br/>not get scammed.</h2>
          <p className="body">
            A Claude-Code agent is told to book a Berlin Airbnb. Before it commits, it pays <strong>€0.05
            EURD over x402 on Algorand</strong>, asks the tenet Berlin expert over the real mixnet, and
            switches its pick when the expert flags a scam. Real payment. Real network. Real verdict.
          </p>
          <p className="muted small">We don't click "book" for you — booking is one boring API call. The judgment is the hard part, and that's what you pay for.</p>
        </div>
        <Terminal />
      </section>

      {/* CAR DIVIDER */}
      <section className="bleed light">
        <img src={asset("slides/countach.jpeg")} alt="" />
        <div className="bleed-cap">self-driving commerce</div>
      </section>

      {/* HOW */}
      <section id="how" className="how">
        <h2 className="big center">How it works</h2>
        <ol className="steps">
          {STEPS.map(([n, t, d]) => (
            <li key={n}>
              <span className="num">{n}</span>
              <div>
                <h4>{t}</h4>
                <p className="muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <figure className="arch">
          <img src={asset("slides/architecture.jpeg")} alt="tenet architecture: attested matcher, mixnet/REACH, relaxed expert" />
        </figure>
      </section>

      {/* CLOSER */}
      <section className="closer">
        <img src={asset("slides/ship.jpeg")} alt="" />
        <div className="closer-overlay">
          <h2>GET EXPERTS.<br/>GET GOING.</h2>
          <a className="btn solid" href={URL}>public.computer</a>
        </div>
      </section>

      <footer className="foot">
        <span>TENET</span>
        <span className="muted">self-driving commerce · Algorand x402</span>
        <a href={GH}>github</a>
      </footer>
    </>
  );
}
