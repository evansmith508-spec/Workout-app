import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { DEFAULT_SETTINGS, getActiveWorkout, readPhaseState, getSettings } from "./repo";
import { addDays, today, weekStart } from "../rules/dates";

export const useSettings = () => useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS);
/** undefined while loading; null when the user hasn't picked units yet (first launch). */
export const useStoredSettings = () => useLiveQuery(async () => (await db.settings.get("singleton")) ?? null, []);
export const usePhaseState = () => useLiveQuery(() => readPhaseState(), []);
/** null = loaded and none; undefined = still loading. */
export const useActiveWorkout = () => useLiveQuery(async () => (await getActiveWorkout()) ?? null, []);

/** Finished workouts in the current Mon–Sun week. */
export function useWeekWorkouts(date = today()) {
  const start = weekStart(date);
  return useLiveQuery(
    () => db.workouts.where("date").between(start, addDays(start, 6), true, true).filter((w) => !!w.finishedAt).toArray(),
    [start],
    [],
  );
}

export const useDayLogs = (date: string) =>
  useLiveQuery(async () => ({
    primer: await db.primerLogs.where("date").equals(date).toArray(),
    mobility: await db.mobilityLogs.where("date").equals(date).toArray(),
    painChecks: await db.painChecks.where("date").equals(date).toArray(),
  }), [date]);

export const useRecentWorkouts = (days = 3, date = today()) =>
  useLiveQuery(() => db.workouts.where("date").between(addDays(date, -days), date, true, true).toArray(), [date, days], []);
