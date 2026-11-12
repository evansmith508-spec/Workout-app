import Dexie, { type EntityTable } from "dexie";
import type {
  BodyweightLog, CriterionCheck, FieldLog, MobilityLog, PainCheck, PhaseState, PrimerLog, SetLog, Settings, Workout,
} from "./types";

export class TrackerDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  phaseState!: EntityTable<PhaseState, "id">;
  workouts!: EntityTable<Workout, "id">;
  setLogs!: EntityTable<SetLog, "id">;
  painChecks!: EntityTable<PainCheck, "id">;
  primerLogs!: EntityTable<PrimerLog, "id">;
  fieldLogs!: EntityTable<FieldLog, "id">;
  mobilityLogs!: EntityTable<MobilityLog, "id">;
  criterionChecks!: EntityTable<CriterionCheck, "id">;
  bodyweights!: EntityTable<BodyweightLog, "id">;

  constructor(name = "workout-tracker") {
    super(name);
    // Schema v1. Add new versions below; never edit a shipped version.
    this.version(1).stores({
      settings: "id",
      phaseState: "id",
      workouts: "id, date, sessionId, slot, phaseId, finishedAt",
      setLogs: "id, workoutId, exerciseId, completedAt",
      painChecks: "id, date, kind",
      primerLogs: "id, date",
      fieldLogs: "id, date, type",
      mobilityLogs: "id, date, routineId",
      criterionChecks: "id, phaseId",
    });
    // v2: optional bodyweight log (Progress screen).
    this.version(2).stores({ bodyweights: "id, date" });
  }
}

export const db = new TrackerDB();

export const ALL_TABLES = [
  "settings", "phaseState", "workouts", "setLogs", "painChecks", "primerLogs",
  "fieldLogs", "mobilityLogs", "criterionChecks", "bodyweights",
] as const;
export type TableName = (typeof ALL_TABLES)[number];

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
