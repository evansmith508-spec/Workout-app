// program.json is the single source of truth for the plan. Never hand-copy its content.
import raw from "../../program.json";
import type { Phase, PhaseId, Program, Session, Slot } from "./types";

export const program = raw as unknown as Program;

export function getPhase(id: PhaseId, p: Program = program): Phase {
  const phase = p.phases.find((x) => x.id === id);
  if (!phase) throw new Error(`Unknown phase ${id}`);
  return phase;
}

export function getSession(id: string, p: Program = program): Session {
  const s = p.sessions[id];
  if (!s) throw new Error(`Unknown session ${id}`);
  return s;
}

export function sessionForSlot(phase: Phase, slot: Slot, p: Program = program): Session {
  return getSession(phase.sessionIds[slot], p);
}

export const SLOT_ORDER: Slot[] = ["UA", "LA", "UB", "LB"];
export const isSlot = (s: string): s is Slot => (SLOT_ORDER as string[]).includes(s);
