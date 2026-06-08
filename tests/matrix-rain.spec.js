import { test, expect } from "@playwright/test";

async function matrixPixels(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas.matrix");
    if (!c) return { found: false };
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    let red = 0;
    let green = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a > 20 && r + g + b > 60) lit++;
      if (r > 120 && r > g + 25 && r > b + 25) red++;
      if (g > 120 && g > r + 25 && g > b + 25) green++;
    }
    return { found: true, lit, red, green, w: c.width, h: c.height };
  });
}

async function heroFrame(page) {
  const hero = page.locator("header.hero");
  await expect(hero).toBeVisible();
  return hero.screenshot();
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("tenet-theme", t); } catch { /* ignore */ }
  }, theme);
}

test.describe("matrix rain", () => {
  test("dark: red falling glyphs render + animate (not green)", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("tenet-theme", "dark");
    });
    await page.goto("/");
    await page.waitForSelector("canvas.matrix");
    await page.waitForTimeout(2200);

    const px = await matrixPixels(page);
    expect(px.found).toBe(true);
    expect(px.lit).toBeGreaterThan(500);        // glyphs are drawing
    expect(px.red).toBeGreaterThan(200);        // it's RED matrix
    expect(px.red).toBeGreaterThan(px.green * 3); // red, not classic green

    const f1 = await heroFrame(page);
    await page.waitForTimeout(700);
    const f2 = await heroFrame(page);
    expect(Buffer.compare(f1, f2)).not.toBe(0); // animating
  });

  test("light: white glyphs + red glow render + animate", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.dataset.theme = "light";
      localStorage.setItem("tenet-theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("canvas.matrix");
    await page.waitForTimeout(2200);

    const px = await matrixPixels(page);
    expect(px.found).toBe(true);
    expect(px.lit).toBeGreaterThan(500);   // something is drawing on the white hero
    expect(px.red).toBeGreaterThan(50);    // the red glow is present

    const f1 = await heroFrame(page);
    await page.waitForTimeout(700);
    const f2 = await heroFrame(page);
    expect(Buffer.compare(f1, f2)).not.toBe(0);
  });
});

test.describe("theme + logo", () => {
  test("hero wordmark anchor + glyph logo region", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "dark");
    await page.waitForTimeout(2200);
    const anchor = page.locator(".matrix-logo-anchor");
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveAttribute("aria-label", "TENET");

    const logoPixels = await page.evaluate(() => {
      const anchor = document.querySelector(".matrix-logo-anchor");
      const canvas = document.querySelector("canvas.matrix");
      if (!anchor || !canvas) return { ok: false };
      const ar = anchor.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const dpr = canvas.width / cr.width;
      const x0 = Math.floor((ar.left - cr.left) * dpr);
      const y0 = Math.floor((ar.top - cr.top) * dpr);
      const w = Math.floor(ar.width * dpr);
      const h = Math.floor(ar.height * dpr);
      const data = ctx.getImageData(x0, y0, w, h).data;
      let red = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 30 && r > 100 && r > g + 20) red++;
      }
      return { ok: true, red };
    });
    expect(logoPixels.ok).toBe(true);
    expect(logoPixels.red).toBeGreaterThan(200);
  });

  test("dark nav logo has a transparent background (no white box)", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "dark");
    await page.waitForTimeout(250);
    const cornerAlpha = await page.evaluate(async () => {
      const img = document.querySelector(".tenet-logo--nav");
      const blob = await (await fetch(img.src)).blob();
      const bmp = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext("2d");
      cx.drawImage(bmp, 0, 0);
      const corners = [[2, 2], [bmp.width - 3, 2], [2, bmp.height - 3]];
      return corners.map(([x, y]) => cx.getImageData(x, y, 1, 1).data[3]);
    });
    for (const a of cornerAlpha) expect(a).toBeLessThan(20);
  });

  test("light nav uses punk navbar logo spanning nav height", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");
    await page.waitForTimeout(250);
    const logo = page.locator(".tenet-logo--nav");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /logo-navbar-light/);
    await expect(logo).toHaveClass(/tenet-logo--navbar-light/);

    const dims = await page.evaluate(() => {
      const nav = document.querySelector(".nav");
      const img = document.querySelector(".tenet-logo--nav");
      const nr = nav.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      return { navH: nr.height, imgH: ir.height };
    });
    expect(dims.imgH).toBeGreaterThanOrEqual(dims.navH * 0.9);
  });

  test("theme toggle persists on reload", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
