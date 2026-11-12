import { describe, expect, it } from "vitest";
import { getPhase, getSession } from "../program/program";
import type { Workout } from "../db/types";
import { fxWorkout } from "./fixtures";
import { liftSeries, mealBucket, nauseaInsights, nordicSeries, painSeries, primerAdherence, weeklyLoggedVolume } from "./progress";

describe("progress data", () => {
  it("lift series: top set and e1RM est., oldest first", () => {
    const a = fxWorkout("UA", "1", [{ weight: 80, reps: 6 }, { weight: 80, reps: 5 }], "2026-11-02");
    const b = fxWorkout("UA", "1", [{ weight: 82.5, reps: 5 }], "2026-11-09");
    const s = liftSeries(getSession("UA").exercises[0]!, [b, a]);
    expect(s.map((p) => p.top)).toEqual([80, 82.5]);
    expect(s[0]!.e1rm).toBeCloseTo(96, 1);
  });
  it("weekly logged volume sums the Mon–Sun week only", () => {
    const inWeek = fxWorkout("UA", "1", [{ weight: 80, reps: 6 }, { weight: 80, reps: 6 }], "2026-11-10");
    const lastWeek = fxWorkout("UA", "1", [{ weight: 80, reps: 6 }], "2026-11-08");
    const v = weeklyLoggedVolume([inWeek, lastWeek], "2026-11-11");
    expect(v.chest).toBe(2);
    expect(v.triceps).toBe(1);
  });
  it("meal buckets", () => {
    expect(mealBucket({ mealSize: "fasted" })).toBe("fasted");
    expect(mealBucket({ mealSize: "meal", hoursSinceMeal: 0.5 })).toBe("<1 h");
    expect(mealBucket({ mealSize: "meal", hoursSinceMeal: 2 })).toBe("1–2 h");
    expect(mealBucket({ mealSize: "snack", hoursSinceMeal: 2.5 })).toBe("2–3 h");
    expect(mealBucket({ mealSize: "meal", hoursSinceMeal: 4 })).toBe(">3 h");
  });
  it("nausea rate by slot and meal timing", () => {
    const w = (slot: Workout["slot"], nausea: Workout["nausea"], h?: number): Workout => ({
      id: Math.random().toString(), date: "2026-11-10", phaseId: "p1", sessionId: "UA", slot, startedAt: "", finishedAt: "x",
      nausea, hoursSinceMeal: h, mealSize: h === undefined ? "fasted" : "meal",
    });
    const r = nauseaInsights([w("LA", "mild", 0.5), w("LA", "none", 2.5), w("UA", "none", 2.5), w("LB", "moderate")]);
    expect(r.bySlot.find((x) => x.group === "LA")).toMatchObject({ n: 2, nauseous: 1, rate: 0.5 });
    expect(r.byMeal.find((x) => x.group === "fasted")).toMatchObject({ n: 1, rate: 1 });
    expect(r.byMeal.find((x) => x.group === "2–3 h")).toMatchObject({ n: 2, rate: 0 });
  });
  it("pain series merges during-set pain with checks", () => {
    const w = fxWorkout("p2-LB", "1", [{ weight: 60, reps: 10, pain: 3 }], "2026-11-13", "p2");
    const s = painSeries([w], [{ id: "c", date: "2026-11-14", kind: "morning-after", painAtRest: 1, vsNormal: "same" }]);
    expect(s).toEqual([{ date: "2026-11-13", during: 3 }, { date: "2026-11-14", morningAfter: 1 }]);
  });
  it("nordic series", () => {
    const w = fxWorkout("p2-LA", "1", [{ reps: 5, control: 2 }, { reps: 6, control: 3 }], "2026-11-10", "p2");
    expect(nordicSeries([w])).toEqual([{ date: "2026-11-10", variant: "fingertip-assist", reps: 6, control: 2.5 }]);
  });
  it("primer adherence uses the phase target per day", () => {
    const d = primerAdherence([{ id: "a", date: "2026-11-11", time: "08:00", setsDone: 5 }], getPhase("p2"), "2026-11-11", 2);
    expect(d).toEqual([{ date: "2026-11-10", done: 0, target: 0 }, { date: "2026-11-11", done: 1, target: 1 }]);
  });
});
