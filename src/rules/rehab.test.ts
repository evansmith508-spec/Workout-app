import { describe, expect, it } from "vitest";
import { getPhase } from "../program/program";
import type { PainCheck } from "../db/types";
import { addDays, weekdayOf } from "./dates";
import { needsRegression, regressionActive, regressionUntil, resolveSession } from "./pain";
import { canAdvance, evaluateAutoCheck, evaluateCriteria, lowerYesterday, weeksInPhase } from "./criteria";
import { fxWorkout } from "./fixtures";

const WED = "2026-11-11";

describe("8.3 fixture 6: p3 Nordic full-unassisted pain 1/10 → drop back", () => {
  const p3 = getPhase("p3");
  const w = fxWorkout("p3-LA", "2", [{ reps: 6, pain: 1 }, { reps: 6, pain: 0 }, { reps: 6, pain: 0 }], WED, "p3");
  it("shows the drop-back banner", () => expect(needsRegression(p3, w)).toBe(true));
  it("one tap sets legRegressionUntil and the next Tuesday resolves to p2-LA", () => {
    const state = { currentPhaseId: "p3" as const, legRegressionUntil: regressionUntil(WED) };
    expect(state.legRegressionUntil).toBe("2026-11-18");
    const nextTue = addDays(WED, 6);
    expect(weekdayOf(nextTue)).toBe("tue");
    expect(resolveSession(p3, "LA", state, nextTue).id).toBe("p2-LA");
    expect(resolveSession(p3, "LB", state, nextTue).id).toBe("p2-LB");
    expect(resolveSession(p3, "UA", state, nextTue).id).toBe("UA");
    // After the window ends, back to Phase 3.
    expect(regressionActive(state, addDays(WED, 8))).toBe(false);
    expect(resolveSession(p3, "LA", state, addDays(WED, 8)).id).toBe("p3-LA");
  });
  it("no banner for pain 0 or in other phases", () => {
    expect(needsRegression(p3, fxWorkout("p3-LA", "2", [{ reps: 6, pain: 0 }], WED, "p3"))).toBe(false);
    expect(needsRegression(getPhase("p2"), fxWorkout("p2-LA", "1", [{ reps: 6, pain: 1 }], WED, "p2"))).toBe(false);
  });
});

const empty = { workouts: [], painChecks: [] as PainCheck[], phaseStartedAt: "2026-10-01", today: WED };

describe("7.5 criteria auto-evidence", () => {
  it("Nordic fingertip-assist 3×6 → met with evidence text", () => {
    const p2 = getPhase("p2");
    const w = fxWorkout("p2-LA", "1", [6, 6, 6].map((r) => ({ reps: r, control: 2 as const, pain: 0 })), "2026-12-12", "p2");
    const ev = evaluateAutoCheck(p2.criteria[0]!.autoCheck!, { ...empty, workouts: [w] });
    expect(ev.met).toBe(true);
    expect(ev.text).toBe("Met on 12 Dec: Nordic Curl: Fingertip Assist 3×6");
  });
  it("5 reps is not enough", () => {
    const p2 = getPhase("p2");
    const w = fxWorkout("p2-LA", "1", [6, 5, 6].map((r) => ({ reps: r })), WED, "p2");
    expect(evaluateAutoCheck(p2.criteria[0]!.autoCheck!, { ...empty, workouts: [w] }).met).toBe(false);
  });
  it("single-leg bridge needs similar sides", () => {
    const c = getPhase("p1").criteria[1]!.autoCheck!;
    const even = fxWorkout("p1-LA", "3", [0, 1, 2].flatMap(() => [{ reps: 12, side: "L" as const }, { reps: 12, side: "R" as const }]), WED);
    const uneven = fxWorkout("p1-LA", "3", [0, 1, 2].flatMap(() => [{ reps: 12, side: "L" as const }, { reps: 10, side: "R" as const }]), WED);
    expect(evaluateAutoCheck(c, { ...empty, workouts: [even] }).met).toBe(true);
    expect(evaluateAutoCheck(c, { ...empty, workouts: [uneven] }).met).toBe(false);
  });
  it("slider criterion asks the extra question", () => {
    const c = getPhase("p1").criteria[0]!.autoCheck!;
    const w = fxWorkout("p1-LA", "1", [6, 6, 6].map((r) => ({ reps: r, pain: 2 })), WED);
    const ev = evaluateAutoCheck(c, { ...empty, workouts: [w] });
    expect(ev.met).toBe(true);
    expect(ev.confirmQuestion).toBe("full range");
  });
  it("morning-after: no 'worse' for 7 days", () => {
    const c = getPhase("p1").criteria.find((x) => x.id === "p1-c4")!.autoCheck!;
    const ok: PainCheck = { id: "a", date: addDays(WED, -2), kind: "morning-after", painAtRest: 0, vsNormal: "same" };
    expect(evaluateAutoCheck(c, { ...empty, painChecks: [ok] }).met).toBe(true);
    expect(evaluateAutoCheck(c, { ...empty, painChecks: [ok, { ...ok, id: "b", vsNormal: "worse" }] }).met).toBe(false);
    expect(evaluateAutoCheck(c, { ...empty, painChecks: [ok], phaseStartedAt: addDays(WED, -2) }).met).toBe(false);
  });
  it("manual-only criteria evaluate to null", () => {
    const p2 = getPhase("p2");
    expect(evaluateCriteria(p2, empty)[p2.criteria.findIndex((c) => c.id === "p2-c4")]).toBeNull();
  });
});

describe("advance and drop-back gating", () => {
  it("advance only when every criterion is ticked", () => {
    const p1 = getPhase("p1");
    const ids = p1.criteria.map((c) => c.id);
    expect(canAdvance(p1, new Set(ids.slice(0, -1)))).toBe(false);
    expect(canAdvance(p1, new Set(ids))).toBe(true);
  });
  it("return-to-play phase never 'advances'", () => {
    const p4 = getPhase("p4");
    expect(canAdvance(p4, new Set(p4.criteria.map((c) => c.id)))).toBe(false);
  });
  it("weeks in phase is informational", () => expect(weeksInPhase("2026-11-02", WED)).toBe(2));
  it("morning-after prompt the day after a Lower session", () => {
    expect(lowerYesterday([{ date: addDays(WED, -1), slot: "LA", finishedAt: "x" }], WED)).toBe(true);
    expect(lowerYesterday([{ date: addDays(WED, -1), slot: "UA", finishedAt: "x" }], WED)).toBe(false);
  });
});

import { primerTarget } from "./reminders";
describe("7.8 primer reminders", () => {
  it("phase 1: 2–3 a day", () => expect(primerTarget(getPhase("p1"), "UA")).toEqual({ count: 2, text: "2–3× today" }));
  it("phase 2: once on non-leg days", () => {
    expect(primerTarget(getPhase("p2"), "UA").count).toBe(1);
    expect(primerTarget(getPhase("p2"), "LA").count).toBe(0);
  });
  it("phases 3–4: warm-up checkbox", () => expect(primerTarget(getPhase("p4"), "UA").text).toBe("In session warm-up"));
});
