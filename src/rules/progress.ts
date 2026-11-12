// Section 5.5 / 7.6 / 7.9: data shaping for Progress and Rehab charts. Pure functions.
import type { PainCheck, PrimerLog, SetLog, Workout } from "../db/types";
import type { Exercise, MuscleId, Phase, Slot } from "../program/types";
import { program } from "../program/program";
import { addDays, weekStart } from "./dates";
import { e1rm } from "./e1rm";
import type { WorkoutWithLogs } from "./pain";
import { primerTarget } from "./reminders";
import { slotFor } from "./schedule";
import { workoutVolume } from "./summary";
import type { MuscleTotals } from "./volume";

export interface LiftPoint { date: string; top: number; e1rm: number | null }

/** Top-set load and best e1RM (est.) per workout for one exercise, oldest first. */
export function liftSeries(_e: Exercise, history: { workout: Workout; logs: SetLog[] }[]): LiftPoint[] {
  return history
    .map((h) => {
      const work = h.logs.filter((l) => !l.isWarmup && (l.reps ?? 0) > 0 && (l.weight ?? 0) > 0);
      if (!work.length) return null;
      const top = Math.max(...work.map((l) => l.weight!));
      const ests = work.map((l) => e1rm(l.weight!, l.reps!)).filter((x): x is number => x !== null);
      return { date: h.workout.date, top, e1rm: ests.length ? Math.round(Math.max(...ests) * 10) / 10 : null, at: h.workout.startedAt };
    })
    .filter((x): x is LiftPoint & { at: string } => x !== null)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ date, top, e1rm: est }) => ({ date, top, e1rm: est }));
}

/** Logged fractional sets per muscle for the Mon–Sun week containing `date`. */
export function weeklyLoggedVolume(workouts: WorkoutWithLogs[], date: string): MuscleTotals {
  const start = weekStart(date);
  const end = addDays(start, 6);
  const t: MuscleTotals = {};
  for (const w of workouts) {
    if (!w.workout.finishedAt || w.workout.date < start || w.workout.date > end) continue;
    const s = program.sessions[w.workout.sessionId];
    if (!s) continue;
    for (const [m, v] of Object.entries(workoutVolume(s, w.logs)) as [MuscleId, number][]) t[m] = (t[m] ?? 0) + v;
  }
  return t;
}

export type MealBucket = "fasted" | "<1 h" | "1–2 h" | "2–3 h" | ">3 h";
export const MEAL_BUCKETS: MealBucket[] = ["fasted", "<1 h", "1–2 h", "2–3 h", ">3 h"];

export function mealBucket(w: Pick<Workout, "mealSize" | "hoursSinceMeal">): MealBucket | null {
  if (w.mealSize === "fasted") return "fasted";
  const h = w.hoursSinceMeal;
  if (h === undefined) return null;
  if (h < 1) return "<1 h";
  if (h <= 2) return "1–2 h";
  if (h <= 3) return "2–3 h";
  return ">3 h";
}

export interface RateRow { group: string; n: number; nauseous: number; rate: number }

const isNauseous = (w: Workout) => w.nausea !== undefined && w.nausea !== "none";

function rates<K extends string>(ws: Workout[], key: (w: Workout) => K | null, order: K[]): RateRow[] {
  return order
    .map((g) => {
      const group = ws.filter((w) => key(w) === g);
      const nauseous = group.filter(isNauseous).length;
      return { group: g, n: group.length, nauseous, rate: group.length ? nauseous / group.length : 0 };
    })
    .filter((r) => r.n > 0);
}

/** Nausea rate per session slot and per meal-timing bucket (descriptive only). */
export function nauseaInsights(workouts: Workout[]) {
  const ws = workouts.filter((w) => w.finishedAt && w.nausea !== undefined);
  return {
    total: ws.length,
    bySlot: rates<Slot>(ws, (w) => w.slot, ["UA", "LA", "UB", "LB"]),
    byMeal: rates<MealBucket>(ws, mealBucket, MEAL_BUCKETS),
  };
}

export interface PainPoint { date: string; during?: number; atRest?: number; morningAfter?: number }

/** Hamstring pain by date: max during-set pain, pain at rest (pre-session/ad-hoc) and morning-after. */
export function painSeries(workouts: WorkoutWithLogs[], checks: PainCheck[]): PainPoint[] {
  const by = new Map<string, PainPoint>();
  const get = (d: string) => by.get(d) ?? (by.set(d, { date: d }), by.get(d)!);
  for (const w of workouts) {
    const s = program.sessions[w.workout.sessionId];
    if (!s) continue;
    const pains = w.logs.filter((l) => !l.isWarmup && s.exercises[l.exerciseIndex]?.hamstringLoad && l.painDuring !== undefined).map((l) => l.painDuring!);
    if (pains.length) {
      const p = get(w.workout.date);
      p.during = Math.max(p.during ?? 0, ...pains);
    }
  }
  for (const c of checks) {
    const p = get(c.date);
    if (c.kind === "morning-after") p.morningAfter = Math.max(p.morningAfter ?? 0, c.painAtRest);
    else p.atRest = Math.max(p.atRest ?? 0, c.painAtRest);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface NordicPoint { date: string; variant: string; reps: number; control: number | null }

export function nordicSeries(workouts: WorkoutWithLogs[]): NordicPoint[] {
  return workouts
    .map((w) => {
      const ls = w.logs.filter((l) => l.exerciseId === "nordic-curl" && !l.isWarmup);
      if (!ls.length) return null;
      const ctl = ls.filter((l) => l.control).map((l) => l.control!);
      return {
        date: w.workout.date, variant: ls[0]!.variant ?? "",
        reps: Math.max(...ls.map((l) => l.reps ?? 0)),
        control: ctl.length ? Math.round((ctl.reduce((a, b) => a + b, 0) / ctl.length) * 10) / 10 : null,
        at: w.workout.startedAt,
      };
    })
    .filter((x): x is NordicPoint & { at: string } => x !== null)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ at: _at, ...p }) => p);
}

export interface PrimerDay { date: string; done: number; target: number }

/** Primer sessions per day for the last `days` days vs the phase's daily target. */
export function primerAdherence(logs: PrimerLog[], phase: Phase, today: string, days = 14): PrimerDay[] {
  const out: PrimerDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ date: d, done: logs.filter((l) => l.date === d).length, target: primerTarget(phase, slotFor(phase, d)).count });
  }
  return out;
}
