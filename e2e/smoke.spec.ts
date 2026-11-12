import { expect, test } from "@playwright/test";

// BUILD_SPEC.md 8.3 E2E: start p2 Lower A, log one set of each exercise, finish with nausea "none",
// reload, and confirm the workout and sets persisted.
test("log p2 Lower A and survive a reload", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");

  // First launch: units.
  await page.getByRole("button", { name: "Kilograms (kg)" }).click();

  // Settings → Phase 2 (manual override).
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.locator(".seg button", { hasText: "P2" }).click();
  await expect(page.locator(".seg button.on")).toHaveText("P2");

  // Today → All sessions (P2 is the current phase) → Lower A → Start.
  await page.getByRole("button", { name: /Today/ }).click();
  await page.locator(".sessgrid button", { hasText: "p2-LA" }).click();
  await page.getByRole("button", { name: "Start this session" }).click();
  await expect(page.locator("header.hero h1")).toContainText("Lower A");

  // One set of each exercise.
  const cards = page.locator('[data-testid^="log-"]');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(3);
  for (let i = 0; i < n; i++) {
    await cards.nth(i).locator('[data-testid="setrow"] .tick').first().click();
    await expect(cards.nth(i).locator('[data-testid="setrow"].done')).toHaveCount(1);
  }
  await expect(page.getByTestId("rest-timer")).toBeVisible();

  // Finish with nausea "none" (the default) and save.
  await page.getByRole("button", { name: /^Finish workout/ }).click();
  await expect(page.getByRole("radio", { name: "none" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByTestId("summary")).toContainText(`${n}`);
  await page.getByRole("button", { name: "Done" }).click();

  // Reload and check persistence: nothing left to resume, Lower A ticked this week, and the DB holds the data.
  await page.reload();
  await expect(page.locator("header.hero h1")).toContainText("Today");
  await expect(page.getByTestId("resume-banner")).toHaveCount(0);
  await expect(page.locator(".sessgrid button", { hasText: "p2-LA" })).toContainText("✓");

  const stored = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("workout-tracker");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = <T,>(store: string) => new Promise<T[]>((res) => {
      const q = db.transaction(store).objectStore(store).getAll();
      q.onsuccess = () => res(q.result as T[]);
    });
    const workouts = await all<{ sessionId: string; finishedAt?: string; nausea?: string; phaseId: string }>("workouts");
    const sets = await all<{ workoutId: string; exerciseIndex: number; setIndex: number; side?: string }>("setLogs");
    // Per-side exercises store an L and an R row for one set.
    return { workouts, sets: new Set(sets.map((l) => `${l.exerciseIndex}:${l.setIndex}`)).size, exercises: new Set(sets.map((l) => l.exerciseIndex)).size };
  });
  expect(stored.workouts).toHaveLength(1);
  expect(stored.workouts[0]).toMatchObject({ sessionId: "p2-LA", phaseId: "p2", nausea: "none" });
  expect(stored.workouts[0]!.finishedAt).toBeTruthy();
  expect(stored.sets).toBe(n);
  expect(stored.exercises).toBe(n);
});
