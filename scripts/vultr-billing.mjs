import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const userDataDir = '/tmp/vultr-chrome-copy';
const targetIp = '78.141.219.102';
const out = { targetIp, billing: {}, instance: null, api: null, steps: [] };

const browser = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome-canary',
  headless: true,
  viewport: { width: 1440, height: 1000 },
  args: ['--no-first-run'],
});

const page = browser.pages()[0] || (await browser.newPage());

async function bodyText() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

function log(step, extra = {}) {
  out.steps.push({ step, ...extra });
}

try {
  // Billing first — user suspects suspension for non-payment
  await page.goto('https://my.vultr.com/billing/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const billingText = await bodyText();
  log('billing', {
    url: page.url(),
    title: await page.title(),
    snippet: billingText.slice(0, 2000),
  });
  out.billing.snippet = billingText.slice(0, 2500);
  for (const kw of [
    'past due',
    'overdue',
    'suspended',
    'payment required',
    'pay now',
    'balance',
    'invoice',
    'unpaid',
    'account locked',
    'delinquent',
  ]) {
    if (billingText.toLowerCase().includes(kw)) out.billing.flags = [...(out.billing.flags || []), kw];
  }

  // Make payment / PayPal
  await page.goto('https://my.vultr.com/billing/#billingmakepayment', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(4000);
  const payText = await bodyText();
  log('make-payment', { url: page.url(), snippet: payText.slice(0, 1500) });
  out.billing.makePaymentSnippet = payText.slice(0, 2000);

  const paypal = page.getByText(/paypal/i);
  if (await paypal.count()) {
    out.billing.paypalOptionVisible = true;
    await paypal.first().click().catch(() => {});
    await page.waitForTimeout(3000);
    log('paypal-click', { url: page.url(), title: await page.title() });
    out.billing.afterPaypalClick = (await bodyText()).slice(0, 1500);
  }

  // Instances
  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const dash = await bodyText();
  log('dashboard', { url: page.url(), title: await page.title() });
  if (dash.includes(targetIp)) {
    out.instance = { ip: targetIp, onDashboard: true, context: dash.slice(dash.indexOf(targetIp) - 80, dash.indexOf(targetIp) + 180) };
  }

  // API token
  await page.goto('https://my.vultr.com/settings/#settingsapi', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(4000);
  const tokenName = `cursor-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
  const addBtn = page.getByRole('button', { name: /add|generate|create/i });
  if (await addBtn.count()) {
    await addBtn.first().click();
    await page.waitForTimeout(1500);
    const inputs = page.locator('input:not([type=password])');
    if (await inputs.count()) await inputs.last().fill(tokenName);
    const confirm = page.getByRole('button', { name: /add|create|generate|save|confirm/i });
    if (await confirm.count()) await confirm.last().click();
    await page.waitForTimeout(4000);
    const apiBody = await bodyText();
    const match = apiBody.match(/[A-Z0-9]{36,}/);
    if (match) {
      writeFileSync('/tmp/vultr-api-key.txt', match[0], { mode: 0o600 });
      out.api = { created: true, name: tokenName, preview: `${match[0].slice(0, 6)}…${match[0].slice(-4)}` };
    }
  }

  await page.screenshot({ path: '/tmp/vultr-billing.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-billing-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

if (existsSync('/tmp/vultr-api-key.txt')) {
  const key = readFileSync('/tmp/vultr-api-key.txt', 'utf8').trim();
  const res = await fetch('https://api.vultr.com/v2/instances', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  const inst = (data.instances || []).find((i) => i.main_ip === targetIp);
  const acct = await fetch('https://api.vultr.com/v2/account', {
    headers: { Authorization: `Bearer ${key}` },
  }).then((r) => r.json()).catch(() => ({}));
  console.log(
    'API:',
    JSON.stringify(
      {
        httpStatus: res.status,
        account: acct.account || acct,
        instance: inst
          ? {
              id: inst.id,
              label: inst.label,
              status: inst.status,
              power_status: inst.power_status,
              server_status: inst.server_status,
              main_ip: inst.main_ip,
            }
          : null,
      },
      null,
      2
    )
  );
}
