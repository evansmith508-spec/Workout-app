// Export / import / reset (JSON backup) and CSV export of set logs. Section 2 must-haves.
import { ALL_TABLES, db as defaultDb, type TableName, type TrackerDB } from "./db";
import { program } from "../program/program";

export const BACKUP_APP = "workout-tracker";

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  planVersion: string;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export async function exportAll(d: TrackerDB = defaultDb): Promise<Backup> {
  const tables = {} as Record<TableName, unknown[]>;
  await d.transaction("r", ALL_TABLES.map((t) => d.table(t)), async () => {
    for (const t of ALL_TABLES) tables[t] = await d.table(t).toArray();
  });
  return { app: BACKUP_APP, schemaVersion: d.verno, planVersion: program.meta.version, exportedAt: new Date().toISOString(), tables };
}

export async function resetAll(d: TrackerDB = defaultDb): Promise<void> {
  await d.transaction("rw", ALL_TABLES.map((t) => d.table(t)), async () => {
    for (const t of ALL_TABLES) await d.table(t).clear();
  });
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP || typeof b.tables !== "object" || b.tables === null) throw new Error("That file isn't a Workout Tracker backup.");
  for (const [k, v] of Object.entries(b.tables)) {
    if (!(ALL_TABLES as readonly string[]).includes(k)) throw new Error(`Unknown table "${k}" in backup.`);
    if (!Array.isArray(v)) throw new Error(`Table "${k}" is not a list.`);
  }
  return b as Backup;
}

/** Replaces every table with the backup's contents (missing tables become empty). */
export async function importAll(backup: Backup, d: TrackerDB = defaultDb): Promise<void> {
  await d.transaction("rw", ALL_TABLES.map((t) => d.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await d.table(t).clear();
      const rows = backup.tables[t] ?? [];
      if (rows.length) await d.table(t).bulkPut(rows);
    }
  });
}

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function setLogsCsv(d: TrackerDB = defaultDb): Promise<string> {
  const [workouts, logs, settings] = await Promise.all([d.workouts.toArray(), d.setLogs.toArray(), d.settings.get("singleton")]);
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const header = ["date", "phase", "session", "exercise", "exerciseId", "variant", "set", "side", "warmup", `weight_${settings?.units ?? "kg"}`, `added_${settings?.units ?? "kg"}`, "reps", "rir", "pain", "control", "note", "completedAt"];
  const rows = logs
    .map((l) => ({ l, w: wById.get(l.workoutId) }))
    .sort((a, b) => (a.w?.startedAt ?? "").localeCompare(b.w?.startedAt ?? "") || a.l.exerciseIndex - b.l.exerciseIndex || a.l.setIndex - b.l.setIndex)
    .map(({ l, w }) => {
      const ex = w ? program.sessions[w.sessionId]?.exercises[l.exerciseIndex] : undefined;
      return [w?.date, w?.phaseId, w?.sessionId, ex?.name, l.exerciseId, l.variant, l.setIndex + 1, l.side, l.isWarmup ? "yes" : "", l.weight, l.addedWeight, l.reps, l.rir, l.painDuring, l.control, l.note, l.completedAt].map(csvCell).join(",");
    });
  return [header.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
