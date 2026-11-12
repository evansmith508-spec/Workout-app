// Local data model (BUILD_SPEC.md Section 6).
import type { PhaseId, Slot } from "../program/types";

export interface Settings {
  id: "singleton";
  units: "kg" | "lb";
  barbellWeight: number;
  plates: number[]; // plate sizes available in pairs
  dumbbell: { min: number; max: number; step: number };
  ownsFoamRoller: boolean;
  restTimerSound: boolean;
}

export interface PhaseHistoryEntry {
  phaseId: PhaseId; startedAt: string; endedAt?: string; reason: "advanced" | "dropped-back" | "manual";
}

export interface PhaseState {
  id: "singleton";
  currentPhaseId: PhaseId;
  phaseStartedAt: string;
  history: PhaseHistoryEntry[];
  legRegressionUntil?: string;
}

export type Nausea = "none" | "mild" | "moderate" | "vomited";
export type NauseaWhen = "start" | "middle" | "end" | "after";
export type MealSize = "fasted" | "snack" | "meal" | "large";

export interface Workout {
  id: string; date: string; phaseId: PhaseId; sessionId: string; slot: Slot;
  startedAt: string; finishedAt?: string; sessionRpe?: number;
  nausea?: Nausea; nauseaWhen?: NauseaWhen;
  hoursSinceMeal?: number; mealSize?: MealSize; notes?: string;
}

export interface SetLog {
  id: string; workoutId: string; exerciseId: string; variant: string | null; exerciseIndex: number;
  setIndex: number; side?: "L" | "R"; weight?: number; addedWeight?: number; reps?: number; durationSec?: number;
  rir?: number; painDuring?: number; control?: 1 | 2 | 3; isWarmup: boolean; completedAt: string;
  /** Power/field items: quality note. */
  note?: string;
}

export interface PainCheck {
  id: string; date: string; kind: "pre-session" | "morning-after" | "ad-hoc"; painAtRest: number;
  vsNormal?: "better" | "same" | "worse"; note?: string;
}
export interface PrimerLog { id: string; date: string; time: string; setsDone: number; effortPct?: number; pain?: number }
export interface FieldLog {
  id: string; date: string; phaseId: PhaseId;
  type: "walk" | "walk-jog" | "jog" | "tempo" | "sprint" | "kicking" | "small-sided" | "team-training" | "match";
  durationMin?: number; reps?: number; distanceM?: number; effortPct?: number; painMax: number; notes?: string;
}
export interface MobilityLog { id: string; date: string; routineId: "morning" | "evening" | "foam"; completedItems: number; total: number }
export interface CriterionCheck { id: string; phaseId: PhaseId; checkedAt: string; evidence: string; source: "auto" | "manual" }
export interface BodyweightLog { id: string; date: string; weight: number }
