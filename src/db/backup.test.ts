import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { TrackerDB, ALL_TABLES, newId } from "./db";
import { exportAll, importAll, parseBackup, resetAll, setLogsCsv } from "./backup";
import { finishWorkout, getPhaseState, putSetLogs, setCurrentPhase, startWorkout } from "./repo";
import { getPhase, getSession } from "../program/program";

async function seed(d: TrackerDB) {
  await d.settings.put({ id: "singleton", units: "kg", barbellWeight: 20, plates: [25, 20, 10, 5, 2.5, 1.25], dumbbell: { min: 2.5, max: 32.5, step: 2.5 }, ownsFoamRoller: true, restTimerSound: false });
  await getPhaseState(d);
  await setCurrentPhase("p2", "advanced", d);
  const w = await startWorkout(getPhase("p2"), getSession("p2-LA"), d);
  await putSetLogs([
    { id: newId(), workoutId: w.id, exerciseId: "nordic-curl", variant: "fingertip-assist", exerciseIndex: 0, setIndex: 0, reps: 6, painDuring: 1, control: 2, isWarmup: false, completedAt: "2026-11-10T10:00:00Z" },
    { id: newId(), workoutId: w.id, exerciseId: "barbell-back-squat", variant: null, exerciseIndex: 1, setIndex: 0, weight: 80, reps: 8, rir: 2, isWarmup: false, completedAt: "2026-11-10T10:05:00Z", note: 'felt "good", fast' },
  ], d);
  await finishWorkout(w.id, { nausea: "mild", nauseaWhen: "end", hoursSinceMeal: 1.5, mealSize: "meal" }, d);
  await d.painChecks.add({ id: newId(), date: "2026-11-11", kind: "morning-after", painAtRest: 1, vsNormal: "same" });
  await d.primerLogs.add({ id: newId(), date: "2026-11-11", time: "08:00", setsDone: 5, effortPct: 60, pain: 0 });
  await d.fieldLogs.add({ id: newId(), date: "2026-11-11", phaseId: "p2", type: "walk-jog", durationMin: 25, painMax: 0 });
  await d.mobilityLogs.add({ id: "2026-11-11-morning", date: "2026-11-11", routineId: "morning", completedItems: 6, total: 6 });
  await d.criterionChecks.add({ id: "p2-c1", phaseId: "p2", checkedAt: "x", evidence: "Met", source: "auto" });
  await d.bodyweights.add({ id: "2026-11-11", date: "2026-11-11", weight: 78.4 });
}

async function snapshot(d: TrackerDB) {
  const out: Record<string, unknown[]> = {};
  for (const t of ALL_TABLES) out[t] = (await d.table(t).toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

describe("8.3 fixture 10: export → reset → import", () => {
  it("gives identical tables", async () => {
    const d = new TrackerDB(`b-${Math.random()}`);
    await seed(d);
    const before = await snapshot(d);
    for (const t of ALL_TABLES) expect(before[t]!.length, t).toBeGreaterThan(0);

    const json = JSON.stringify(await exportAll(d));
    await resetAll(d);
    for (const t of ALL_TABLES) expect(await d.table(t).count()).toBe(0);

    await importAll(parseBackup(json), d);
    expect(await snapshot(d)).toEqual(before);
  });

  it("rejects files that aren't backups", () => {
    expect(() => parseBackup("nope")).toThrow(/valid JSON/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/backup/);
    expect(() => parseBackup(JSON.stringify({ app: "workout-tracker", tables: { evil: [] } }))).toThrow(/Unknown table/);
  });

  it("CSV export has one row per set log and escapes quotes", async () => {
    const d = new TrackerDB(`c-${Math.random()}`);
    await seed(d);
    const csv = await setLogsCsv(d);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^date,phase,session,exercise/);
    expect(lines[2]).toContain('"felt ""good"", fast"');
    expect(lines[1]).toContain("Nordic");
  });
});
