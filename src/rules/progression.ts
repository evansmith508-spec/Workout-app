// Section 7.3: load suggestions. Pure: give it history, settings and the pain hold; it returns a suggestion.
import type { SetLog, Settings } from "../db/types";
import type { Exercise, Phase } from "../program/types";
import { isAtMax, nextLoadableUp, roundToLoadable } from "./loadable";
import type { PainHold, WorkoutWithLogs } from "./pain";

export interface Suggestion {
  /** Load to prefill (weight, or added weight for bodyweight). undefined = no load suggestion. */
  load?: number;
  /** Reps to prefill per set (undefined = use last/plan). */
  reps?: number;
  /** Short headline, e.g. "82.5 kg" or "Keep 80 kg". */
  text: string;
  /** One-line reason. */
  reason: string;
  /** Extra notes (pain-rule text, cues). */
  notes: string[];
  tone: "up" | "keep" | "down" | "info" | "hold";
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export interface SetSummary { setIndex: number; reps: number; load: number; pain?: number; control?: 1 | 2 | 3 }

/** Collapse a session's logs to one entry per working set; per-side sets are judged by the weaker side. */
export function workingSets(e: Exercise, logs: SetLog[]): SetSummary[] {
  const by = new Map<number, SetLog[]>();
  for (const l of logs) if (!l.isWarmup && !l.note?.startsWith("max-test")) by.set(l.setIndex, [...(by.get(l.setIndex) ?? []), l]);
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setIndex, ls]) => {
      const weakest = ls.reduce((a, b) => ((b.reps ?? 0) < (a.reps ?? 0) ? b : a));
      return {
        setIndex,
        reps: weakest.reps ?? 0,
        load: (e.equipment === "bodyweight" ? weakest.addedWeight : weakest.weight) ?? 0,
        pain: Math.max(...ls.map((l) => l.painDuring ?? 0)),
        control: ls.reduce<1 | 2 | 3 | undefined>((m, l) => (l.control && (!m || l.control < m) ? l.control : m), undefined),
      };
    });
}

const belowMin = (e: Exercise, sets: SetSummary[]) => e.prescription.repsMin != null && sets.some((s) => s.reps < e.prescription.repsMin!);

function doubleProgression(e: Exercise, history: WorkoutWithLogs[], s: Settings): Suggestion {
  const unit = s.units;
  const last = workingSets(e, history[0]!.logs);
  const load = Math.max(...last.map((x) => x.load));
  const { repsMin, repsMax } = e.prescription;
  if (repsMax == null || repsMin == null) {
    return { load, text: `${fmt(load)} ${unit}`, reason: "Same load as last time.", notes: [], tone: "keep" };
  }
  // Reps only: logged effort (RIR) is not part of the decision.
  const allMax = last.length > 0 && last.every((x) => x.reps >= repsMax);

  if (e.equipment === "dumbbell" && isAtMax(load, e, s) && allMax) {
    const top = repsMax + 3;
    const best = Math.min(...last.map((x) => x.reps));
    if (best >= top) {
      return { load, reps: top, text: `Keep ${fmt(load)} ${unit}`, reason: `Heaviest dumbbell and ${top} reps reached: slow the lowering to 3 s.`, notes: [], tone: "keep" };
    }
    return {
      load, reps: Math.min(best + 1, top), text: `Keep ${fmt(load)} ${unit}`,
      reason: `Heaviest dumbbell: +1 rep (up to ${top}), then slow the lowering to 3 s.`, notes: [], tone: "keep",
    };
  }
  if (allMax) {
    const up = nextLoadableUp(load, e, s);
    if (up == null) return { load, text: `Keep ${fmt(load)} ${unit}`, reason: "Top of your loadable range: add a rep or slow the lowering.", notes: [], tone: "keep" };
    return { load: up, reps: repsMin, text: `${fmt(up)} ${unit}`, reason: `Every set hit ${repsMax} reps: next step up.`, notes: [], tone: "up" };
  }
  if (belowMin(e, last)) {
    const prev = history[1] ? workingSets(e, history[1].logs) : null;
    if (prev && belowMin(e, prev)) {
      const down = roundToLoadable(load * 0.9, e, s);
      return { load: down, text: `${fmt(down)} ${unit}`, reason: `Below ${repsMin} reps two sessions in a row: drop ~10% and build back up.`, notes: [], tone: "down" };
    }
    return { load, text: `Keep ${fmt(load)} ${unit}`, reason: `A set fell below ${repsMin} reps: keep the load and own the range.`, notes: [], tone: "keep" };
  }
  return { load, text: `Keep ${fmt(load)} ${unit}`, reason: "Aim for +1 rep on your earliest sets.", notes: [], tone: "keep" };
}

function nordic(e: Exercise, history: WorkoutWithLogs[]): Suggestion {
  const last = workingSets(e, history[0]!.logs);
  const repsMax = e.prescription.repsMax ?? 0;
  const best = Math.min(...last.map((x) => x.reps));
  const allMax = last.every((x) => x.reps >= repsMax);
  const allControl3 = last.every((x) => x.control === 3);
  const control2 = last.every((x) => (x.control ?? 0) >= 2);
  if (allMax && allControl3) {
    return {
      reps: repsMax, text: `Hold ${repsMax} reps`,
      reason: e.variant === "fingertip-assist" ? "All sets at the top with control 3: use less fingertip help." : "All sets at the top with control 3. Variant changes come with a phase change.",
      notes: [], tone: "up",
    };
  }
  if (control2) return { reps: Math.min(best + 1, repsMax), text: `${Math.min(best + 1, repsMax)} reps`, reason: `Control ≥ 2 last time: add a rep toward ${repsMax}.`, notes: [], tone: "up" };
  return { reps: best, text: `Keep ${best} reps`, reason: "Build control to ≥ 2 (halfway) before adding reps.", notes: [], tone: "keep" };
}

function slider(e: Exercise, history: WorkoutWithLogs[]): Suggestion {
  const last = workingSets(e, history[0]!.logs);
  const repsMax = e.prescription.repsMax ?? 0;
  const best = Math.min(...last.map((x) => x.reps));
  const maxPain = Math.max(0, ...last.map((x) => x.pain ?? 0));
  if (e.variant === "two-leg-eccentric" && last.every((x) => x.reps >= repsMax) && maxPain <= 2) {
    return { reps: repsMax, text: "Ready for single-leg lowering", reason: `All sets at ${repsMax} with pain ≤ 2/10. Confirm full range (Phase 1 criterion).`, notes: [], tone: "up" };
  }
  if (best < repsMax) return { reps: best + 1, text: `${best + 1} reps`, reason: "Add a rep.", notes: [], tone: "up" };
  return { reps: repsMax, text: `Hold ${repsMax} reps`, reason: "At the top of the range: own the control.", notes: [], tone: "keep" };
}

function repsOrRange(e: Exercise, history: WorkoutWithLogs[], phase: Phase): Suggestion {
  const last = workingSets(e, history[0]!.logs);
  const planned = e.prescription.sets ?? last.length;
  const best = Math.min(...last.map((x) => x.reps));
  const painOk = !e.hamstringLoad || last.every((x) => (x.pain ?? 0) <= phase.painRule.maxDuringPain);
  const complete = last.length >= planned && (e.prescription.repsMin == null || best >= e.prescription.repsMin);
  if (complete && painOk) {
    return e.progression === "range"
      ? { reps: best, text: "A little more range", reason: "All sets done within the pain rule.", notes: [], tone: "up" }
      : { reps: best + 1, text: `${best + 1} reps`, reason: "All sets done within the pain rule: +1 rep.", notes: [], tone: "up" };
  }
  return { reps: best, text: `Keep ${best} reps`, reason: painOk ? "Complete every set first." : "Pain was above the rule: hold.", notes: [], tone: "keep" };
}

/** Pull-up stage from the latest max-reps test (Section 7.3). */
export function pullupStage(maxReps: number): 1 | 2 | 3 | 4 {
  if (maxReps <= 0) return 1;
  if (maxReps <= 5) return 2;
  if (maxReps <= 10) return 3;
  return 4;
}
export const PULLUP_RETEST_DAYS = 14;

export interface PullupTest { date: string; reps: number }
export function latestPullupTest(history: WorkoutWithLogs[]): PullupTest | null {
  for (const h of history) {
    const t = h.logs.filter((l) => l.note?.startsWith("max-test"));
    if (t.length) return { date: h.workout.date, reps: Math.max(...t.map((l) => l.reps ?? 0)) };
  }
  return null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

export interface SuggestContext { settings: Settings; phase: Phase; hold: PainHold; today: string }

/**
 * Suggest the next session's load/reps for one exercise from its history (newest first, same exerciseId + variant).
 * The pain hold beats everything for hamstring-load exercises.
 */
export function suggest(e: Exercise, history: WorkoutWithLogs[], ctx: SuggestContext): Suggestion | null {
  if (e.progression === "quality") return { text: "Quality first", reason: e.cue, notes: [], tone: "info" };

  if (e.progression === "pullup-stage") {
    const t = latestPullupTest(history);
    if (!t) return { text: "Do a max-reps test", reason: "Log one all-out set as a test to set your stage.", notes: [], tone: "info" };
    const stage = pullupStage(t.reps);
    const age = daysBetween(t.date, ctx.today);
    const notes = age >= PULLUP_RETEST_DAYS ? [`Last test was ${age} days ago: retest today.`] : [];
    return { text: `Stage ${stage}`, reason: `Max test ${t.reps} reps on ${t.date}. See the cues for the stage.`, notes, tone: "info" };
  }

  const withLogs = history.filter((h) => workingSets(e, h.logs).length > 0);
  if (withLogs.length === 0) return null;

  let s: Suggestion;
  switch (e.progression) {
    case "double": s = doubleProgression(e, withLogs, ctx.settings); break;
    case "nordic": s = nordic(e, withLogs); break;
    case "slider": s = slider(e, withLogs); break;
    default: s = repsOrRange(e, withLogs, ctx.phase);
  }

  if (e.hamstringLoad && ctx.hold.hold) {
    const last = workingSets(e, withLogs[0]!.logs);
    const lastLoad = Math.max(...last.map((x) => x.load));
    const lastReps = Math.min(...last.map((x) => x.reps));
    const unit = ctx.settings.units;
    const notes = [...ctx.hold.reasons, ctx.hold.onViolation];
    if (e.equipment === "barbell" || e.equipment === "dumbbell") {
      const less = roundToLoadable(lastLoad * 0.9, e, ctx.settings);
      return {
        load: lastLoad, reps: lastReps, text: `No increase: ${fmt(lastLoad)} ${unit}`,
        reason: `Pain rule: hold the load. Or reduce range, or use ~10% less (${fmt(less)} ${unit}).`, notes, tone: "hold",
      };
    }
    return { load: s.load !== undefined ? lastLoad : undefined, reps: lastReps, text: "No increase", reason: "Pain rule: hold reps and load; reduce range if needed.", notes, tone: "hold" };
  }
  return s;
}
