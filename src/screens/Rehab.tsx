import { lazy, Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getPhase, program } from "../program/program";
import type { Phase, PhaseId } from "../program/types";
import type { PhaseState } from "../db/types";
import { db } from "../db/db";
import { recentWorkoutsWithLogs, setCurrentPhase } from "../db/repo";
import { canAdvance, evaluateCriteria, nextPhaseId, prevPhaseId, weeksInPhase, type Evidence } from "../rules/criteria";
import { regressionActive } from "../rules/pain";
import { today } from "../rules/dates";
import { ExpandRow, GroupLabel, Icon, PhaseBadge, ScreenHeader } from "../components/ui";
import { phaseTheme } from "../theme";
const RehabCharts = lazy(() => import("./RehabCharts").then((m) => ({ default: m.RehabCharts })));

const PRIMER_WHEN: Record<Phase["primer"]["schedule"], string> = { daily: "daily", "non-leg-days": "on non-leg days", "warm-up": "in warm-ups" };

function Criterion({ id, text, evidence, ticked, onTick, onUntick }: {
  id: string; text: string; evidence: Evidence | null; ticked: { evidence: string } | undefined;
  onTick: (evidence: string, source: "auto" | "manual") => void; onUntick: () => void;
}) {
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirm = !!evidence?.confirmQuestion && !ticked;
  const tick = () => {
    const auto = evidence?.met ? evidence.text : "";
    const confirmText = evidence?.confirmQuestion ? ` · confirmed ${evidence.confirmQuestion}` : "";
    const ev = [auto ? auto + confirmText : "", note.trim()].filter(Boolean).join(" · ") || "Ticked manually";
    onTick(ev, evidence?.met ? "auto" : "manual");
  };
  let line: { cls: string; text: string };
  if (ticked) line = { cls: "met", text: ticked.evidence };
  else if (evidence?.met) line = { cls: "met", text: `${evidence.text} · tick to confirm` };
  else if (evidence) line = { cls: "", text: evidence.text };
  else line = { cls: "", text: "Tick manually when you've done it" };
  return (
    <div className="crit2" data-testid={`crit-${id}`}>
      <label className="crit-main">
        <input type="checkbox" className="cb" checked={!!ticked} disabled={needsConfirm && !confirmed} aria-label={`Tick: ${text}`}
          onChange={(e) => (e.target.checked ? tick() : onUntick())} />
        <span className="crit-txt">
          <b>{text}</b>
          <small className={line.cls}>{line.text}</small>
        </span>
      </label>
      {!ticked && evidence?.confirmQuestion && (
        <label className="crit-sub">
          <input type="checkbox" className="cb" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Confirm: {evidence.confirmQuestion}?</span>
        </label>
      )}
      {!ticked && (noteOpen ? (
        <input className="textin crit-note" autoFocus placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Note for ${text}`} />
      ) : (
        <button className="textbtn crit-addnote" onClick={() => setNoteOpen(true)}>Add note</button>
      ))}
    </div>
  );
}

function Timeline({ current, progress }: { current: number; progress: number }) {
  return (
    <div className="ptimeline" aria-label="Phase timeline">
      {program.phases.map((p, i) => {
        const t = phaseTheme(p.id);
        const bar = i < current ? { background: t.color }
          : i === current ? { background: `linear-gradient(90deg, ${t.color} ${progress}%, ${t.tint} ${progress}%)` }
          : undefined;
        return (
          <div key={p.id} className={i === current ? "cur" : ""} aria-current={i === current ? "step" : undefined}>
            <div className="bar" style={bar} />
            <span>{p.name.replace("Phase ", "")} · {p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Rehab({ phaseId, phaseState }: { phaseId: PhaseId; phaseState: PhaseState }) {
  const phase = getPhase(phaseId);
  const idx = program.phases.findIndex((p) => p.id === phaseId);
  const date = today();
  const data = useLiveQuery(async () => ({
    workouts: await recentWorkoutsWithLogs(500),
    painChecks: await db.painChecks.toArray(),
    checks: await db.criterionChecks.where("phaseId").equals(phaseId).toArray(),
  }), [phaseId]);

  const evidence = data ? evaluateCriteria(phase, { ...data, phaseStartedAt: phaseState.phaseStartedAt, today: date }) : [];
  const ticked = new Map((data?.checks ?? []).map((c) => [c.id, c]));
  const allTicked = canAdvance(phase, new Set(ticked.keys()));
  const next = nextPhaseId(phase);
  const prev = prevPhaseId(phase);
  const weeks = weeksInPhase(phaseState.phaseStartedAt, date);
  const tickedCount = phase.criteria.filter((c) => ticked.has(c.id)).length;

  const advance = async () => {
    if (!next) return;
    if (!window.confirm(`Every criterion is ticked. Advance to ${getPhase(next).name}: ${getPhase(next).label}?`)) return;
    await setCurrentPhase(next, "advanced");
  };
  const dropBack = async () => {
    if (!prev) return;
    if (!window.confirm(`Drop back to ${getPhase(prev).name}: ${getPhase(prev).label}? Its criteria will need re-ticking before you advance again.`)) return;
    await db.criterionChecks.where("phaseId").equals(prev).delete();
    await setCurrentPhase(prev, "dropped-back");
  };

  return (
    <div className="tpad">
      <ScreenHeader title="Rehab" />
      <Timeline current={idx} progress={phase.criteria.length ? (tickedCount / phase.criteria.length) * 100 : 0} />

      <section className="card phasecard">
        <div className="pc-top">
          <PhaseBadge id={phaseId}>{phase.name} · {phase.label}</PhaseBadge>
          <span className="pc-week">Week {weeks} · plan {phase.weeks.replace(/^Weeks?\s*/, "")}</span>
        </div>
        <p className="pc-goal">{phase.goal}</p>
        <div className="factchips">
          <span>Pain ≤ {phase.painRule.maxDuringPain}/10 in session</span>
          <span>Primer {phase.primer.sets} × {phase.primer.holdSec} s {PRIMER_WHEN[phase.primer.schedule]}</span>
        </div>
        {regressionActive(phaseState, date) && (
          <div className="alertcard"><strong>Leg regression week</strong>Lower days use Phase 2 sessions until {phaseState.legRegressionUntil}.</div>
        )}
      </section>

      <div className="lgroup">
        <ExpandRow icon="alert" title="Pain rule" sub={`${phase.painRule.maxDuringPain}/10 max during exercise`}>
          {phase.painRule.display}
        </ExpandRow>
        <ExpandRow icon="flame" title="Primer holds" sub={`${phase.primer.sets} × ${phase.primer.holdSec} s ${PRIMER_WHEN[phase.primer.schedule]}`}>
          {phase.primer.display}{phase.primer.ifReactive ? ` ${phase.primer.ifReactive}` : ""}
        </ExpandRow>
        <ExpandRow icon="calendar" title="Frequency" sub="Gym days this phase">{phase.frequency}</ExpandRow>
      </div>

      <div className="sechead-row">
        <h3 className="sechead">{phase.criteriaType === "return-to-play" ? "Fully rehabbed checklist" : next ? `Criteria for ${getPhase(next).name}` : "Criteria"}</h3>
        <span>{tickedCount} of {phase.criteria.length} met</span>
      </div>
      <div className="lgroup">
        {phase.criteria.map((c, i) => (
          <Criterion key={c.id} id={c.id} text={c.text} evidence={evidence[i] ?? null} ticked={ticked.get(c.id)}
            onTick={(ev, source) => void db.criterionChecks.put({ id: c.id, phaseId, checkedAt: new Date().toISOString(), evidence: ev, source })}
            onUntick={() => void db.criterionChecks.delete(c.id)} />
        ))}
      </div>
      <div className="fnote">Progress is criteria-based, not time-based. Nothing changes phase automatically.</div>

      {phase.criteriaType === "return-to-play" && allTicked && (
        <div className="okcard"><strong><Icon name="check" size={16} stroke={3} />Every item ticked</strong>Keep this phase going for good. Check with your physio before going all-out in a new sport.</div>
      )}
      <div className="pactions">
        {phase.criteriaType === "advance-to-next-phase" && next && (
          <button className="btn2 primary grow" disabled={!allTicked} onClick={() => void advance()} data-testid="advance">
            Advance to {getPhase(next).name}
          </button>
        )}
        {prev && <button className="btn2 outline dropback" onClick={() => void dropBack()}>Drop back</button>}
      </div>

      <Suspense fallback={null}><RehabCharts phase={phase} /></Suspense>

      <GroupLabel>Phase history</GroupLabel>
      <div className="lgroup">
        {[...phaseState.history].reverse().map((h, i) => (
          <div className="lrow static" key={i}>
            <span className="txt"><b>{getPhase(h.phaseId).name}: {getPhase(h.phaseId).label}</b>
              <small>{h.startedAt}{h.endedAt ? ` → ${h.endedAt}` : " → now"} · {h.reason}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}
