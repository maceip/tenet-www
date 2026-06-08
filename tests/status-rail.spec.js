import { test, expect } from "@playwright/test";

const UPTIME_SLOTS = 30;

test.describe("status rail histogram", () => {
  test("renders 30 visible uptime chips", async ({ page }) => {
    await page.route("**/network-status.json*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema: "tenet.www_network_status.2026-06",
          matcher: {
            label: "bootstrap matcher",
            host: "d51d8afc9668.aeon.site",
            status: "online",
            tee: "attested nitro tee",
          },
        }),
      });
    });

    await page.goto("/");
    const chips = page.locator(".toprail-hist .rail-chip");
    await expect(chips).toHaveCount(UPTIME_SLOTS);

    const height = await chips.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(4);

    const gaps = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".toprail-hist .rail-chip")];
      if (nodes.length < 2) return 0;
      const a = nodes[0].getBoundingClientRect();
      const b = nodes[1].getBoundingClientRect();
      return b.left - a.right;
    });
    expect(gaps).toBeGreaterThanOrEqual(2);

    await expect(page.locator(".toprail-hist .rail-chip.online").last()).toBeVisible();
  });
});
