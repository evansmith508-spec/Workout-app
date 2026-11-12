import { describe, expect, it } from "vitest";
import { getPhase, getSession, program } from "../program/program";
import type { MuscleId, PhaseId } from "../program/types";
import { mainLift, sessionWorkingSets, weeklyPlanVolume } from "./volume";

// BUILD_SPEC.md 8.1
const PLAN: Record<MuscleId, [number, number, number, number]> = {
  chest: [12, 12, 12, 12],
  back: [10, 10, 10, 10],
  frontDelt: [10, 10, 10, 10],
  sideDelt: [10, 10, 10, 10],
  rearDelt: [10.5, 10.5, 10.5, 10.5],
  biceps: [11, 11, 11, 11],
  triceps: [14, 14, 14, 14],
  hamstrings: [10, 11.5, 11.5, 11.5],
  quads: [6, 8, 10, 10],
  glutes: [9, 9.5, 11, 11],
  adductors: [3.5, 7, 10, 10],
  calves: [6, 6, 8, 8],
};
const PHASES: PhaseId[] = ["p1", "p2", "p3", "p4"];

describe("8.1 weekly fractional sets in the plan", () => {
  PHASES.forEach((pid, i) => {
    it(`${pid}`, () => {
      const v = weeklyPlanVolume(getPhase(pid));
      for (const m of program.muscles) expect(v[m.id] ?? 0, `${pid} ${m.id}`).toBeCloseTo(PLAN[m.id][i] ?? NaN, 6);
    });
  });
});

// BUILD_SPEC.md 8.2
const SESSIONS: [string, number, string][] = [
  ["UA", 27, "Barbell Bench Press"],
  ["UB", 26, "One-Arm DB Row (Heavy)"],
  ["p1-LA", 14, "Goblet Squat"],
  ["p1-LB", 14, "DB Romanian Deadlift (pain-free range)"],
  ["p2-LA", 16, "Barbell Back Squat"],
  ["p2-LB", 15, "Barbell RDL (Progressive Load + Depth)"],
  ["p3-LA", 18, "Barbell Back Squat (Heavy)"],
  ["p3-LB", 19, "Barbell Stiff-Leg Deadlift"],
  ["p4-LA", 18, "Barbell Back Squat (Heavy)"],
  ["p4-LB", 19, "Barbell RDL (Heavy)"],
];

describe("8.2 working sets per session and main lift", () => {
  it.each(SESSIONS)("%s", (id, sets, lift) => {
    const s = getSession(id);
    expect(sessionWorkingSets(s)).toBe(sets);
    expect(mainLift(s)?.name).toBe(lift);
    expect(s.exercises.filter((e) => e.isMainLift)).toHaveLength(1);
  });

  it("UA and UB are shared by every phase", () => {
    for (const pid of PHASES) {
      expect(getPhase(pid).sessionIds.UA).toBe("UA");
      expect(getPhase(pid).sessionIds.UB).toBe("UB");
    }
  });
});

describe("plan integrity", () => {
  it("every phase slot points at an existing session with the matching slot", () => {
    for (const ph of program.phases)
      for (const [slot, id] of Object.entries(ph.sessionIds)) expect(getSession(id).slot).toBe(slot);
  });
  it("every superset 'first' is followed by a 'second'", () => {
    for (const s of Object.values(program.sessions))
      s.exercises.forEach((e, i) => {
        if (e.superset === "first") expect(s.exercises[i + 1]?.superset, `${s.id} ${e.label}`).toBe("second");
      });
  });
});

describe("plan preferences", () => {
  it("upper days and Phases 3–4: every exercise has 3–4 working sets", () => {
    for (const id of ["UA", "UB", "p3-LA", "p3-LB", "p4-LA", "p4-LB"])
      for (const e of getSession(id).exercises) {
        expect(e.prescription.sets, `${id} ${e.name}`).toBeGreaterThanOrEqual(3);
        expect(e.prescription.sets, `${id} ${e.name}`).toBeLessThanOrEqual(4);
      }
  });
  it("Phases 3–4: every muscle gets at least 10 fractional sets a week (calves 8 by choice)", () => {
    for (const pid of ["p3", "p4"] as const) {
      const v = weeklyPlanVolume(getPhase(pid));
      for (const m of program.muscles) expect(v[m.id] ?? 0, `${pid} ${m.id}`).toBeGreaterThanOrEqual(m.id === "calves" ? 8 : 10);
    }
  });
});
