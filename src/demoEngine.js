/** In-browser offline demo — no network, mirrors tenet.edges.cli.web_demo */

const BERLIN_RE = /\b(berlin|airbnb)\b/i;

const STYLE = {
  cmd: "\x1b[37m",
  dim: "\x1b[90m",
  pay: "\x1b[33;1m",
  ok: "\x1b[32m",
  exp: "\x1b[91m",
  sw: "\x1b[1;37m",
  done: "\x1b[96m",
};

export function matchesBerlinDemo(prompt) {
  return BERLIN_RE.test(prompt);
}

function formatLine(kind, text) {
  const open = STYLE[kind] || "";
  if (kind === "cmd") return `${open}$ ${text}\x1b[0m`;
  return `${open}${text}\x1b[0m`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runOfflineAsk(prompt, { writeln, abortSignal } = {}) {
  if (!writeln) throw new Error("writeln required");
  const trimmed = prompt.trim();
  if (!trimmed) return;

  const lines = [];
  if (matchesBerlinDemo(trimmed)) {
    lines.push(
      ["cmd", `agent: ${trimmed}`],
      ["dim", "3 candidates found. about to book the cheapest, 4.8★ …"],
      ["dim", "consulting the tenet expert network before committing"],
      ["pay", "HTTP 402 Payment Required · €0.05 EURD · algorand"],
      ["ok", "✓ paid · tx 4F9A…21BC ↗"],
      ["dim", "routing question over the mixnet → berlin local expert"],
      ["exp", "expert: listing A is Marzahn — 40 min out, recycled photos. classic scam. skip."],
      ["exp", "expert: book listing B — Neukölln / Reuterkiez. that's where berlin actually lives."],
      ["sw", "↳ switched pick: A → B"],
      ["done", "decision made. you didn't have to."],
    );
  } else {
    lines.push(
      ["cmd", `agent: ${trimmed}`],
      ["dim", "offline demo — networking disabled"],
      ["exp", "offline demo — networking disabled."],
      ["exp", "try: find me an airbnb in berlin"],
      ["exp", "or run tenet serve (without --offline) for the live network."],
    );
  }

  writeln("\x1b[90m# offline replay (no network)\x1b[0m");
  for (const [kind, text] of lines) {
    if (abortSignal?.aborted) return;
    writeln(formatLine(kind, text));
    await sleep(kind === "cmd" ? 420 : 680);
  }
  writeln("");
}

export const DEMO_REPLAY = [
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

export async function playDemoReplay({ writeln, abortSignal } = {}) {
  writeln("\x1b[90m# berlin airbnb replay\x1b[0m");
  for (const [kind, text] of DEMO_REPLAY) {
    if (abortSignal?.aborted) return;
    writeln(formatLine(kind, text));
    await sleep(kind === "cmd" ? 500 : 850);
  }
  writeln("");
}
