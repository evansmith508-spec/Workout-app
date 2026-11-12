// Section 7.2: weights the user can actually load with their equipment.
import type { Settings } from "../db/types";
import type { Exercise } from "../program/types";

const EPS = 1e-6;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * All achievable barbell totals: the bar plus one plate per side from each pair in the inventory.
 * `settings.plates` lists the pairs available (repeat a size to own several pairs of it).
 */
export function barbellLoads(s: Pick<Settings, "barbellWeight" | "plates">): number[] {
  let sums = new Set<number>([0]);
  for (const p of s.plates) {
    const next = new Set(sums);
    for (const x of sums) next.add(r3(x + p));
    sums = next;
  }
  return [...sums].map((x) => r3(s.barbellWeight + 2 * x)).sort((a, b) => a - b);
}

export function dumbbellLoads(s: Pick<Settings, "dumbbell">): number[] {
  const { min, max, step } = s.dumbbell;
  const out: number[] = [];
  for (let w = min; w <= max + EPS; w = r3(w + step)) out.push(r3(w));
  return out;
}

function loadsFor(e: Pick<Exercise, "equipment">, s: Settings): number[] | null {
  if (e.equipment === "barbell") return barbellLoads(s);
  if (e.equipment === "dumbbell") return dumbbellLoads(s);
  return null;
}

/** Nearest achievable load (ties round down, the safer side). Bodyweight "added" loads snap to the dumbbell step. */
export function roundToLoadable(target: number, e: Pick<Exercise, "equipment">, s: Settings): number {
  const loads = loadsFor(e, s);
  if (!loads) return Math.max(0, r3(Math.round(target / s.dumbbell.step) * s.dumbbell.step));
  let best = loads[0]!;
  for (const w of loads) if (Math.abs(w - target) < Math.abs(best - target) - EPS) best = w;
  return best;
}

/** Smallest achievable load strictly above `current`, or null at the top of the range. */
export function nextLoadableUp(current: number, e: Pick<Exercise, "equipment">, s: Settings): number | null {
  const loads = loadsFor(e, s);
  if (!loads) return r3(current + s.dumbbell.step);
  return loads.find((w) => w > current + EPS) ?? null;
}

export function isAtMax(current: number, e: Pick<Exercise, "equipment">, s: Settings): boolean {
  return nextLoadableUp(current, e, s) === null;
}
