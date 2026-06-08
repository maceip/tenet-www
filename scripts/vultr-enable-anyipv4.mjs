import WebSocket from 'ws';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TARGET = '78.141.219.102';
const TOKEN = readFileSync('/tmp/vultr-api-key.txt', 'utf8').trim();

const target = (await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json())).find(
  (t) => t.type === 'page' && t.url.includes('apiaccess')
);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
    setTimeout(() => pending.has(msgId) && (pending.delete(msgId), reject(new Error('timeout'))), 30000);
  });
const eval_ = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toggle = await eval_(`(() => {
  const trs = [...document.querySelectorAll('tr')];
  const tr = trs.find(t => (t.textContent||'').includes('Any IPv4'));
  if (!tr) return 'no_row';
  const btn = tr.querySelector('button');
  if (btn) { btn.click(); return 'clicked_power'; }
  return tr.innerText.slice(0,150);
})()`);

await sleep(4000);

const headers = { Authorization: `Bearer ${TOKEN}` };
const listRes = await fetch('https://api.vultr.com/v2/instances', { headers });
const list = await listRes.json();
const inst = list.instances?.find((i) => i.main_ip === TARGET);

let reboot = null;
if (inst && listRes.ok && (inst.power_status !== 'running' || inst.server_status !== 'ok')) {
  reboot = (await fetch(`https://api.vultr.com/v2/instances/${inst.id}/reboot`, { method: 'POST', headers })).status;
}

const ports = {};
for (const port of [22, 443]) {
  try {
    execSync(`nc -z -G 5 ${TARGET} ${port}`, { stdio: 'ignore' });
    ports[port] = 'open';
  } catch {
    ports[port] = 'timeout';
  }
}

console.log(JSON.stringify({
  toggle,
  apiStatus: listRes.status,
  apiError: list.error,
  diagnosis: {
    instances: list.instances?.map(i => ({ ip: i.main_ip, label: i.label, power: i.power_status, server: i.server_status })),
    target: inst || null,
    portsFromMac: ports,
    reboot,
  }
}, null, 2));

ws.close();
