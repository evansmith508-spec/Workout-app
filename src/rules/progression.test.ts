import { describe, expect, it } from "vitest";
import { getPhase, getSession } from "../program/program";
import type { PainCheck } from "../db/types";
import { barbellLoads, nextLoadableUp, roundToLoadable } from "./loadable";
import { hamstringHold } from "./pain";
import { pullupStage, suggest, type SuggestContext } from "./progression";
import { FIXTURE_SETTINGS as S, fxWorkout } from "./fixtures";

const ex = (sessionId: string, label: string) => getSession(sessionId).exercises.find((e) => e.label === label)!;
const noHold = { hold: false, reasons: [], onViolation: "" };
const ctx = (phaseId: "p1" | "p2" | "p3" | "p4" = "p1"): SuggestContext => ({ settings: S, phase: getPhase(phaseId), hold: noHold, today: "2026-11-11" });
const bench = ex("UA", "1");

describe("7.2 loadable weights", () => {
  it("smallest barbell jump is 2 × the smallest plate", () => {
    expect(nextLoadableUp(80, bench, S)).toBe(82.5);
    expect(barbellLoads(S)[0]).toBe(20);
  });
  it("rounds to the nearest achievable total", () => {
    expect(roundToLoadable(72, bench, S)).toBe(72.5);
    expect(roundToLoadable(300, bench, S)).toBe(177.5); // one pair of each plate
  });
  it("dumbbells clamp to min/max and snap to step", () => {
    const db = ex("UB", "1");
    expect(roundToLoadable(40, db, S)).toBe(32.5);
    expect(roundToLoadable(1, db, S)).toBe(2.5);
    expect(roundToLoadable(13.4, db, S)).toBe(12.5);
  });
  it("respects repeated pairs in the inventory", () => {
    expect(Math.max(...barbellLoads({ barbellWeight: 20, plates: [20, 20] }))).toBe(100);
  });
});

describe("8.3 fixtures 1–4: double progression", () => {
  it("#1 bench 80 × 6,6,6,6 @ RIR 2 → 82.5", () => {
    const h = [fxWorkout("UA", "1", [6, 6, 6, 6].map((r) => ({ weight: 80, reps: r, rir: 2 })), "2026-11-09")];
    expect(suggest(bench, h, ctx())?.load).toBe(82.5);
  });
  it("#2 bench 80 × 6,6,5,5 → keep 80", () => {
    const h = [fxWorkout("UA", "1", [6, 6, 5, 5].map((r) => ({ weight: 80, reps: r, rir: 2 })), "2026-11-09")];
    const s = suggest(bench, h, ctx())!;
    expect(s.load).toBe(80);
    expect(s.reason).toMatch(/\+1 rep/);
  });
  it("#3 80 × 4,3,4,3 two sessions in a row → 72.5", () => {
    const sets = [4, 3, 4, 3].map((r) => ({ weight: 80, reps: r, rir: 0 }));
    const h = [fxWorkout("UA", "1", sets, "2026-11-09"), fxWorkout("UA", "1", sets, "2026-11-02")];
    expect(suggest(bench, h, ctx())?.load).toBe(72.5);
    expect(suggest(bench, h.slice(0, 1), ctx())?.load).toBe(80); // only once → keep
  });
  it("#4 one-arm DB row at the 32.5 max, 8/8/8/8 each side → keep 32.5, +1 rep / slow lowering", () => {
    const row = ex("UB", "1");
    const sets = [0, 1, 2, 3].flatMap(() => [{ weight: 32.5, reps: 8, side: "L" as const }, { weight: 32.5, reps: 8, side: "R" as const }]);
    const s = suggest(row, [fxWorkout("UB", "1", sets, "2026-11-12")], ctx())!;
    expect(s.load).toBe(32.5);
    expect(s.reason).toMatch(/\+1 rep/);
    expect(s.reason).toMatch(/slow the lowering to 3 s/);
  });
  it("per-side judged by the weaker side", () => {
    const row = ex("UB", "1");
    const sets = [0, 1, 2, 3].flatMap(() => [{ weight: 20, reps: 8, side: "L" as const }, { weight: 20, reps: 6, side: "R" as const }]);
    expect(suggest(row, [fxWorkout("UB", "1", sets, "2026-11-12")], ctx())?.load).toBe(20);
  });
  it("logged RIR below rirMin blocks the step up", () => {
    const h = [fxWorkout("UA", "1", [6, 6, 6, 6].map((r) => ({ weight: 80, reps: r, rir: 0 })), "2026-11-09")];
    expect(suggest(bench, h, ctx())?.load).toBe(80);
  });
  it("no history → no suggestion", () => expect(suggest(bench, [], ctx())).toBeNull());
});

describe("8.3 fixture 5: p2 RDL pain 5/10", () => {
  it("no increase next time and shows the p2 onViolation text", () => {
    const p2 = getPhase("p2");
    const rdl = ex("p2-LB", "1");
    const w = fxWorkout("p2-LB", "1", [10, 10, 10, 10].map((r, i) => ({ weight: 60, reps: r, rir: 2, pain: i === 2 ? 5 : 2 })), "2026-11-13", "p2");
    const hold = hamstringHold(p2, [w], []);
    expect(hold.hold).toBe(true);
    const s = suggest(rdl, [w], { ...ctx("p2"), hold })!;
    expect(s.load).toBe(60);
    expect(s.notes).toContain(p2.painRule.onViolation);
    // Without the pain the same session would go up.
    const clean = fxWorkout("p2-LB", "1", [10, 10, 10, 10].map((r) => ({ weight: 60, reps: r, rir: 2, pain: 2 })), "2026-11-13", "p2");
    expect(suggest(rdl, [clean], { ...ctx("p2"), hold: hamstringHold(p2, [clean], []) })!.load).toBe(62.5);
  });
  it("a 'worse' morning-after check also holds", () => {
    const p2 = getPhase("p2");
    const w = fxWorkout("p2-LB", "1", [{ weight: 60, reps: 10, pain: 1 }], "2026-11-13", "p2");
    const check: PainCheck = { id: "c", date: "2026-11-14", kind: "morning-after", painAtRest: 2, vsNormal: "worse" };
    expect(hamstringHold(p2, [w], [check]).hold).toBe(true);
  });
});

describe("other progressions", () => {
  it("nordic: all at max with control 3 → use less fingertip help", () => {
    const nordic = ex("p2-LA", "1");
    const w = fxWorkout("p2-LA", "1", [6, 6, 6].map((r) => ({ reps: r, control: 3 as const, pain: 0 })), "2026-11-10", "p2");
    expect(suggest(nordic, [w], ctx("p2"))!.reason).toMatch(/less fingertip help/);
  });
  it("slider two-leg at full reps, pain ≤ 2 → ready for single-leg", () => {
    const sl = ex("p1-LA", "1");
    const w = fxWorkout("p1-LA", "1", [6, 6, 6].map((r) => ({ reps: r, pain: 2, control: 2 as const })), "2026-11-10");
    expect(suggest(sl, [w], ctx())!.text).toMatch(/single-leg/);
  });
  it("pull-up stages", () => {
    expect([0, 1, 5, 6, 10, 11].map(pullupStage)).toEqual([1, 2, 2, 3, 3, 4]);
    const pu = ex("UA", "4");
    const w = fxWorkout("UA", "4", [{ reps: 7, note: "max-test" }], "2026-10-20");
    const s = suggest(pu, [w], ctx())!;
    expect(s.text).toBe("Stage 3");
    expect(s.notes[0]).toMatch(/retest/);
  });
  it("quality items get no load suggestion", () => {
    expect(suggest(ex("p4-LA", "1"), [], ctx("p4"))!.load).toBeUndefined();
  });
});
