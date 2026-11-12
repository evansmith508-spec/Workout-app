// Styling only (design/HANDOFF.md §2): tint and ink colors for each phase badge.
// The base phase color still comes from program.json (phase.color).
import { getPhase } from "./program/program";
import type { PhaseId } from "./program/types";

const PHASE_TINTS: Record<PhaseId, { tint: string; ink: string }> = {
  p1: { tint: "#E6EFFE", ink: "#1E3A8A" },
  p2: { tint: "#FBF3D5", ink: "#6B4F00" },
  p3: { tint: "#FFEDDF", ink: "#9A3412" },
  p4: { tint: "#DDF6EC", ink: "#065F46" },
};

export function phaseTheme(id: PhaseId) {
  return { color: getPhase(id).color, ...PHASE_TINTS[id] };
}

/** Set --phase, --phase-tint and --phase-ink on the document root. */
export function applyPhaseTheme(id: PhaseId) {
  const t = phaseTheme(id);
  const s = document.documentElement.style;
  s.setProperty("--phase", t.color);
  s.setProperty("--phase-tint", t.tint);
  s.setProperty("--phase-ink", t.ink);
}
