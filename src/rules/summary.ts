import type { SetLog } from "../db/types";
import type { Exercise, MuscleId, Phase, Program, Session } from "../program/types";
import { program as defaultProgram } from "../program/program";
import { e1rm, tracksE1rm } from "./e1rm";
import { addSets, isWorkingExercise, type MuscleTotals } from "./volume";

/** Number of completed working sets for one exercise. Per-side L/R logs of one set count once. */
export function countWorkingSets(logs: SetLog[]): number {
  return new Set(logs.filter((l) => !l.isWarmup).map((l) => `${l.exerciseIndex}:${l.setIndex}`)).size;
}

/** Fractional sets per muscle for one workout (Section 7.6). */
export function workoutVolume(session: Session, logs: SetLog[], p: Program = defaultProgram): MuscleTotals {
  const t: MuscleTotals = {};
  session.exercises.forEach((e, i) => {
    if (!isWorkingExercise(e, p)) return;
    const n = countWorkingSets(logs.filter((l) => l.exerciseIndex === i));
    if (n > 0) addSets(t, e, n);
  });
  return t;
}

export interface PainFlag { exercise: string; setIndex: number; side?: "L" | "R"; pain: number }

export function painFlags(session: Session, logs: SetLog[], phase: Phase): PainFlag[] {
  return logs
    .filter((l) => !l.isWarmup && l.painDuring !== undefined && l.painDuring > phase.painRule.maxDuringPain)
    .filter((l) => session.exercises[l.exerciseIndex]?.hamstringLoad)
    .map((l) => ({ exercise: session.exercises[l.exerciseIndex]!.name, setIndex: l.setIndex, side: l.side, pain: l.painDuring! }));
}

export function cautionMuscles(vol: MuscleTotals, p: Program = defaultProgram): MuscleId[] {
  const lim = p.volumeCounting.perSessionCautionFractionalSets;
  return (Object.entries(vol) as [MuscleId, number][]).filter(([, v]) => v > lim).map(([m]) => m);
}

export interface Best { exercise: string; kind: "top set" | "e1RM"; value: number; previous: number | null }

const loadOf = (l: SetLog) => l.weight ?? 0;

/** New bests vs all earlier logs of the same exerciseId + variant (working sets only). */
export function newBests(e: Exercise, current: SetLog[], previous: SetLog[]): Best[] {
  if (!tracksE1rm(e)) return [];
  const cur = current.filter((l) => !l.isWarmup && (l.reps ?? 0) > 0);
  const prev = previous.filter((l) => !l.isWarmup && (l.reps ?? 0) > 0);
  if (cur.length === 0 || prev.length === 0) return [];
  const out: Best[] = [];
  const topCur = Math.max(...cur.map(loadOf));
  const topPrev = Math.max(...prev.map(loadOf));
  if (topCur > topPrev) out.push({ exercise: e.name, kind: "top set", value: topCur, previous: topPrev });
  const est = (ls: SetLog[]) => Math.max(0, ...ls.map((l) => e1rm(loadOf(l), l.reps ?? 0) ?? 0));
  const eCur = est(cur), ePrev = est(prev);
  if (eCur > 0 && eCur > ePrev + 1e-9) out.push({ exercise: e.name, kind: "e1RM", value: eCur, previous: ePrev || null });
  return out;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

/** "80 kg × 6, 6, 5, 5 @ RIR 2". Per-side shows "L/R". Bodyweight shows "+added". */
export function lastTimeText(e: Exercise, logs: SetLog[], unit: string): string | null {
  const work = logs.filter((l) => !l.isWarmup).sort((a, b) => a.setIndex - b.setIndex || (a.side ?? "").localeCompare(b.side ?? ""));
  if (work.length === 0) return null;
  const bySet = new Map<number, SetLog[]>();
  for (const l of work) bySet.set(l.setIndex, [...(bySet.get(l.setIndex) ?? []), l]);
  const sets = [...bySet.values()];
  const repsText = sets
    .map((s) => (s.length > 1 ? s.map((l) => l.reps ?? "–").join("/") : String(s[0]!.reps ?? "✓")))
    .join(", ");
  const weights = [...new Set(work.map((l) => (e.equipment === "bodyweight" ? l.addedWeight ?? 0 : l.weight ?? 0)))];
  let load = "";
  if (e.equipment === "bodyweight") {
    const w = Math.max(...weights);
    load = w > 0 ? `BW +${fmt(w)} ${unit} × ` : "";
  } else {
    load = weights.length === 1 ? `${fmt(weights[0]!)} ${unit} × ` : `${weights.map(fmt).join("/")} ${unit} × `;
  }
  const rirs = [...new Set(work.map((l) => l.rir).filter((r): r is number => r !== undefined))];
  const rir = rirs.length === 0 ? "" : ` @ RIR ${rirs.length === 1 ? rirs[0] : `${Math.min(...rirs)}–${Math.max(...rirs)}`}`;
  return `${load}${repsText}${rir}`;
}
