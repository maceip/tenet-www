import { test, expect } from "@playwright/test";

test.describe("demo webshell", () => {
  test("mounts xterm in demo section", async ({ page }) => {
    await page.goto("/#demo");
    await expect(page.locator(".term-xterm")).toBeVisible();
    await expect(page.locator(".term-xterm .xterm")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".term-title")).toContainText("webshell");
  });

  test("offline replay prints berlin scenario text", async ({ page }) => {
    await page.goto("/#demo");
    await page.waitForTimeout(9000);
    const text = await page.locator(".term-xterm .xterm-screen").innerText();
    expect(text.toLowerCase()).toContain("airbnb in berlin");
    expect(text.toLowerCase()).toContain("decision made");
  });
});
