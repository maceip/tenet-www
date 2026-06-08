import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const LOCAL_BASE = "http://127.0.0.1:8766";
const PROMPT = "\r\n\x1b[38;2;229;53;43mtenet\x1b[0m \u203a ";

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

const STYLE = {
  cmd: "\x1b[37m",
  dim: "\x1b[90m",
  pay: "\x1b[33;1m",
  ok: "\x1b[32m",
  exp: "\x1b[91m",
  sw: "\x1b[1;37m",
  done: "\x1b[96m",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDemoLine(kind, text) {
  const open = STYLE[kind] || "";
  if (kind === "cmd") return `${open}$ ${text}\x1b[0m`;
  return `${open}${text}\x1b[0m`;
}

async function probeLocal() {
  try {
    const res = await fetch(`${LOCAL_BASE}/healthz`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

function parseSseBlock(block, onEvent) {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    onEvent(event, JSON.parse(data));
  } catch {
    /* ignore malformed chunks */
  }
}

async function streamAsk(prompt, onEvent) {
  const res = await fetch(`${LOCAL_BASE}/v1/expert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no response body");
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let split = buf.indexOf("\n\n");
    while (split >= 0) {
      parseSseBlock(buf.slice(0, split), onEvent);
      buf = buf.slice(split + 2);
      split = buf.indexOf("\n\n");
    }
  }
  if (buf.trim()) parseSseBlock(buf, onEvent);
}

export default function DemoTerminal() {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const modeRef = useRef("checking");
  const busyRef = useRef(false);
  const lineRef = useRef("");
  const replayAbortRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.45,
      theme: {
        background: "#0c0c0c",
        foreground: "#d6d6d6",
        cursor: "#e5352b",
        selectionBackground: "rgba(229, 53, 43, 0.25)",
      },
      scrollback: 2000,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const write = (text) => term.write(text);
    const writeln = (text = "") => term.writeln(text);

    const showPrompt = () => write(PROMPT);

    const printHelp = (local) => {
      writeln("\x1b[90m── tenet demo webshell ──\x1b[0m");
      if (local) {
        writeln("\x1b[32m●\x1b[0m local client connected at 127.0.0.1:8766");
        writeln("type a question and press enter — routed through your binary.");
      } else {
        writeln("\x1b[33m○\x1b[0m offline replay — download the client to run live.");
        writeln("  github releases → chmod +x tenet → \x1b[37mtenet serve\x1b[0m → type \x1b[37mconnect\x1b[0m");
      }
      writeln("commands: \x1b[37mhelp\x1b[0m  \x1b[37mreplay\x1b[0m  \x1b[37mconnect\x1b[0m  \x1b[37mclear\x1b[0m");
    };

    const playReplay = async () => {
      replayAbortRef.current?.abort();
      const ac = new AbortController();
      replayAbortRef.current = ac;
      writeln("");
      writeln("\x1b[90m# berlin airbnb replay\x1b[0m");
      for (const [kind, text] of DEMO) {
        if (ac.signal.aborted) return;
        writeln(formatDemoLine(kind, text));
        await sleep(kind === "cmd" ? 500 : 850);
      }
      if (!ac.signal.aborted) writeln("");
    };

    const setMode = (next) => {
      modeRef.current = next;
    };

    const tryConnect = async () => {
      write("\x1b[90mprobing 127.0.0.1:8766 …\x1b[0m");
      const health = await probeLocal();
      writeln(health ? " \x1b[32mok\x1b[0m" : " \x1b[31munreachable\x1b[0m");
      if (health) {
        setMode("local");
        writeln(`\x1b[32mconnected\x1b[0m — ${health.matcher || "live network"}`);
        showPrompt();
        return true;
      }
      setMode("offline");
      return false;
    };

    const submitPrompt = async (prompt) => {
      if (!prompt.trim() || busyRef.current) {
        showPrompt();
        return;
      }
      busyRef.current = true;
      try {
        await streamAsk(prompt.trim(), (event, data) => {
          if (event === "status" && data.text) writeln(`\x1b[90m${data.text}\x1b[0m`);
          if (event === "chunk" && data.data) writeln(`\x1b[91m${data.data}\x1b[0m`);
          if (event === "error") writeln(`\x1b[31merror: ${data.error}\x1b[0m`);
          if (event === "done" && data.ok === false) writeln("\x1b[31mask failed\x1b[0m");
        });
      } catch (err) {
        writeln(`\x1b[31m${err.message}\x1b[0m`);
        setMode("offline");
      } finally {
        busyRef.current = false;
        showPrompt();
      }
    };

    const handleCommand = async (raw) => {
      const cmd = raw.trim().toLowerCase();
      if (!cmd) {
        showPrompt();
        return;
      }
      if (cmd === "help") {
        printHelp(modeRef.current === "local");
        showPrompt();
        return;
      }
      if (cmd === "clear") {
        term.clear();
        printHelp(modeRef.current === "local");
        showPrompt();
        return;
      }
      if (cmd === "replay" || cmd === "demo") {
        await playReplay();
        showPrompt();
        return;
      }
      if (cmd === "connect") {
        await tryConnect();
        if (modeRef.current !== "local") showPrompt();
        return;
      }
      if (modeRef.current === "local") {
        await submitPrompt(raw);
        return;
      }
      writeln("\x1b[90moffline — run \x1b[37mtenet serve\x1b[90m locally, then type \x1b[37mconnect\x1b[0m");
      showPrompt();
    };

    const onData = (data) => {
      if (busyRef.current) return;
      for (const ch of data) {
        if (ch === "\r") {
          const line = lineRef.current;
          lineRef.current = "";
          writeln("");
          void handleCommand(line);
          continue;
        }
        if (ch === "\u007f") {
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1);
            write("\b \b");
          }
          continue;
        }
        if (ch < " " && ch !== "\t") continue;
        lineRef.current += ch;
        write(ch);
      }
    };

    term.onData(onData);

    const boot = async () => {
      const health = await probeLocal();
      if (health) {
        setMode("local");
        printHelp(true);
        showPrompt();
        return;
      }
      setMode("offline");
      printHelp(false);
      await playReplay();
      writeln("\x1b[90mtype \x1b[37mhelp\x1b[90m or \x1b[37mconnect\x1b[90m after starting \x1b[37mtenet serve\x1b[0m");
      showPrompt();
    };

    void boot();

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      replayAbortRef.current?.abort();
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  return (
    <div className="term term-xterm">
      <div className="term-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="term-title">tenet webshell — berlin</span>
      </div>
      <div className="term-body term-body-xterm" ref={hostRef} />
    </div>
  );
}
