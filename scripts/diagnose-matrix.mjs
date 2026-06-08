import { chromium } from "playwright";

const URL = process.env.MATRIX_URL || "http://127.0.0.1:5173/tenet/";

async function sample(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.matrix");
    if (!canvas) return { error: "no canvas" };
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    let bright = 0;
    let max = 0;
    let readError = null;
    if (ctx) {
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i] + data[i + 1] + data[i + 2];
        max = Math.max(max, v);
        if (v > 100) bright++;
      }
    } else {
      readError = "no 2d context";
    }
    return { w, h, bright, max, readError, webgpu: !!navigator.gpu };
  });
}

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
const samples = [];
for (const ms of [300, 800, 1500, 2500]) {
  await page.waitForTimeout(ms - (samples.at(-1)?.t || 0));
  samples.push({ t: ms, ...(await sample(page)) });
}

console.log(JSON.stringify({ samples, logs }, null, 2));
await browser.close();
