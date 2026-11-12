import type { DaySlot, Phase, Slot } from "../program/types";
import { SLOT_ORDER } from "../program/program";
import { sameWeek, weekdayOf } from "./dates";

/** The planned slot for a date, from phase.week. */
export function slotFor(phase: Phase, date: string): DaySlot {
  const day = weekdayOf(date);
  const entry = phase.week.find((w) => w.day === day);
  return entry ? entry.slot : "REST";
}

export interface CompletedSession { date: string; slot: Slot; finished: boolean }

/** First slot of UA→LA→UB→LB not completed in the current Mon–Sun week, or null if all are done. */
export function nextSession(_phase: Phase, logs: CompletedSession[], date: string): Slot | null {
  const done = new Set(logs.filter((l) => l.finished && sameWeek(l.date, date)).map((l) => l.slot));
  return SLOT_ORDER.find((s) => !done.has(s)) ?? null;
}
