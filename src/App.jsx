import React, { useEffect, useRef, useState } from "react";

const URL = "https://public.computer";
const GH = "https://github.com/maceip/tenet";
// Resolve public/ assets against the Vite base (/tenet/) so they work at the subpath.
const asset = (p) => import.meta.env.BASE_URL + p;

const DOWNLOADS = [
  { id: "macos", label: "macOS", file: "tenet-macos-arm64", arch: "arm64" },
  { id: "linux", label: "Linux", file: "tenet-linux-x86_64", arch: "x86_64" },
  { id: "windows", label: "Windows", file: "tenet-windows-x86_64.exe", arch: "x86_64" },
];

async function probeBinary(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return false;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (type.includes("text/html")) return false;
    const len = Number(res.headers.get("content-length") || 0);
    return len > 100_000;
  } catch {
    return false;
  }
}

function IconApple() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.52 12.45c.02 2.17 1.9 2.9 1.92 2.91-.02.06-.3 1.02-1 2.02-.6.87-1.22 1.74-2.2 1.76-.96.02-1.27-.57-2.37-.57-1.1 0-1.44.55-2.35.59-.95.04-1.67-.96-2.28-1.83-1.24-1.79-2.19-5.06-.91-7.27.64-1.1 1.78-1.8 3.02-1.82.94-.02 1.83.63 2.4.63.56 0 1.62-.78 2.74-.66.47.02 1.78.19 2.62 1.43-2.18 1.18-1.83 4.24.06 5.24zM14.18 4.2c.5-.61.84-1.46.75-2.31-.72.03-1.6.48-2.12 1.09-.46.54-.87 1.41-.76 2.24.8.06 1.62-.41 2.13-1.02z" />
    </svg>
  );
}

function IconLinux() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2c-3.2 0-5.8 2.1-5.8 5.2 0 1.1.4 2.1 1 2.9-.6.5-1 1.2-1 2 0 1.7 1.5 3.1 3.4 3.1.3 0 .6 0 .9-.1.5 1.5 2 2.6 3.7 2.6s3.2-1.1 3.7-2.6c.3.1.6.1.9.1 1.9 0 3.4-1.4 3.4-3.1 0-.8-.4-1.5-1-2 .6-.8 1-1.8 1-2.9C17.84 4.1 15.24 2 12.04 2zm-1.1 4.5c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm2.2 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm-2.5 5.8c1.1.8 2.6.8 3.7 0 .2 1.1-.7 2.1-1.8 2.1h-.1c-1.1 0-2-.9-1.8-2.1z" />
    </svg>
  );
}

function IconWindows() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5.5 10.5 4.2V11H3V5.5zm0 7.5h7.5v6.8L3 18.5V13zm9-8.3L21 3.5V11h-9V4.7zm0 8.3h9v7.5l-9-1.8V13z" />
    </svg>
  );
}

const PLATFORM_ICONS = { macos: IconApple, linux: IconLinux, windows: IconWindows };

function DownloadButtons({ className = "" }) {
  const [ready, setReady] = useState(() => Object.fromEntries(DOWNLOADS.map((d) => [d.id, false])));
  const [probed, setProbed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        DOWNLOADS.map(async (d) => {
          const url = asset(`downloads/${d.file}`);
          const ok = await probeBinary(url);
          return [d.id, ok];
        }),
      );
      if (alive) {
        setReady(Object.fromEntries(entries));
        setProbed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className={`downloads ${className}`.trim()}>
      <p className="downloads-label">debug client</p>
      <div className="download-row" role="group" aria-label="Download debug client binaries">
        {DOWNLOADS.map((d) => {
          const Icon = PLATFORM_ICONS[d.id];
          const url = asset(`downloads/${d.file}`);
          const enabled = ready[d.id];
          const title = enabled
            ? `Download tenet for ${d.label} (${d.arch})`
            : `${d.label} debug build not available yet`;
          if (enabled) {
            return (
              <a
                key={d.id}
                className="dl-btn"
                href={url}
                download
                title={title}
                aria-label={title}
              >
                <Icon />
                <span className="dl-text">
                  <span className="dl-os">{d.label}</span>
                  <span className="dl-arch">{d.arch}</span>
                </span>
              </a>
            );
          }
          return (
            <button
              key={d.id}
              type="button"
              className="dl-btn"
              disabled
              title={title}
              aria-label={title}
              aria-disabled="true"
            >
              <Icon />
              <span className="dl-text">
                <span className="dl-os">{d.label}</span>
                <span className="dl-arch">{probed ? "soon" : "…"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const glyphs = "アァカサタナハマヤラワガザダバパゴ012345789ABCDEFZ$€<>/\\|=+".split("");
    const fontSize = 18;
    let W, H, cols, drops, raf;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      cols = Math.max(1, Math.floor(W / fontSize));
      drops = Array.from({ length: cols }, () => Math.floor((Math.random() * -H) / fontSize));
    }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      ctx.fillStyle = "rgba(10,10,10,0.10)"; // fade the trails
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.shadowColor = "#e5352b"; // red glisten
        ctx.shadowBlur = 10;
        ctx.fillStyle = "rgba(255,255,255,0.92)"; // white glyph
        ctx.fillText(ch, x, y);
        ctx.shadowBlur = 0;
        if (y > H && Math.random() > 0.972) drops[i] = 0;
        drops[i] += 0.6;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}

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

function TopRail() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    let alive = true;
    const NODE = "https://cdda104e90ae.aeon.site/healthz";
    const check = () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      fetch(NODE, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
        .then(() => { if (alive) setStatus("online"); })
        .catch(() => { if (alive) setStatus("unreachable"); })
        .finally(() => clearTimeout(timer));
    };
    check();
    const iv = setInterval(check, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const [dot, word] = {
    checking: ["#9a9a9a", "checking…"],
    online: ["#5ad17a", "online"],
    unreachable: ["#e5352b", "unreachable"],
  }[status];
  return (
    <div className="toprail">
      <span className="rail-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
      <span className="rail-k">bootstrap matcher</span>
      <span style={{ color: dot }}>{word}</span>
      <span className="rail-sep">·</span>
      <span className="rail-dim">attested nitro tee · cdda104e90ae.aeon.site</span>
      <span className="rail-spacer" />
      <span className="rail-dim">x402 · algorand · eurd</span>
    </div>
  );
}

export default function App() {
  return (
    <>
      <TopRail />
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
        <MatrixRain />
        <div className="hero-inner">
          <h1 className="wordmark-text">tenet</h1>
          <div className="wordmark-sub">self-driving commerce</div>
          <p className="lede">
            Your agent makes the decision you'd rather not — and <strong>pays an expert it can't fool.</strong>
          </p>
          <div className="cta">
            <a className="btn" href="#demo">See the demo</a>
            <a className="btn ghost" href="#how">How it works</a>
          </div>
          <DownloadButtons />
          <p className="kicker">x402 · Algorand · EURD</p>
        </div>
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
          <h2 className="big">The agent pays you<br/>for your expertise.</h2>
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
