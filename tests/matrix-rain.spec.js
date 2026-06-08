import { test, expect } from "@playwright/test";

async function brightPixelCount(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('[data-testid="matrix-rain"]');
    const canvas = wrap?.classList.contains("matrix-wrap--cpu")
      ? wrap.querySelector("canvas.matrix-cpu")
      : wrap?.querySelector("canvas.matrix-gpu");
    if (!canvas) return { bright: -1, renderer: null, instances: 0, red: 0 };

    const debug = window.__matrixRainDebug;
    const renderer = wrap?.getAttribute("data-renderer");

    if (canvas.classList.contains("matrix-cpu")) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return { bright: -1, renderer, instances: debug?.instances ?? 0, red: 0 };
      const { width: w, height: h } = canvas;
      const data = ctx.getImageData(0, 0, w, h).data;
      let bright = 0;
      let red = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r + g + b > 110) bright++;
        if (r > 140 && r > g + 30 && r > b + 30) red++;
      }
      return { bright, renderer, instances: debug?.instances ?? 0, red };
    }

    return { bright: -1, renderer, instances: debug?.instances ?? 0, red: 0, webgpu: true };
  });
}

async function heroFrame(page) {
  const hero = page.locator("header.hero");
  await expect(hero).toBeVisible();
  const box = await hero.boundingBox();
  return page.screenshot({ clip: box });
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("tenet-theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
}

test.describe("matrix rain", () => {
  test("2D fallback draws falling glyphs (dark)", async ({ page }) => {
    await page.addInitScript(() => {
      delete navigator.gpu;
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("tenet-theme", "dark");
    });
    await page.goto("/");
    await page.waitForSelector('[data-testid="matrix-rain"][data-renderer="cpu"]', { timeout: 10_000 });

    await page.waitForTimeout(900);
    const a = await brightPixelCount(page);
    expect(a.instances).toBeGreaterThan(20);
    expect(a.bright).toBeGreaterThan(80);
    expect(a.red).toBeGreaterThan(20);

    await page.waitForTimeout(700);
    const b = await brightPixelCount(page);
    expect(b.instances).toBeGreaterThan(20);
    expect(b.bright).toBeGreaterThan(80);
  });

  test("2D fallback animates in light mode", async ({ page }) => {
    await page.addInitScript(() => {
      delete navigator.gpu;
      document.documentElement.dataset.theme = "light";
      localStorage.setItem("tenet-theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector('[data-testid="matrix-rain"][data-renderer="cpu"]', { timeout: 10_000 });

    await page.waitForTimeout(900);
    const a = await brightPixelCount(page);
    expect(a.instances).toBeGreaterThan(50);
    expect(a.bright).toBeGreaterThan(50);

    await page.waitForTimeout(700);
    const b = await brightPixelCount(page);
    expect(b.instances).toBeGreaterThan(50);
    expect(b.bright).toBeGreaterThan(50);
  });

  test("WebGPU path animates without runtime errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page.waitForFunction(() => {
      const r = document.querySelector('[data-testid="matrix-rain"]')?.getAttribute("data-renderer");
      return r === "webgpu" || r === "cpu";
    });

    const renderer = await page.getAttribute('[data-testid="matrix-rain"]', "data-renderer");
    await page.waitForTimeout(1500);

    const debug = await page.evaluate(() => window.__matrixRainDebug);
    expect(debug?.instances ?? 0).toBeGreaterThan(20);
    expect(errors).not.toContain("offset is out of bounds");

    if (renderer === "webgpu") {
      const frameA = await heroFrame(page);
      await page.waitForTimeout(800);
      const frameB = await heroFrame(page);
      expect(Buffer.compare(frameA, frameB)).not.toBe(0);
    } else {
      const px = await brightPixelCount(page);
      expect(px.bright).toBeGreaterThan(80);
    }
  });
});

test.describe("theme + logo", () => {
  test("hero logo swaps with theme", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "dark");
    await page.waitForTimeout(200);

    const darkLogo = page.locator('[data-testid="tenet-logo-hero"]');
    await expect(darkLogo).toBeVisible();
    await expect(darkLogo).toHaveAttribute("src", /logo-red/);

    await setTheme(page, "light");
    await page.waitForTimeout(200);
    await expect(darkLogo).toHaveAttribute("src", /logo-black/);
  });

  test("theme toggle persists on reload", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
