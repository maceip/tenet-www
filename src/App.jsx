import React, { useEffect, useState } from "react";
import DemoTerminal from "./DemoTerminal.jsx";
import MatrixRain from "./MatrixRain.jsx";
import TenetLogo from "./TenetLogo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { getTheme, onThemeChange } from "./theme.js";

const GH = "https://github.com/maceip/tenet";
const HOME = import.meta.env.BASE_URL;
const asset = (p) => import.meta.env.BASE_URL + p;

const DOWNLOADS = [
  { id: "macos", label: "macOS", file: "tenet-macos-arm64", arch: "arm64" },
  { id: "linux", label: "Linux", file: "tenet-linux-x86_64", arch: "x86_64" },
  { id: "windows", label: "Windows", file: "tenet-windows-x86_64.exe", arch: "x86_64" },
];

const RELEASE_DL = `${GH}/releases/latest/download`;
const RELEASE_API = "https://api.github.com/repos/maceip/tenet/releases/latest";
const DEFAULT_NETWORK = {
  schema: "tenet.www_network_status.2026-06",
  matcher: {
    label: "network",
    host: "d51d8afc9668.aeon.site",
    status: "checking",
    tee: "attested nitro tee",
  },
  relay: { id: "reach-beta-1", host: "3.121.69.82:4433", status: "unknown" },
  experts: { pool: "alpha.experts~tenet", count: 2, status: "unknown" },
};

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

function DownloadButtons({ id, className = "", showVersion = true }) {
  const [tag, setTag] = useState(null);

  useEffect(() => {
    if (!showVersion) return undefined;
    let alive = true;
    fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data?.tag_name) setTag(data.tag_name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showVersion]);

  return (
    <div id={id} className={`downloads ${className}`.trim()}>
      <p className="downloads-label">
        download client
        {tag ? <span className="downloads-tag">{tag}</span> : null}
      </p>
      <div className="download-row" role="group" aria-label="Download tenet client binaries">
        {DOWNLOADS.map((d) => {
          const Icon = PLATFORM_ICONS[d.id];
          const url = `${RELEASE_DL}/${d.file}`;
          const title = `Download tenet for ${d.label} (${d.arch})`;
          return (
            <a
              key={d.id}
              className="dl-btn"
              href={url}
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
        })}
      </div>
    </div>
  );
}

const STEPS = [
  ["1", "Ask once", "Your agent submits the decision to the live network."],
  ["2", "Match privately", "An attested TEE matcher selects experts from manifests — without leaking the question."],
  ["3", "Route sealed traffic", "The question travels the mixnet; relays forward bytes without reading them."],
  ["4", "Answer from local knowledge", "The chosen expert combines local context with a frontier model and answers."],
  ["5", "Pay the expert", "Settled in EURD over x402 on Algorand. Real money, so someone's accountable."],
];

const FEATURES = [
  ["Ask once", "Submit a decision to the live network. No directory to search, no cold DMs, no inbox to spam."],
  ["Matched privately", "An attested TEE matcher picks the right experts from statistical manifests — without ever learning your question."],
  ["Sealed transport", "Questions travel a Sphinx/Outfox mixnet. Relays forward the bytes; they can't read them."],
  ["Experts stay home", "Experts answer from their own machine, behind NAT — no public port, no uploading their corpus."],
  ["Reputation-staked", "Experts stake reputation and are paid per call. Corrupt a weighted majority — or don't bother."],
  ["Provable work", "Laptop experts: reputation + random spot-audit. Opt-in cloud-TEE experts: a hard, attested proof they did the work."],
];

const UPTIME_SLOTS = 30;
const UPTIME_STORAGE_KEY = "tenet-matcher-uptime-v1";

function loadUptimeHistory() {
  try {
    const raw = localStorage.getItem(UPTIME_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === UPTIME_SLOTS) return parsed;
  } catch {
    /* ignore corrupt history */
  }
  return Array.from({ length: UPTIME_SLOTS }, () => "checking");
}

function railStatusStyle(status) {
  if (status === "online" || status === "reachable") return ["#5ad17a", status];
  if (status === "unreachable") return ["#e5352b", status];
  return ["#9a9a9a", status === "checking" ? "checking…" : status];
}

function normalizeChipStatus(status) {
  if (status === "online" || status === "reachable") return "online";
  if (status === "unreachable") return "unreachable";
  return "checking";
}

function TopRail() {
  const [network, setNetwork] = useState(DEFAULT_NETWORK);
  const [history, setHistory] = useState(loadUptimeHistory);

  useEffect(() => {
    let alive = true;
    const check = () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      fetch(`${asset("network-status.json")}?t=${Date.now()}`, {
        cache: "no-store",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive) return;
          const next = data || DEFAULT_NETWORK;
          setNetwork(next);
          const matcherStatus = normalizeChipStatus(next?.matcher?.status || "unreachable");
          setHistory((prev) => {
            const updated = [...prev.slice(1), matcherStatus];
            try { localStorage.setItem(UPTIME_STORAGE_KEY, JSON.stringify(updated)); } catch { /* quota */ }
            return updated;
          });
        })
        .catch(() => {
          if (!alive) return;
          setNetwork((prev) => ({
            ...prev,
            matcher: { ...prev.matcher, status: "unreachable" },
          }));
          setHistory((prev) => {
            const updated = [...prev.slice(1), "unreachable"];
            try { localStorage.setItem(UPTIME_STORAGE_KEY, JSON.stringify(updated)); } catch { /* quota */ }
            return updated;
          });
        })
        .finally(() => clearTimeout(timer));
    };
    check();
    const iv = setInterval(check, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const matcher = network?.matcher || DEFAULT_NETWORK.matcher;
  const relay = network?.relay;
  const experts = network?.experts;
  const [dot, word] = railStatusStyle(matcher.status || "checking");
  const host = matcher.host || "matcher pending deploy";
  const relayWord = relay?.status && relay.status !== "unknown" ? relay.status : null;
  const expertLabel = experts?.count ? `${experts.count} experts` : null;

  return (
    <div className="toprail">
      <div
        className="toprail-hist"
        role="img"
        aria-label={`Matcher uptime last ${UPTIME_SLOTS} checks`}
      >
        {history.map((slot, i) => {
          const chip = normalizeChipStatus(slot);
          return <span key={i} className={`rail-chip ${chip}`} title={chip} />;
        })}
      </div>
      <span className="rail-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
      <span className="rail-k">{matcher.label || "network"}</span>
      <span style={{ color: dot }}>{word}</span>
      <span className="rail-sep">·</span>
      <span className="rail-dim">{matcher.tee || "attested nitro tee"} · {host}</span>
      {relay ? (
        <>
          <span className="rail-sep rail-extra">·</span>
          <span className="rail-dim rail-extra">relay {relay.host}{relayWord ? ` · ${relayWord}` : ""}</span>
        </>
      ) : null}
      {expertLabel ? (
        <>
          <span className="rail-sep rail-extra">·</span>
          <span className="rail-dim rail-extra">{expertLabel}</span>
        </>
      ) : null}
      <span className="rail-spacer" />
      <span className="rail-dim">x402 · algorand · eurd</span>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(getTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => onThemeChange(setTheme), []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <TopRail />
      <nav className="nav">
        <a className="brand" href={HOME}>
          <TenetLogo variant="nav" theme={theme} />
        </a>
        <div className="nav-right">
          <div className={`nav-links${menuOpen ? " open" : ""}`}>
            <a href="#network" onClick={closeMenu}>network</a>
            <a href="#demo" onClick={closeMenu}>demo</a>
            <a href="#how" onClick={closeMenu}>how</a>
            <a href="#download" onClick={closeMenu}>download</a>
            <a href={GH} onClick={closeMenu}>github</a>
          </div>
          <ThemeToggle />
          <button
            type="button"
            className="nav-burger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      <header className="hero">
        <MatrixRain />
        <div className="hero-inner">
          <TenetLogo variant="hero" theme={theme} />
          <div className="wordmark-sub">the expert network</div>
          <p className="lede">
            An open mixture-of-experts where the experts are sovereign human nodes with private knowledge,
            the gate is a privacy-preserving oblivious matcher, and a frontier model acts as the floor.
          </p>
          <div className="cta">
            <a className="btn" href="#demo">See the demo</a>
            <a className="btn ghost" href="#how">How it works</a>
          </div>
          <DownloadButtons />
          <p className="kicker">x402 · Algorand · EURD</p>
        </div>
      </header>

      <section className="band">
        <h2 className="big">Deniability, not secrecy.</h2>
        <p className="body wide">
          Conversations built to be <strong>unprovable</strong> — not hidden, deniable. Nobody can show the
          exchange happened, including the people who ran the wires. This isn't compliance-grade encryption
          marketing a sterile vault; it's infrastructure that moves information because the system is
          structurally incapable of keeping a logbook.
        </p>
      </section>

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

      <section id="network" className="band network">
        <span className="tag">the network</span>
        <h2 className="big">A network,<br/>not a model.</h2>
        <p className="body wide">
          tenet is a private mixture-of-experts. You ask once; the question is matched to whoever's
          knowledge fits and routed to them sealed; they answer from their own machine; they get paid.
          One large model gives you one opinion with one set of blind spots — tenet gives you the
          specialist, privately, and makes them accountable for the answer.
        </p>
        <div className="feature-grid">
          {FEATURES.map(([t, d]) => (
            <div className="feature" key={t}>
              <h4>{t}</h4>
              <p className="muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="demo">
        <div className="demo-copy">
          <span className="tag">live demo</span>
          <h2 className="big">Got taste?<br/>Get paid.</h2>
          <p className="body">
            Provide your expertise on tenet and get paid when clients route prompts through your
            expert-context. What does this mean? All it means is we route user prompts through your
            agent — they get the context and memory of your expertise, and you get paid! Your identity
            and location are hidden from the network at all times.
          </p>
        </div>
        <DemoTerminal />
      </section>

      <section className="bleed light">
        <img src={asset("slides/countach.webp")} alt="" />
        <div className="bleed-cap">the expert network</div>
      </section>

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
          <img src={asset("slides/architecture.webp")} alt="tenet architecture: attested matcher, mixnet/REACH, relaxed expert" />
        </figure>
      </section>

      <section className="closer">
        <img src={asset("slides/ship.webp")} alt="" />
        <div className="closer-overlay">
          <h2>GET EXPERTS.<br/>GET GOING.</h2>
        </div>
      </section>

      <footer className="foot">
        <span className="foot-brand">
          <TenetLogo variant="footer" theme={theme} />
        </span>
        <span className="muted">the expert network · Algorand x402</span>
        <a href={GH}>github</a>
        <a href={`${GH}/releases/latest`}>releases</a>
      </footer>
      <DownloadButtons id="download" className="foot-downloads" />
    </>
  );
}
