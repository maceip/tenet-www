import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const targetIp = '78.141.219.102';
const out = { targetIp, billing: {}, instance: null, api: null, paypal: {}, steps: [] };

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = await context.newPage();

async function text() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

function log(step, extra = {}) {
  out.steps.push({ step, ...extra });
}

try {
  for (const [name, url] of [
    ['billing', 'https://console.vultr.com/billing'],
    ['billing-pay', 'https://console.vultr.com/billing/pay'],
    ['billing-history', 'https://console.vultr.com/billing/history'],
    ['compute', 'https://console.vultr.com/compute'],
    ['instances', 'https://console.vultr.com/deploy'],
  ]) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const t = await text();
    log(name, { url: page.url(), title: await page.title(), snippet: t.slice(0, 1200) });
    if (name.startsWith('billing')) {
      out.billing[name] = t.slice(0, 2500);
      for (const kw of ['past due', 'overdue', 'suspended', 'pay now', 'balance', 'unpaid', 'payment', 'invoice', 'locked', 'delinquent', 'outstanding', '$', 'paypal']) {
        if (t.toLowerCase().includes(kw)) out.billing.flags = [...new Set([...(out.billing.flags || []), kw])];
      }
    }
    if (t.includes(targetIp)) {
      const i = t.indexOf(targetIp);
      out.instance = { ip: targetIp, foundOn: name, context: t.slice(Math.max(0, i - 100), i + 300) };
    }
  }

  const paypal = page.getByText(/paypal/i);
  if (await paypal.count()) {
    out.paypal.visible = true;
    await paypal.first().click().catch(() => {});
    await page.waitForTimeout(2000);
    out.paypal.afterSelect = (await text()).slice(0, 2000);
  }

  await page.goto('https://console.vultr.com/user/apiaccess/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  log('api-page', { url: page.url(), title: await page.title() });

  const addBtn = page.getByRole('button', { name: /add|generate|create/i });
  if (await addBtn.count()) {
    await addBtn.first().click();
    await page.waitForTimeout(1500);
    const nameInput = page.locator('input[type="text"], input[name*="name" i], input[placeholder*="name" i]').first();
    const tokenName = `cursor-${Date.now()}`;
    if (await nameInput.count()) await nameInput.fill(tokenName);
    const confirm = page.getByRole('button', { name: /add|create|generate|save|confirm/i });
    if (await confirm.count()) await confirm.last().click();
    await page.waitForTimeout(4000);
    const apiBody = await text();
    const match = apiBody.match(/[A-Z0-9]{36,}/);
    if (match) {
      writeFileSync('/tmp/vultr-api-key.txt', match[0], { mode: 0o600 });
      out.api = { created: true, name: tokenName, preview: `${match[0].slice(0, 6)}…${match[0].slice(-4)}` };
    } else {
      out.api = { created: false, note: 'no token parsed', snippet: apiBody.slice(0, 800) };
    }
  }

  await page.screenshot({ path: '/tmp/vultr-cdp2.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-cdp2-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await page.close().catch(() => {});
}

if (existsSync('/tmp/vultr-api-key.txt')) {
  const key = readFileSync('/tmp/vultr-api-key.txt', 'utf8').trim();
  const [acctRes, instRes] = await Promise.all([
    fetch('https://api.vultr.com/v2/account', { headers: { Authorization: `Bearer ${key}` } }),
    fetch('https://api.vultr.com/v2/instances', { headers: { Authorization: `Bearer ${key}` } }),
  ]);
  const acct = await acctRes.json();
  const instData = await instRes.json();
  const inst = (instData.instances || []).find((i) => i.main_ip === targetIp);
  console.log('API_ACCOUNT:', JSON.stringify({ status: acctRes.status, account: acct.account || acct }, null, 2));
  console.log('API_INSTANCE:', JSON.stringify({ status: instRes.status, inst, total: (instData.instances || []).length }, null, 2));
}
