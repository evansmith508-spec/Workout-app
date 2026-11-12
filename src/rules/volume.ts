import type { Exercise, MuscleId, Phase, Program, Session } from "../program/types";
import { program as defaultProgram, sessionForSlot, SLOT_ORDER } from "../program/program";

export type MuscleTotals = Partial<Record<MuscleId, number>>;

/** Working-set exercises: excludes power/field items and anything not counted toward volume. */
export function isWorkingExercise(e: Exercise, p: Program = defaultProgram): boolean {
  return e.countsTowardVolume && !p.volumeCounting.excludedCategories.includes(e.category);
}

/** Planned working sets in a session (Section 8.2). Per-side exercises count once per side pair. */
export function sessionWorkingSets(s: Session, p: Program = defaultProgram): number {
  return s.exercises.filter((e) => isWorkingExercise(e, p)).reduce((n, e) => n + (e.prescription.sets ?? 0), 0);
}

export function mainLift(s: Session): Exercise | undefined {
  return s.exercises.find((e) => e.isMainLift);
}

export function addSets(totals: MuscleTotals, e: Exercise, sets: number): MuscleTotals {
  for (const [m, w] of Object.entries(e.muscles) as [MuscleId, number][]) {
    totals[m] = (totals[m] ?? 0) + w * sets;
  }
  return totals;
}

/** Planned fractional sets per muscle for one session. */
export function sessionPlanVolume(s: Session, p: Program = defaultProgram): MuscleTotals {
  const t: MuscleTotals = {};
  for (const e of s.exercises) if (isWorkingExercise(e, p)) addSets(t, e, e.prescription.sets ?? 0);
  return t;
}

/** Planned weekly fractional sets per muscle: all four sessions once each (Section 8.1). */
export function weeklyPlanVolume(phase: Phase, p: Program = defaultProgram): MuscleTotals {
  const t: MuscleTotals = {};
  for (const slot of SLOT_ORDER) {
    const s = sessionForSlot(phase, slot, p);
    for (const e of s.exercises) if (isWorkingExercise(e, p)) addSets(t, e, e.prescription.sets ?? 0);
  }
  return t;
}
