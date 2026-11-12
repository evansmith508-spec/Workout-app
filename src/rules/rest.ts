import type { Session } from "../program/types";

/**
 * Seconds of rest to start after a set of `session.exercises[exerciseIndex]` is ticked, or null for no timer.
 * - First exercise of a superset: no timer (go straight into the second).
 * - Second exercise of a superset: the pair rest (from its own rest block).
 * - Compound lifts use rest.maxSec; everything else rest.minSec.
 */
export function restSeconds(session: Session, exerciseIndex: number): number | null {
  const ex = session.exercises[exerciseIndex];
  if (!ex || ex.superset === "first") return null;
  let compound = ex.category === "compound";
  if (ex.superset === "second") {
    const first = session.exercises[exerciseIndex - 1];
    compound = compound || first?.category === "compound";
  }
  const r = ex.rest;
  if (!r) return null;
  const sec = compound ? r.maxSec ?? r.minSec : r.minSec ?? r.maxSec;
  return sec && sec > 0 ? sec : null;
}

export const REST_ADJUST_SEC = 15;
