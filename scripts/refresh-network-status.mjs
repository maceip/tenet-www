#!/usr/bin/env node
/**
 * Probe live TENET network endpoints and write public/network-status.json.
 * Run before build/deploy (and optionally from a server cron every 1–5 min).
 *
 * Sources: public/matcher.json, optional JOIN_PACK env or ../TENET/config/join-pack.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const outPath = join(publicDir, "network-status.json");

const JOIN_PACK = process.env.JOIN_PACK
  || (existsSync(join(root, "../TENET/config/join-pack.json"))
    ? join(root, "../TENET/config/join-pack.json")
    : null);
const NETWORK_CFG = join(publicDir, "network.json");

async function probeHealthz(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) return "unreachable";
    const body = await r.json().catch(() => null);
    return body?.ok === true ? "online" : "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expertCountFromJoinPack(pack) {
  const records = pack?.control_bootstrap?.records || [];
  let count = 0;
  for (const signed of records) {
    const key = signed?.record?.key || "";
    if (key.startsWith("expert/") && key.endsWith("/descriptor")) count += 1;
  }
  if (count > 0) return count;
  const members = pack?.control_bootstrap?.records
    ?.find((s) => s?.record?.key?.includes("pool/") && s?.record?.record_type === "pool_descriptor")
    ?.record?.value?.member_capability_refs;
  if (Array.isArray(members) && members.length) return members.length;
  return 2;
}

async function main() {
  const matcherCfg = existsSync(join(publicDir, "matcher.json"))
    ? loadJson(join(publicDir, "matcher.json"))
    : null;
  const pack = JOIN_PACK && existsSync(JOIN_PACK) ? loadJson(JOIN_PACK) : null;
  const networkCfg = existsSync(NETWORK_CFG) ? loadJson(NETWORK_CFG) : null;

  const matcherUrl = matcherCfg?.url || pack?.matcher?.url || "";
  const healthz = matcherCfg?.healthz || (matcherUrl ? `${matcherUrl.replace(/\/$/, "")}/healthz` : "");
  let host = "matcher pending deploy";
  try {
    if (healthz) host = new URL(healthz).hostname;
  } catch {
    /* keep default */
  }

  const matcherStatus = healthz ? await probeHealthz(healthz) : "unreachable";

  const relayFromPack = pack?.reachability_relay;
  const relayFromCfg = networkCfg?.relay;
  const relayHost = relayFromPack
    ? `${relayFromPack.host}:${relayFromPack.port}`
    : relayFromCfg?.host || null;

  const body = {
    schema: "tenet.www_network_status.2026-06",
    generated_at: new Date().toISOString(),
    matcher: {
      id: "bootstrap",
      label: "network",
      url: matcherUrl || null,
      host,
      healthz: healthz || null,
      status: matcherStatus,
      tee: "attested nitro tee",
    },
    relay: relayHost
      ? {
          id: relayFromPack?.relay_id || relayFromCfg?.id || "reach",
          host: relayHost,
          status: "unknown",
          note: "UDP reachability relay — listed from network join pack",
        }
      : null,
    experts: {
      pool: pack?.discovery?.default_pool || networkCfg?.experts?.pool || "alpha.experts~tenet",
      count: pack ? expertCountFromJoinPack(pack) : networkCfg?.experts?.count ?? null,
      status: matcherStatus === "online" ? "reachable" : "unknown",
    },
  };

  writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`[refresh-network-status] matcher=${matcherStatus} host=${host} -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
