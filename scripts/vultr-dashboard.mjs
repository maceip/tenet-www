import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const userDataDir = '/tmp/vultr-chrome-copy';
const targetIp = '78.141.219.102';
const out = { targetIp, instance: null, api: null, steps: [] };

const browser = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome-canary',
  headless: true,
  viewport: { width: 1400, height: 900 },
});

const page = browser.pages()[0] || (await browser.newPage());

function log(step, extra = {}) {
  out.steps.push({ step, ...extra });
}

try {
  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  log('dashboard', { url: page.url(), title: await page.title() });

  const body = await page.locator('body').innerText();
  const ipIdx = body.indexOf(targetIp);
  if (ipIdx >= 0) {
    out.instance = {
      ip: targetIp,
      onDashboard: true,
      context: body.slice(Math.max(0, ipIdx - 120), ipIdx + 200).replace(/\s+/g, ' '),
    };
  }

  // Instances list
  await page.goto('https://my.vultr.com/', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const row = page.locator(`tr:has-text("${targetIp}"), [class*="instance"]:has-text("${targetIp}"), a:has-text("${targetIp}")`);
  if (await row.count()) {
    const rowText = await row.first().innerText().catch(() => '');
    out.instance = {
      ...out.instance,
      ip: targetIp,
      rowText: rowText.replace(/\s+/g, ' ').slice(0, 500),
    };
    await row.first().click().catch(() => {});
    await page.waitForTimeout(4000);
    log('instance-detail', { url: page.url(), title: await page.title() });
    const detail = await page.locator('body').innerText();
    out.instance.detailSnippet = detail.slice(0, 1500).replace(/\s+/g, ' ');
    for (const kw of ['running', 'stopped', 'active', 'pending', 'locked', 'suspended']) {
      if (detail.toLowerCase().includes(kw)) out.instance.statusHint = kw;
    }
  }

  // API token
  await page.goto('https://my.vultr.com/settings/#settingsapi', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(4000);
  log('api-page', { url: page.url(), title: await page.title() });

  const tokenName = `cursor-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
  const addBtn = page.getByRole('button', { name: /add|generate|create/i });
  if (await addBtn.count()) {
    await addBtn.first().click();
    await page.waitForTimeout(1500);
    const nameInput = page.locator('input').filter({ hasNot: page.locator('[type=password]') }).last();
    if (await nameInput.count()) await nameInput.fill(tokenName);
    const confirm = page.getByRole('button', { name: /add|create|generate|save|confirm/i });
    if (await confirm.count()) await confirm.last().click();
    await page.waitForTimeout(4000);

    const apiBody = await page.locator('body').innerText();
    const match = apiBody.match(/[A-Z0-9]{36,}/);
    if (match) {
      writeFileSync('/tmp/vultr-api-key.txt', match[0], { mode: 0o600 });
      out.api = { created: true, name: tokenName, preview: `${match[0].slice(0, 6)}…${match[0].slice(-4)}` };
    } else {
      out.api = { created: false, name: tokenName, note: 'clicked create but token not parsed from page' };
    }
  } else {
    out.api = { created: false, note: 'no add/generate button found' };
  }

  await page.screenshot({ path: '/tmp/vultr-dashboard.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-dashboard-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

// If API key created, query instance via Vultr API
if (existsSync('/tmp/vultr-api-key.txt')) {
  const key = readFileSync('/tmp/vultr-api-key.txt', 'utf8').trim();
  const res = await fetch('https://api.vultr.com/v2/instances', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  const inst = (data.instances || []).find((i) => i.main_ip === targetIp);
  const apiOut = { httpStatus: res.status, match: inst ? {
    id: inst.id,
    label: inst.label,
    status: inst.status,
    power_status: inst.power_status,
    server_status: inst.server_status,
    ram: inst.ram,
    disk: inst.disk,
    region: inst.region,
    hostname: inst.hostname,
  } : null, totalInstances: (data.instances || []).length };
  console.log('API_QUERY:', JSON.stringify(apiOut, null, 2));
}
