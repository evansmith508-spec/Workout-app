// Starting values for set rows. M3 replaces the weight with the progression suggestion.
import type { SetLog, Settings } from "../db/types";
import type { Exercise } from "../program/types";

export type LogKind = "load" | "quality";
export const logKind = (e: Exercise): LogKind => (e.progression === "quality" ? "quality" : "load");
export const hasControl = (e: Exercise) => e.progression === "nordic" || e.progression === "slider";
export const hasRir = (e: Exercise) => e.effort?.rirMin != null || e.effort?.rirMax != null;
export const usesAddedWeight = (e: Exercise) => e.equipment === "bodyweight";

/** Smallest weight change for the stepper. */
export function weightStep(e: Exercise, s: Settings): number {
  if (e.equipment === "barbell") return 2 * Math.min(...s.plates);
  return s.dumbbell.step;
}

export function minWeight(e: Exercise, s: Settings): number {
  if (e.equipment === "barbell") return s.barbellWeight;
  if (e.equipment === "dumbbell") return s.dumbbell.min;
  return 0;
}

export function plannedSetCount(e: Exercise): number {
  return e.prescription.sets ?? 1;
}

export interface RowDefaults { weight: number; reps: number; rir: number | null; pain: number; control: 1 | 2 | 3 | null }

/** Defaults for working set `setIndex`, from the last session's matching set when there is one. */
export function rowDefaults(e: Exercise, setIndex: number, last: SetLog[], s: Settings, lastPain: number | null,
  suggestion?: { load?: number; reps?: number } | null): RowDefaults {
  const work = last.filter((l) => !l.isWarmup);
  const same = work.filter((l) => l.setIndex === setIndex);
  const ref = same[0] ?? work[work.length - 1];
  const loadOf = (l?: SetLog) => (l ? (usesAddedWeight(e) ? l.addedWeight : l.weight) : undefined);
  const weight = suggestion?.load ?? loadOf(ref) ?? minWeight(e, s);
  const reps = suggestion?.reps ?? ref?.reps ?? e.prescription.repsMax ?? e.prescription.repsMin ?? 5;
  const rir = hasRir(e) ? ref?.rir ?? e.effort?.rirMax ?? e.effort?.rirMin ?? null : null;
  return { weight, reps, rir, pain: lastPain ?? 0, control: hasControl(e) ? ref?.control ?? 2 : null };
}
