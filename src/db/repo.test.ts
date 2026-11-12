import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { TrackerDB } from "./db";
import { finishWorkout, getActiveWorkout, historyFor, logsForWorkout, putSetLogs, startWorkout, setCurrentPhase, getPhaseState } from "./repo";
import { getPhase, getSession } from "../program/program";

describe("persistence", () => {
  it("an unfinished workout and its sets survive reopening the database", async () => {
    const name = `t-${Math.random()}`;
    const d1 = new TrackerDB(name);
    const w = await startWorkout(getPhase("p2"), getSession("p2-LA"), d1);
    await putSetLogs([{ id: "a", workoutId: w.id, exerciseId: "nordic-curl", variant: "fingertip-assist", exerciseIndex: 0, setIndex: 0, reps: 5, painDuring: 1, control: 2, isWarmup: false, completedAt: "t" }], d1);
    d1.close();

    const d2 = new TrackerDB(name);
    const active = await getActiveWorkout(d2);
    expect(active?.id).toBe(w.id);
    expect(await logsForWorkout(w.id, d2)).toHaveLength(1);

    await finishWorkout(w.id, { nausea: "none", sessionRpe: 7 }, d2);
    expect(await getActiveWorkout(d2)).toBeUndefined();
    const h = await historyFor("nordic-curl", "fingertip-assist", undefined, d2);
    expect(h).toHaveLength(1);
    expect(h[0]!.workout.nausea).toBe("none");
    expect(await historyFor("nordic-curl", "full-unassisted", undefined, d2)).toHaveLength(0);
  });

  it("phase changes are recorded in history", async () => {
    const d = new TrackerDB(`t-${Math.random()}`);
    await getPhaseState(d);
    await setCurrentPhase("p2", "manual", d);
    const s = await getPhaseState(d);
    expect(s.currentPhaseId).toBe("p2");
    expect(s.history.map((h) => h.phaseId)).toEqual(["p1", "p2"]);
    expect(s.history[0]!.endedAt).toBeDefined();
  });
});
