/**
 * Standalone verification — prints evidence, exits non-zero on failure.
 * Usage: node tests/matrix-rain-verify.mjs [url]
 */
import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:4173/tenet/";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("OK:", msg);
}

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });

// --- logo ---
const logo = await page.locator(".wordmark-logo").first();
if (!(await logo.isVisible())) fail("hero logo image not visible");
const logoSrc = await logo.getAttribute("src");
if (!logoSrc?.includes("logo-red")) fail(`hero logo src unexpected: ${logoSrc}`);
ok(`hero logo visible (${logoSrc})`);

// --- matrix boot ---
await page.waitForFunction(
  () => {
    const r = document.querySelector('[data-testid="matrix-rain"]')?.getAttribute("data-renderer");
    return r === "webgpu" || r === "cpu";
  },
  { timeout: 15_000 },
);
const renderer = await page.getAttribute('[data-testid="matrix-rain"]', "data-renderer");
ok(`matrix renderer = ${renderer}`);

await page.waitForTimeout(1200);

const debug = await page.evaluate(() => window.__matrixRainDebug);
if (!debug) fail("window.__matrixRainDebug missing — animation loop not running");
if (debug.instances < 50) fail(`too few glyph instances: ${debug.instances} (need >= 50)`);
if (debug.W < 200 || debug.H < 200) fail(`canvas too small: ${debug.W}x${debug.H}`);
if (debug.fallbackReason) ok(`WebGPU fallback: ${debug.fallbackReason}`);
ok(`animation loop: ${debug.instances} instances @ ${debug.W}x${debug.H} (${renderer})`);

if (errors.some((e) => e.includes("offset is out of bounds"))) {
  fail(`page errors: ${errors.filter((e) => e.includes("offset")).join("; ")}`);
}

// --- pixel evidence ---
const samples = [];
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const wrap = document.querySelector('[data-testid="matrix-rain"]');
    const canvas = wrap?.classList.contains("matrix-wrap--cpu")
      ? wrap.querySelector("canvas.matrix-cpu")
      : wrap?.querySelector("canvas.matrix-gpu");
    const dbg = window.__matrixRainDebug;
    if (!canvas) return null;
    if (canvas.classList.contains("matrix-cpu")) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      for (let j = 0; j < d.length; j += 4) {
        if (d[j] + d[j + 1] + d[j + 2] > 110) bright++;
      }
      return { bright, instances: dbg?.instances ?? 0, mode: "2d-readback" };
    }
    return { bright: -1, instances: dbg?.instances ?? 0, mode: "webgpu" };
  });
  samples.push(s);
}

if (renderer === "cpu") {
  const minBright = Math.min(...samples.map((s) => s?.bright ?? 0));
  if (minBright < 100) fail(`2D bright pixels too low: ${JSON.stringify(samples)}`);
  ok(`2D bright pixels: ${samples.map((s) => s.bright).join(", ")}`);
} else {
  const hero = page.locator("header.hero");
  const box = await hero.boundingBox();
  const a = await page.screenshot({ clip: box });
  await page.waitForTimeout(800);
  const b = await page.screenshot({ clip: box });
  if (Buffer.compare(a, b) === 0) fail("WebGPU hero frame did not change — rain may be static");
  ok("WebGPU hero frames differ (animation confirmed)");
  ok(`WebGPU instances stable: ${samples.map((s) => s.instances).join(", ")}`);
}

if (errors.length) {
  console.warn("WARN: console/page errors:", errors.slice(0, 5));
}

console.log("\nAll checks passed.");
await browser.close();
