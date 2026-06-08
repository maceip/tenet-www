import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDir = path.join(
  os.homedir(),
  'Library/Application Support/Google/Chrome Canary'
);

const browser = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome-canary',
  headless: false,
  viewport: { width: 1400, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = browser.pages()[0] || (await browser.newPage());

async function snap(label) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  console.log(`\n=== ${label} ===`);
  console.log('url:', url);
  console.log('title:', title);
  const text = await page.locator('body').innerText().catch(() => '');
  console.log('body:', text.slice(0, 2500).replace(/\s+/g, ' ').trim());
}

try {
  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await snap('vultr-home');

  if (page.url().includes('login') || (await page.locator('input[type=email], input[name=email]').count()) > 0) {
    console.log('\nSTATUS: not logged in (login page)');
  } else if (await page.locator('text=Instances').count()) {
    console.log('\nSTATUS: likely logged in');
    await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await snap('dashboard');

    const ip = '78.141.219.102';
    const row = page.locator(`text=${ip}`);
    if (await row.count()) {
      console.log(`\nFOUND instance IP ${ip} on dashboard`);
    } else {
      console.log(`\nInstance IP ${ip} not visible on first screen`);
    }

    await page.goto('https://my.vultr.com/settings/#settingsapi', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(4000);
    await snap('api-settings');

    const addBtn = page.locator('text=/add|generate|create/i').first();
    if (await addBtn.count()) {
      console.log('\nAPI page has add/generate control — manual confirm may be needed for 2FA');
    }
  }

  await page.screenshot({ path: '/tmp/vultr-screenshot.png', fullPage: true });
  console.log('\nScreenshot: /tmp/vultr-screenshot.png');
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await browser.close();
}
