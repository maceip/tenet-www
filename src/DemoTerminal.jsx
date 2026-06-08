import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { playDemoReplay, runOfflineAsk } from "./demoEngine.js";

const LOCAL_BASE = "http://127.0.0.1:8766";
const PROMPT = "\r\n\x1b[38;2;229;53;43mtenet\x1b[0m \u203a ";

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

function modeLabel(health) {
  if (!health) return "browser-offline";
  if (health.mode === "tenet-serve-offline" || health.network === false) return "local-offline";
  return "local-live";
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

    const printHelp = (mode) => {
      writeln("\x1b[90m── tenet demo webshell ──\x1b[0m");
      if (mode === "local-live") {
        writeln("\x1b[32m●\x1b[0m live client at 127.0.0.1:8766 — questions hit the real network");
      } else if (mode === "local-offline") {
        writeln("\x1b[33m●\x1b[0m tenet-web / tenet serve --offline at 127.0.0.1:8766 (no network)");
      } else {
        writeln("\x1b[33m○\x1b[0m browser-only offline engine — no binary required");
        writeln("  tiny build: \x1b[37mtenet serve --offline\x1b[0m or \x1b[37mtenet-web\x1b[0m → \x1b[37mconnect\x1b[0m");
        writeln("  live network: \x1b[37mtenet serve\x1b[0m");
      }
      writeln("commands: \x1b[37mhelp\x1b[0m  \x1b[37mreplay\x1b[0m  \x1b[37mconnect\x1b[0m  \x1b[37mclear\x1b[0m");
    };

    const setMode = (next) => {
      modeRef.current = next;
    };

    const tryConnect = async () => {
      write("\x1b[90mprobing 127.0.0.1:8766 …\x1b[0m");
      const health = await probeLocal();
      writeln(health ? " \x1b[32mok\x1b[0m" : " \x1b[31munreachable\x1b[0m");
      if (health) {
        const mode = modeLabel(health);
        setMode(mode);
        const tag = mode === "local-live" ? "live network" : "offline bridge";
        writeln(`\x1b[32mconnected\x1b[0m — ${tag}${health.matcher ? ` · ${health.matcher}` : ""}`);
        showPrompt();
        return true;
      }
      setMode("browser-offline");
      return false;
    };

    const submitLocal = async (prompt) => {
      await streamAsk(prompt.trim(), (event, data) => {
        if (event === "status" && data.text) writeln(`\x1b[90m${data.text}\x1b[0m`);
        if (event === "chunk" && data.data) {
          const color = modeRef.current === "local-offline" ? "91" : "91";
          writeln(`\x1b[${color}m${data.data}\x1b[0m`);
        }
        if (event === "error") writeln(`\x1b[31merror: ${data.error}\x1b[0m`);
        if (event === "done" && data.ok === false) writeln("\x1b[31mask failed\x1b[0m");
      });
    };

    const submitPrompt = async (prompt) => {
      if (!prompt.trim() || busyRef.current) {
        showPrompt();
        return;
      }
      busyRef.current = true;
      try {
        if (modeRef.current === "browser-offline") {
          replayAbortRef.current?.abort();
          const ac = new AbortController();
          replayAbortRef.current = ac;
          await runOfflineAsk(prompt, { writeln, abortSignal: ac.signal });
        } else {
          await submitLocal(prompt);
        }
      } catch (err) {
        writeln(`\x1b[31m${err.message}\x1b[0m`);
        if (modeRef.current !== "browser-offline") setMode("browser-offline");
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
        printHelp(modeRef.current);
        showPrompt();
        return;
      }
      if (cmd === "clear") {
        term.clear();
        printHelp(modeRef.current);
        showPrompt();
        return;
      }
      if (cmd === "replay" || cmd === "demo") {
        replayAbortRef.current?.abort();
        const ac = new AbortController();
        replayAbortRef.current = ac;
        await playDemoReplay({ writeln, abortSignal: ac.signal });
        showPrompt();
        return;
      }
      if (cmd === "connect") {
        await tryConnect();
        if (modeRef.current === "browser-offline") showPrompt();
        return;
      }
      if (modeRef.current === "local-live" || modeRef.current === "local-offline") {
        await submitPrompt(raw);
        return;
      }
      await submitPrompt(raw);
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
        setMode(modeLabel(health));
        printHelp(modeRef.current);
        showPrompt();
        return;
      }
      setMode("browser-offline");
      printHelp("browser-offline");
      replayAbortRef.current?.abort();
      const ac = new AbortController();
      replayAbortRef.current = ac;
      await playDemoReplay({ writeln, abortSignal: ac.signal });
      writeln("\x1b[90mtype a question — runs in-browser with no network\x1b[0m");
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
