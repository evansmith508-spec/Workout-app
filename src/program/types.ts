// Types for program.json (BUILD_SPEC.md Section 4). The JSON is read-only plan data.

export type Slot = "UA" | "LA" | "UB" | "LB";
export type DaySlot = Slot | "REST";
export type MuscleId =
  | "chest" | "back" | "frontDelt" | "sideDelt" | "rearDelt" | "biceps"
  | "triceps" | "hamstrings" | "quads" | "glutes" | "adductors" | "calves";
export type PhaseId = "p1" | "p2" | "p3" | "p4";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type AutoCheck =
  | {
      exerciseId: string; variant?: string; minSets: number; minReps?: number; painMax?: number;
      perSide?: boolean; sideDiffMaxPct?: number; requiresUserConfirm?: string;
    }
  | { morningAfterNotWorseForDays: number };

export interface Phase {
  id: PhaseId;
  name: string; label: string; weeks: string; color: string;
  goal: string; frequency: string;
  painRule: { display: string; maxDuringPain: number; mustSettleByNextMorning: boolean; onViolation: string };
  primer: {
    display: string; angles: string[]; schedule: "daily" | "non-leg-days" | "warm-up";
    timesPerDay?: [number, number]; sets: number; holdSec: number;
    effortPct: [number, number] | null; ifReactive?: string;
  };
  week: { day: Weekday; slot: DaySlot; label: string }[];
  criteriaType: "advance-to-next-phase" | "return-to-play";
  criteria: { id: string; text: string; autoCheck: AutoCheck | null }[];
  sessionIds: Record<Slot, string>;
}

export interface Prescription {
  display: string; sets: number | null; repsMin: number | null; repsMax: number | null;
  timeSecMin: number | null; timeSecMax: number | null; perSide: boolean;
}

export interface Exercise {
  exerciseId: string;
  variant: string | null;
  name: string;
  category: "compound" | "accessory" | "rehab" | "power";
  equipment: "barbell" | "dumbbell" | "bodyweight";
  prescription: Prescription;
  rest: { display: string; minSec: number | null; maxSec: number | null; afterSupersetPair?: boolean } | null;
  effort: { display: string; rirMin: number | null; rirMax: number | null } | null;
  tag: string | null;
  muscles: Partial<Record<MuscleId, number>>;
  countsTowardVolume: boolean;
  hamstringLoad: boolean;
  progression: "double" | "nordic" | "slider" | "pullup-stage" | "reps" | "range" | "quality";
  superset: "first" | "second" | null;
  label: string;
  isMainLift: boolean;
  cue: string;
}

export interface Session {
  id: string;
  slot: Slot; title: string; day: string;
  whatChanged: string[];
  science: { level: "study" | "coaching-call"; source: string; text: string }[];
  exercises: Exercise[];
}

export interface MobilityItem { name: string; prescription: Prescription; cue: string }
export interface MobilityRoutine {
  id: "morning" | "evening" | "foam";
  label: string; time: string; subtitle: string; description: string; optional: boolean;
  items: MobilityItem[];
}

export interface Program {
  meta: { name: string; version: string; disclaimer: string; weekStartsOn: string; sessionOrder: Slot[] };
  equipment: { available: string[]; phase4Extras: string[]; notAvailable: string[]; userSettingsNeeded: string[] };
  volumeCounting: { method: string; excludedCategories: string[]; perSessionCautionFractionalSets: number };
  muscles: { id: MuscleId; label: string }[];
  phases: Phase[];
  sessions: Record<string, Session>;
  mobility: MobilityRoutine[];
  nauseaTips: { title: string; text: string }[];
  redFlags: string;
  principles: { title: string; text: string; sources?: string }[];
  sources: { title: string; url: string }[];
}
