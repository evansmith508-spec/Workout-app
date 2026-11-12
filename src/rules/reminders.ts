// Section 7.8: primer reminders (in-app only).
import type { DaySlot, Phase } from "../program/types";

export interface PrimerTarget { count: number; text: string }

export function primerTarget(phase: Phase, slot: DaySlot): PrimerTarget {
  const p = phase.primer;
  if (p.schedule === "daily") {
    const [lo, hi] = p.timesPerDay ?? [1, 1];
    return { count: lo, text: `${lo}–${hi}× today` };
  }
  if (p.schedule === "non-leg-days") {
    return slot === "LA" || slot === "LB" ? { count: 0, text: "Leg day: skip" } : { count: 1, text: "1× today" };
  }
  return { count: 0, text: "In session warm-up" };
}
