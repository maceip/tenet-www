import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const targetIp = '78.141.219.102';
const out = { targetIp, billing: {}, instance: null, api: null, paypal: {}, steps: [] };

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0] || (await browser.newContext());
const page = context.pages()[0] || (await context.newPage());

async function text() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

function log(step, extra = {}) {
  out.steps.push({ step, ...extra });
}

try {
  await page.goto('https://my.vultr.com/billing/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  const billingText = await text();
  const loggedIn = !/welcome back|log in/i.test(billingText) && !page.url().includes('login');
  log('billing', { url: page.url(), title: await page.title(), loggedIn });
  out.billing.snippet = billingText.slice(0, 3500);
  for (const kw of ['past due', 'overdue', 'suspended', 'pay now', 'balance', 'unpaid', 'payment due', 'invoice', 'locked', 'delinquent', 'account suspended', '$']) {
    if (billingText.toLowerCase().includes(kw)) out.billing.flags = [...(out.billing.flags || []), kw];
  }

  await page.goto('https://my.vultr.com/billing/#billingmakepayment', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const payText = await text();
  log('make-payment', { url: page.url(), title: await page.title() });
  out.billing.makePayment = payText.slice(0, 3000);

  const paypal = page.getByText(/paypal/i);
  if (await paypal.count()) {
    out.paypal.visible = true;
    await paypal.first().click().catch(() => {});
    await page.waitForTimeout(2000);
    out.paypal.afterSelect = (await text()).slice(0, 2000);
    const payBtn = page.getByRole('button', { name: /pay|submit|continue|make payment/i });
    out.paypal.payButtonTexts = await payBtn.allTextContents().catch(() => []);
  }

  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const dash = await text();
  log('dashboard', { url: page.url(), title: await page.title() });
  if (dash.includes(targetIp)) {
    const i = dash.indexOf(targetIp);
    out.instance = { ip: targetIp, context: dash.slice(Math.max(0, i - 120), i + 280) };
  }

  await page.goto('https://my.vultr.com/settings/#settingsapi', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const addBtn = page.getByRole('button', { name: /add|generate|create/i });
  if (await addBtn.count()) {
    const tokenName = `cursor-${Date.now()}`;
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

  await page.screenshot({ path: '/tmp/vultr-cdp.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-cdp-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
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
  console.log('API_INSTANCE:', JSON.stringify({ status: instRes.status, inst }, null, 2));
}
