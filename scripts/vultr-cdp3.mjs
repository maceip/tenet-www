import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const targetIp = '78.141.219.102';
const out = { billing: {}, instance: null, paypal: {}, api: {} };

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = await browser.contexts()[0].newPage();

async function text() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

try {
  await page.goto('https://console.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  out.home = { url: page.url(), snippet: (await text()).slice(0, 2000) };

  const billingLink = page.getByRole('link', { name: /billing/i });
  if (await billingLink.count()) {
    await billingLink.first().click();
    await page.waitForTimeout(5000);
  } else {
    await page.goto('https://my.vultr.com/billing/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);
  }
  const bill = await text();
  out.billing = { url: page.url(), title: await page.title(), snippet: bill.slice(0, 4000) };
  for (const kw of ['past due', 'overdue', 'suspended', 'pay now', 'balance', 'unpaid', 'payment', 'invoice', 'locked', 'delinquent', 'outstanding', 'credit', 'paypal', '$']) {
    if (bill.toLowerCase().includes(kw)) out.billing.flags = [...new Set([...(out.billing.flags || []), kw])];
  }

  const payNow = page.getByRole('button', { name: /pay now|make payment|add funds/i });
  const payLink = page.getByRole('link', { name: /pay now|make payment|add funds/i });
  if (await payNow.count()) {
    out.billing.payControl = 'button';
    await payNow.first().click();
    await page.waitForTimeout(4000);
    out.billing.afterPayClick = (await text()).slice(0, 2500);
  } else if (await payLink.count()) {
    out.billing.payControl = 'link';
    await payLink.first().click();
    await page.waitForTimeout(4000);
    out.billing.afterPayClick = (await text()).slice(0, 2500);
  }

  const paypal = page.getByText(/paypal/i);
  if (await paypal.count()) {
    out.paypal.visible = true;
    await paypal.first().click().catch(() => {});
    await page.waitForTimeout(3000);
    out.paypal.snippet = (await text()).slice(0, 2500);
    const cont = page.getByRole('button', { name: /continue|pay|submit/i });
    out.paypal.continueButtons = await cont.allTextContents().catch(() => []);
  }

  await page.goto('https://my.vultr.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  const dash = await text();
  out.dashboard = { url: page.url(), snippet: dash.slice(0, 3000) };
  if (dash.includes(targetIp)) {
    const i = dash.indexOf(targetIp);
    out.instance = { ip: targetIp, context: dash.slice(Math.max(0, i - 120), i + 320) };
  }

  await page.goto('https://console.vultr.com/user/apiaccess/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  out.api.page = (await text()).slice(0, 1500);

  await page.screenshot({ path: '/tmp/vultr-cdp3.png', fullPage: true });
} catch (e) {
  out.error = e.message;
  await page.screenshot({ path: '/tmp/vultr-cdp3-error.png', fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(out, null, 2));
  await page.close().catch(() => {});
}
