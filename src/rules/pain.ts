// Section 7.4: pain rules from phase.painRule. Pure functions; the UI decides when to show them.
import type { PainCheck, PhaseState, SetLog, Workout } from "../db/types";
import type { Phase, Session, Slot } from "../program/types";
import { getSession, program } from "../program/program";
import { addDays } from "./dates";

export interface WorkoutWithLogs { workout: Workout; logs: SetLog[] }

function hamstringLogs(w: WorkoutWithLogs): SetLog[] {
  const s = program.sessions[w.workout.sessionId];
  if (!s) return [];
  return w.logs.filter((l) => !l.isWarmup && s.exercises[l.exerciseIndex]?.hamstringLoad && l.painDuring !== undefined);
}

export interface PainHold { hold: boolean; reasons: string[]; onViolation: string }

/**
 * Phases 1–2: after any hamstring-load set above maxDuringPain in the most recent session that had
 * hamstring work, or a "worse" morning-after check since then, hold loads on hamstring-load exercises.
 */
export function hamstringHold(phase: Phase, recent: WorkoutWithLogs[], checks: PainCheck[]): PainHold {
  const out: PainHold = { hold: false, reasons: [], onViolation: phase.painRule.onViolation };
  if (!phase.painRule.mustSettleByNextMorning) return out;
  const finished = recent.filter((w) => w.workout.finishedAt).sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));
  const last = finished.find((w) => hamstringLogs(w).length > 0);
  if (!last) return out;
  const maxPain = Math.max(...hamstringLogs(last).map((l) => l.painDuring!));
  if (maxPain > phase.painRule.maxDuringPain) {
    out.hold = true;
    out.reasons.push(`Pain ${maxPain}/10 during a set on ${last.workout.date} (rule: ≤ ${phase.painRule.maxDuringPain}/10).`);
  }
  const worse = checks.find((c) => c.kind === "morning-after" && c.vsNormal === "worse" && c.date > last.workout.date);
  if (worse) {
    out.hold = true;
    out.reasons.push(`Morning-after check on ${worse.date} was "worse".`);
  }
  return out;
}

/** Phase 3: any hamstring-load pain > 0 in this workout means the drop-back banner. */
export function needsRegression(phase: Phase, w: WorkoutWithLogs): boolean {
  if (phase.id !== "p3") return false;
  return hamstringLogs(w).some((l) => (l.painDuring ?? 0) > phase.painRule.maxDuringPain);
}

export const REGRESSION_DAYS = 7;
export const regressionUntil = (date: string) => addDays(date, REGRESSION_DAYS);

export function regressionActive(state: Pick<PhaseState, "legRegressionUntil" | "currentPhaseId">, date: string): boolean {
  return state.currentPhaseId === "p3" && !!state.legRegressionUntil && date <= state.legRegressionUntil;
}

/** The session to run for a slot, honouring the Phase 3 leg-regression window (Lower days use Phase 2 sessions). */
export function resolveSession(phase: Phase, slot: Slot, state: Pick<PhaseState, "legRegressionUntil" | "currentPhaseId">, date: string): Session {
  if ((slot === "LA" || slot === "LB") && phase.id === "p3" && regressionActive(state, date)) {
    const p2 = program.phases.find((p) => p.id === "p2")!;
    return getSession(p2.sessionIds[slot]);
  }
  return getSession(phase.sessionIds[slot]);
}

export const P4_STOP_TEXT = "Stop the session and get assessed.";

/** Phase 4: pain during power work (jumps, explosive step-ups) means stop and get assessed. No auto-regression. */
export function p4StopNeeded(phase: Phase, session: Session, logs: SetLog[]): boolean {
  if (phase.id !== "p4") return false;
  return logs.some((l) => {
    const e = session.exercises[l.exerciseIndex];
    return !!e && e.category === "power" && (l.painDuring ?? 0) > 0;
  });
}
