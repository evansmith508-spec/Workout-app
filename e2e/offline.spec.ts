import { expect, test } from "@playwright/test";

// Section 2: works fully offline after the first load.
test("works offline after the first load", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kilograms (kg)" }).click();
  await expect(page.locator("header.hero h1")).toContainText("Today");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Make sure the service worker controls the page before going offline.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("header.hero h1")).toContainText("Today");
  await page.getByRole("button", { name: /Progress/ }).click(); // lazy-loaded charts chunk
  await expect(page.locator("header.hero h1")).toHaveText("Progress");
  await context.setOffline(false);
});
