// Local yyyy-mm-dd dates; the week starts Monday.
import type { Weekday } from "../program/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(iso: string): Weekday {
  return WEEKDAYS[parseISODate(iso).getDay()]!;
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const dow = parseISODate(iso).getDay(); // 0 = Sun
  return addDays(iso, -((dow + 6) % 7));
}

export function sameWeek(a: string, b: string): boolean {
  return weekStart(a) === weekStart(b);
}

export function today(): string {
  return toISODate(new Date());
}
