import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome Canary');
const targetIp = '78.141.219.102';
const out = { targetIp, billing: {}, instance: null, api: null, paypal: {}, steps: [] };

const browser = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome-canary',
  headless: true,
  viewport: { width: 1440, height: 1000 },
});

const page = browser.pages()[0] || (await browser.newPage());

async function text() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

function log(step, extra = {}) {
  out.steps.push({ step, ...extra });
}

try {
  await page.goto('https://my.vultr.com/billing/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const billingText = await text();
  log('billing', { url: page.url(), title: await page.title(), loggedIn: !page.url().includes('login') && !billingText.includes('Welcome back') });
  out.billing.snippet = billingText.slice(0, 3000);
  for (const kw of ['past due', 'overdue', 'suspended', 'pay now', 'balance', 'unpaid', 'payment', 'invoice', 'locked', 'delinquent', '$']) {
    if (billingText.toLowerCase().includes(kw)) out.billing.flags = [...(out.billing.flags || []), kw];
  }

  await page.goto('https://my.vultr.com/billing/#billingmakepayment', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const payText = await text();
  log('make-payment', { url: page.url() });
  out.billing.makePayment = payText.slice(0, 2500);

  const paypalRadio = page.locator('text=/paypal/i').first();
  const paypalLabel = page.getByText(/paypal/i);
  if (await paypalLabel.count()) {
    out.paypal.visible = true;
    await paypalLabel.first().click().catch(() => {});
    await page.waitForTimeout(2000);
    const payBtn = page.getByRole('button', { name: /pay|submit|continue|make payment/i });
    if (await payBtn.count()) {
      out.paypal.payButtonCount = await payBtn.count();
      // Do not auto-submit PayPal — capture state only unless amount is clear
      out.paypal.payButtons = await payBtn.allTextContents();
    }
  }

  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const dash = await text();
  log('dashboard', { url: page.url(), title: await page.title() });
  if (dash.includes(targetIp)) {
    const i = dash.indexOf(targetIp);
    out.instance = { ip: targetIp, context: dash.slice(Math.max(0, i - 100), i + 250) };
  }

  await page.goto('https://my.vultr.com/settings/#settingsapi', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const tokenName = `cursor-${Date.now()}`;
  const addBtn = page.getByRole('button', { name: /add|generate|create/i });
  if (await addBtn.count()) {
    await addBtn.first().click();
    await page.waitForTimeout(1500);
    const inputs = page.locator('input:not([type=password])');
    if (await inputs.count()) await inputs.last().fill(tokenName);
    const confirm = page.getByRole('button', { name: /add|create|generate|save|confirm/i });
    if (await confirm.count()) await confirm.last().click();
    await page.waitForTimeout(4000);
    const apiBody = await text();
    const match = apiBody.match(/[A-Z0-9]{36,}/);
    if (match) {
      writeFileSync('/tmp/vultr-api-key.txt', match[0], { mode: 0o600 });
      out.api = { created: true, preview: `${match[0].slice(0, 6)}…${match[0].slice(-4)}` };
    }
  }

  await page.screenshot({ path: '/tmp/vultr-full.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-full-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

if (existsSync('/tmp/vultr-api-key.txt')) {
  const key = readFileSync('/tmp/vultr-api-key.txt', 'utf8').trim();
  for (const ep of ['https://api.vultr.com/v2/account', 'https://api.vultr.com/v2/instances']) {
    const res = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
    const data = await res.json();
    if (ep.includes('account')) {
      console.log('ACCOUNT:', JSON.stringify({ status: res.status, account: data.account || data }, null, 2));
    } else {
      const inst = (data.instances || []).find((i) => i.main_ip === targetIp);
      console.log('INSTANCE:', JSON.stringify({ status: res.status, inst, count: (data.instances || []).length }, null, 2));
    }
  }
}
