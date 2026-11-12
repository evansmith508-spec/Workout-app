import type { Exercise } from "../program/types";

/** Epley estimate, only for sets of ≤ 10 reps. Always label it "est." in the UI. */
export function e1rm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps > 0) || reps > 10) return null;
  return weight * (1 + reps / 30);
}

/** e1RM applies to barbell and dumbbell compound lifts only. */
export function tracksE1rm(e: Pick<Exercise, "category" | "equipment">): boolean {
  return e.category === "compound" && (e.equipment === "barbell" || e.equipment === "dumbbell");
}
