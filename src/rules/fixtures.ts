// Shared test helpers for the BUILD_SPEC.md 8.3 fixtures.
import type { SetLog, Settings, Workout } from "../db/types";
import type { PhaseId } from "../program/types";
import { getSession } from "../program/program";
import type { WorkoutWithLogs } from "./pain";

export const FIXTURE_SETTINGS: Settings = {
  id: "singleton", units: "kg", barbellWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  dumbbell: { min: 2.5, max: 32.5, step: 2.5 }, ownsFoamRoller: false, restTimerSound: false,
};

let n = 0;
export interface FxSet { reps: number; weight?: number; added?: number; rir?: number; pain?: number; control?: 1 | 2 | 3; side?: "L" | "R"; note?: string }

/** A finished workout of `sessionId` with sets for the exercise labelled `label`. */
export function fxWorkout(sessionId: string, label: string, sets: FxSet[], date: string, phaseId: PhaseId = "p1"): WorkoutWithLogs {
  const s = getSession(sessionId);
  const exerciseIndex = s.exercises.findIndex((e) => e.label === label);
  const e = s.exercises[exerciseIndex]!;
  const workout: Workout = { id: `w${n++}`, date, phaseId, sessionId, slot: s.slot, startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z` };
  const counters = new Map<string, number>();
  const logs: SetLog[] = sets.map((x) => {
    const k = x.side ?? "-";
    const setIndex = counters.get(k) ?? 0;
    counters.set(k, setIndex + 1);
    return {
      id: `l${n++}`, workoutId: workout.id, exerciseId: e.exerciseId, variant: e.variant, exerciseIndex, setIndex,
      side: x.side, weight: x.weight, addedWeight: x.added, reps: x.reps, rir: x.rir, painDuring: x.pain, control: x.control,
      note: x.note, isWarmup: false, completedAt: workout.finishedAt!,
    };
  });
  return { workout, logs };
}
