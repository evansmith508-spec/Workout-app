import { describe, expect, it } from "vitest";
import { getPhase, getSession } from "../program/program";
import type { SetLog } from "../db/types";
import { restSeconds } from "./rest";
import { e1rm } from "./e1rm";
import { cautionMuscles, countWorkingSets, lastTimeText, newBests, painFlags, workoutVolume } from "./summary";

const idx = (sessionId: string, label: string) => getSession(sessionId).exercises.findIndex((e) => e.label === label);

let n = 0;
function log(p: Partial<SetLog> & { exerciseIndex: number; setIndex: number }): SetLog {
  return { id: `l${n++}`, workoutId: "w", exerciseId: "x", variant: null, isWarmup: false, completedAt: "", ...p };
}

describe("rest timer", () => {
  const UB = getSession("UB");
  it("8.3 #9: UB 4a starts no timer; 4b starts 60 s (pair minSec, not compound)", () => {
    expect(restSeconds(UB, idx("UB", "4a"))).toBeNull();
    expect(restSeconds(UB, idx("UB", "4b"))).toBe(60);
  });
  it("compound lifts use maxSec", () => {
    expect(restSeconds(UB, idx("UB", "2"))).toBe(180); // bench 2–3 min
  });
  it("non-compound uses minSec", () => {
    expect(restSeconds(getSession("UA"), idx("UA", "5"))).toBe(60);
  });
  it("power items use their fixed rest", () => {
    expect(restSeconds(getSession("p4-LA"), 0)).toBe(120);
  });
});

describe("workout volume", () => {
  const s = getSession("UB");
  const row = idx("UB", "1"); // one-arm DB row, per side; back 1, biceps .5, rearDelt .5
  it("per-side L+R of one set counts once, warm-ups excluded", () => {
    const logs = [
      log({ exerciseIndex: row, setIndex: 0, side: "L", reps: 8 }),
      log({ exerciseIndex: row, setIndex: 0, side: "R", reps: 8 }),
      log({ exerciseIndex: row, setIndex: 1, side: "L", reps: 8 }),
      log({ exerciseIndex: row, setIndex: 1, side: "R", reps: 8 }),
      log({ exerciseIndex: row, setIndex: 2, isWarmup: true, side: "L", reps: 8 }),
    ];
    expect(countWorkingSets(logs)).toBe(2);
    const v = workoutVolume(s, logs);
    expect(v.back).toBe(2);
    expect(v.biceps).toBe(1);
  });
  it("caution over 11 fractional sets for a muscle", () => {
    expect(cautionMuscles({ back: 11.5, chest: 11 })).toEqual(["back"]);
  });
  it("power/field items don't count", () => {
    const p3 = getSession("p3-LA");
    expect(workoutVolume(p3, [log({ exerciseIndex: 0, setIndex: 0, reps: 5 })])).toEqual({});
  });
});

describe("pain flags", () => {
  it("flags hamstring-load sets above the phase max", () => {
    const s = getSession("p2-LB");
    const flags = painFlags(s, [
      log({ exerciseIndex: 0, setIndex: 0, painDuring: 5 }),
      log({ exerciseIndex: 0, setIndex: 1, painDuring: 4 }),
    ], getPhase("p2"));
    expect(flags).toHaveLength(1);
    expect(flags[0]!.pain).toBe(5);
  });
  it("phase 3 flags any pain", () => {
    const s = getSession("p3-LA");
    const i = s.exercises.findIndex((e) => e.exerciseId === "nordic-curl");
    expect(painFlags(s, [log({ exerciseIndex: i, setIndex: 0, painDuring: 1 })], getPhase("p3"))).toHaveLength(1);
  });
});

describe("e1RM and bests", () => {
  it("Epley for ≤ 10 reps only", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 2);
    expect(e1rm(100, 11)).toBeNull();
  });
  it("new top set and e1RM on a compound lift", () => {
    const bench = getSession("UA").exercises[0]!;
    const prev = [log({ exerciseIndex: 0, setIndex: 0, weight: 80, reps: 6 })];
    const cur = [log({ exerciseIndex: 0, setIndex: 0, weight: 82.5, reps: 5 })];
    const b = newBests(bench, cur, prev);
    expect(b.map((x) => x.kind)).toEqual(["top set", "e1RM"]);
  });
  it("no bests without history", () => {
    expect(newBests(getSession("UA").exercises[0]!, [log({ exerciseIndex: 0, setIndex: 0, weight: 80, reps: 6 })], [])).toEqual([]);
  });
});

describe("last time text", () => {
  it("formats sets", () => {
    const bench = getSession("UA").exercises[0]!;
    const logs = [6, 6, 5, 5].map((r, i) => log({ exerciseIndex: 0, setIndex: i, weight: 80, reps: r, rir: 2 }));
    expect(lastTimeText(bench, logs, "kg")).toBe("80 kg × 6, 6, 5, 5");
  });
  it("per-side shows L/R", () => {
    const row = getSession("UB").exercises[0]!;
    const logs = [log({ exerciseIndex: 0, setIndex: 0, side: "L", weight: 30, reps: 8 }), log({ exerciseIndex: 0, setIndex: 0, side: "R", weight: 30, reps: 7 })];
    expect(lastTimeText(row, logs, "kg")).toBe("30 kg × 8/7");
  });
});
