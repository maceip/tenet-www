import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const email = 'rex@stare.network';
const targetIp = '78.141.219.102';

function keychainPassword() {
  return execSync(
    `security find-internet-password -s vultr.com -a ${email} -w`,
    { encoding: 'utf8' }
  ).trim();
}

function redact(s) {
  if (!s) return s;
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const password = keychainPassword();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const out = { steps: [], instance: null, apiKeyCreated: false };

try {
  await page.goto('https://console.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const accept = page.getByRole('button', { name: /accept/i });
  if (await accept.count()) await accept.first().click();

  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForTimeout(8000);

  out.steps.push({ step: 'login', url: page.url(), title: await page.title() });

  if (page.url().includes('login') || (await page.getByLabel(/email/i).count())) {
    throw new Error('login_failed_still_on_login_page');
  }

  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  out.steps.push({ step: 'dashboard', url: page.url(), title: await page.title() });

  const body = await page.locator('body').innerText();
  if (body.includes(targetIp)) {
    out.instance = { ip: targetIp, visibleOnDashboard: true };
  }

  await page.goto('https://my.vultr.com/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Try instances list API page fallback
  const links = await page.locator(`text=${targetIp}`).allTextContents().catch(() => []);
  if (links.length) out.instance = { ip: targetIp, matches: links.length };

  await page.goto('https://my.vultr.com/settings/#settingsapi', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(4000);
  out.steps.push({ step: 'api-settings', url: page.url(), title: await page.title() });

  const add = page.getByRole('button', { name: /add|generate|create/i });
  if (await add.count()) {
    await add.first().click();
    await page.waitForTimeout(2000);

    const nameInput = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
    if (await nameInput.count()) await nameInput.fill(`cursor-${new Date().toISOString().slice(0, 10)}`);

    const confirm = page.getByRole('button', { name: /add|create|generate|save/i });
    if (await confirm.count()) await confirm.last().click();
    await page.waitForTimeout(3000);

    const apiText = await page.locator('body').innerText();
    const tokenMatch = apiText.match(/[A-Z0-9]{20,}/);
    if (tokenMatch) {
      out.apiKeyCreated = true;
      out.apiKeyPreview = redact(tokenMatch[0]);
      writeFileSync('/tmp/vultr-api-key.txt', tokenMatch[0], { mode: 0o600 });
    }
  }

  await page.screenshot({ path: '/tmp/vultr-final.png', fullPage: true });
} catch (err) {
  out.error = err.message;
  await page.screenshot({ path: '/tmp/vultr-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
