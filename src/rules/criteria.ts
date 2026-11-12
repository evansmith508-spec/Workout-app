// Section 7.5: phase criteria. Auto-checks only pre-fill evidence; the user always confirms.
import type { PainCheck } from "../db/types";
import type { AutoCheck, Exercise, Phase } from "../program/types";
import { program } from "../program/program";
import { addDays, parseISODate } from "./dates";
import type { WorkoutWithLogs } from "./pain";
import { workingSets } from "./progression";

export interface Evidence { met: boolean; text: string; date?: string; confirmQuestion?: string }

const shortDate = (iso: string) => parseISODate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function exerciseFor(exerciseId: string, variant?: string): Exercise | undefined {
  for (const s of Object.values(program.sessions))
    for (const e of s.exercises) if (e.exerciseId === exerciseId && (variant === undefined || e.variant === variant)) return e;
  return undefined;
}

function variantLabel(e: Exercise): string {
  return e.name;
}

export interface CriteriaData { workouts: WorkoutWithLogs[]; painChecks: PainCheck[]; phaseStartedAt: string; today: string }

export function evaluateAutoCheck(check: AutoCheck, data: CriteriaData): Evidence {
  if ("exerciseId" in check) {
    const e = exerciseFor(check.exerciseId, check.variant);
    if (!e) return { met: false, text: "Exercise not in the plan." };
    const candidates = data.workouts
      .filter((w) => w.workout.finishedAt)
      .sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));
    for (const w of candidates) {
      const logs = w.logs.filter((l) => l.exerciseId === check.exerciseId && (check.variant === undefined || l.variant === check.variant) && !l.isWarmup);
      if (!logs.length) continue;
      const sets = workingSets(e, logs).filter((s) => {
        if (check.minReps !== undefined && s.reps < check.minReps) return false;
        if (check.painMax !== undefined && (s.pain ?? 0) > check.painMax) return false;
        if (check.perSide && check.sideDiffMaxPct !== undefined) {
          const side = logs.filter((l) => l.setIndex === s.setIndex);
          const L = side.find((l) => l.side === "L")?.reps ?? 0;
          const R = side.find((l) => l.side === "R")?.reps ?? 0;
          const hi = Math.max(L, R);
          if (hi === 0 || ((hi - Math.min(L, R)) / hi) * 100 > check.sideDiffMaxPct) return false;
        }
        return true;
      });
      if (sets.length >= check.minSets) {
        const reps = Math.min(...sets.map((s) => s.reps));
        const pain = check.painMax !== undefined ? `, pain ≤ ${Math.max(...sets.map((s) => s.pain ?? 0))}/10` : "";
        return {
          met: true, date: w.workout.date,
          text: `Met on ${shortDate(w.workout.date)}: ${variantLabel(e)} ${sets.length}×${reps}${check.perSide ? " each side" : ""}${pain}`,
          confirmQuestion: check.requiresUserConfirm,
        };
      }
    }
    return { met: false, text: "Not met in your logs yet.", confirmQuestion: check.requiresUserConfirm };
  }


  const days = check.morningAfterNotWorseForDays;
  const from = addDays(data.today, -(days - 1));
  const window = data.painChecks.filter((c) => c.kind === "morning-after" && c.date >= from && c.date <= data.today);
  const worse = window.filter((c) => c.vsNormal === "worse");
  if (data.phaseStartedAt > addDays(data.today, -(days - 1))) {
    return { met: false, text: `Needs ${days} days in this phase.` };
  }
  if (window.length === 0) return { met: false, text: `No morning-after checks in the last ${days} days.` };
  if (worse.length) return { met: false, text: `"Worse" on ${shortDate(worse[worse.length - 1]!.date)}.` };
  return { met: true, date: data.today, text: `No flare in ${days} days (${window.length} morning-after check${window.length > 1 ? "s" : ""}).` };
}

export function evaluateCriteria(phase: Phase, data: CriteriaData): (Evidence | null)[] {
  return phase.criteria.map((c) => (c.autoCheck ? evaluateAutoCheck(c.autoCheck, data) : null));
}

/** Advance only when every criterion is ticked. */
export function canAdvance(phase: Phase, tickedIds: Set<string>): boolean {
  return phase.criteriaType === "advance-to-next-phase" && phase.criteria.every((c) => tickedIds.has(c.id));
}

export function nextPhaseId(phase: Phase): Phase["id"] | null {
  const i = program.phases.findIndex((p) => p.id === phase.id);
  return program.phases[i + 1]?.id ?? null;
}
export function prevPhaseId(phase: Phase): Phase["id"] | null {
  const i = program.phases.findIndex((p) => p.id === phase.id);
  return i > 0 ? program.phases[i - 1]!.id : null;
}

/** Whole weeks in the current phase, for information only. */
export function weeksInPhase(startedAt: string, today: string): number {
  return Math.floor((parseISODate(today).getTime() - parseISODate(startedAt).getTime()) / (7 * 86400000)) + 1;
}

/** Was this the day after a Lower session? (for the morning-after prompt) */
export function lowerYesterday(workouts: { date: string; slot: string; finishedAt?: string }[], today: string): boolean {
  const y = addDays(today, -1);
  return workouts.some((w) => w.date === y && !!w.finishedAt && (w.slot === "LA" || w.slot === "LB"));
}
