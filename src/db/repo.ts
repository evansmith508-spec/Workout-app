// Storage operations. Business rules stay in src/rules; this file only reads and writes.
import { db, newId } from "./db";
import type { PhaseState, SetLog, Settings, Workout } from "./types";
import type { PhaseId, Session, Phase } from "../program/types";
import { today } from "../rules/dates";

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  units: "kg",
  barbellWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  dumbbell: { min: 2.5, max: 32.5, step: 2.5 },
  ownsFoamRoller: false,
  restTimerSound: true,
};

export async function getSettings(d = db): Promise<Settings> {
  return (await d.settings.get("singleton")) ?? DEFAULT_SETTINGS;
}

function legacyPhase(): PhaseId | null {
  try {
    const v = localStorage.getItem("wt.currentPhase");
    return v === "p1" || v === "p2" || v === "p3" || v === "p4" ? v : null;
  } catch {
    return null;
  }
}

function defaultPhaseState(): PhaseState {
  const phaseId = legacyPhase() ?? "p1";
  const startedAt = today();
  return { id: "singleton", currentPhaseId: phaseId, phaseStartedAt: startedAt, history: [{ phaseId, startedAt, reason: "manual" }] };
}

/** Read-only (safe inside live queries). Returns the default if nothing is stored yet. */
export async function readPhaseState(d = db): Promise<PhaseState> {
  return (await d.phaseState.get("singleton")) ?? defaultPhaseState();
}

/** Reads the phase state, storing the default on first use. */
export async function getPhaseState(d = db): Promise<PhaseState> {
  const s = await d.phaseState.get("singleton");
  if (s) return s;
  const fresh = defaultPhaseState();
  await d.phaseState.put(fresh);
  return fresh;
}

/** Manual override from Settings. Recorded in history. Never called automatically. */
export async function setCurrentPhase(phaseId: PhaseId, reason: "advanced" | "dropped-back" | "manual", d = db): Promise<void> {
  const s = await getPhaseState(d);
  if (s.currentPhaseId === phaseId) return;
  const date = today();
  const history = s.history.map((h, i) => (i === s.history.length - 1 && !h.endedAt ? { ...h, endedAt: date } : h));
  history.push({ phaseId, startedAt: date, reason });
  await d.phaseState.put({ ...s, currentPhaseId: phaseId, phaseStartedAt: date, history });
}

export async function getActiveWorkout(d = db): Promise<Workout | undefined> {
  const open = await d.workouts.filter((w) => !w.finishedAt).toArray();
  return open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export async function startWorkout(phase: Phase, session: Session, d = db): Promise<Workout> {
  const w: Workout = {
    id: newId(), date: today(), phaseId: phase.id, sessionId: session.id, slot: session.slot,
    startedAt: new Date().toISOString(),
  };
  await d.workouts.add(w);
  return w;
}

export async function discardWorkout(id: string, d = db): Promise<void> {
  await d.transaction("rw", d.workouts, d.setLogs, async () => {
    await d.setLogs.where("workoutId").equals(id).delete();
    await d.workouts.delete(id);
  });
}

export async function finishWorkout(id: string, fields: Partial<Workout>, d = db): Promise<void> {
  await d.workouts.update(id, { ...fields, finishedAt: new Date().toISOString() });
}

export async function putSetLogs(logs: SetLog[], d = db): Promise<void> {
  await d.setLogs.bulkPut(logs);
}

export async function deleteSetLogs(ids: string[], d = db): Promise<void> {
  await d.setLogs.bulkDelete(ids);
}

export async function logsForWorkout(workoutId: string, d = db): Promise<SetLog[]> {
  return d.setLogs.where("workoutId").equals(workoutId).toArray();
}

/** Every finished workout's logs for one movement (exerciseId + variant), newest workout first. */
export async function historyFor(exerciseId: string, variant: string | null, excludeWorkoutId?: string, d = db):
  Promise<{ workout: Workout; logs: SetLog[] }[]> {
  const logs = (await d.setLogs.where("exerciseId").equals(exerciseId).toArray())
    .filter((l) => l.variant === variant && l.workoutId !== excludeWorkoutId);
  const ids = [...new Set(logs.map((l) => l.workoutId))];
  const workouts = (await d.workouts.bulkGet(ids)).filter((w): w is Workout => !!w && !!w.finishedAt);
  return workouts
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((w) => ({ workout: w, logs: logs.filter((l) => l.workoutId === w.id).sort((a, b) => a.setIndex - b.setIndex) }));
}

/** Finished workouts with all their logs, newest first. */
export async function recentWorkoutsWithLogs(limit = 20, d = db): Promise<{ workout: Workout; logs: SetLog[] }[]> {
  const ws = (await d.workouts.orderBy("date").reverse().filter((w) => !!w.finishedAt).limit(limit).toArray())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const logs = await d.setLogs.where("workoutId").anyOf(ws.map((w) => w.id)).toArray();
  return ws.map((w) => ({ workout: w, logs: logs.filter((l) => l.workoutId === w.id) }));
}

export async function setLegRegression(until: string | undefined, d = db): Promise<void> {
  const s = await getPhaseState(d);
  await d.phaseState.put({ ...s, legRegressionUntil: until });
}

export const LB_DEFAULTS: Omit<Settings, "id" | "ownsFoamRoller" | "restTimerSound"> = {
  units: "lb", barbellWeight: 45, plates: [45, 35, 25, 10, 5, 2.5], dumbbell: { min: 5, max: 75, step: 5 },
};

/** First launch: store settings with sensible defaults for the chosen units. */
export async function initSettings(units: "kg" | "lb", d = db): Promise<void> {
  const base = units === "kg" ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, ...LB_DEFAULTS };
  await d.settings.put({ ...base, id: "singleton" });
}

export async function saveSettings(patch: Partial<Omit<Settings, "id">>, d = db): Promise<void> {
  const cur = await getSettings(d);
  await d.settings.put({ ...cur, ...patch, id: "singleton" });
}
