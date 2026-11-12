import { useEffect, useState } from "react";
import { db, newId } from "../db/db";
import type { Phase } from "../program/types";
import { today } from "../rules/dates";
import { Stepper } from "./controls";
import { Sheet } from "./Sheet";
import { Icon, NumberRow, OptionTiles } from "./ui";

const VS = ["better", "same", "worse"] as const;

const VS_ICON = { better: "arrowUp", same: "minus", worse: "arrowDown" } as const;

/** Day after a Lower session: full screen, shown before anything else on Today (design/HANDOFF.md §5.4). */
export function MorningCheck({ date, weekday, sessionName, phase, onLater }: {
  date: string; weekday: string; sessionName: string | null; phase: Phase; onLater: () => void;
}) {
  const [vs, setVs] = useState<(typeof VS)[number] | null>(null);
  const [pain, setPain] = useState(0);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const save = async () => {
    if (!vs) return;
    await db.painChecks.add({ id: newId(), date, kind: "morning-after", painAtRest: pain, vsNormal: vs });
  };
  return (
    <div className="mcheck" role="dialog" aria-modal="true" aria-labelledby="mcheck-title" data-testid="morning-after">
      <div className="mc-body">
        <div className="mc-head">
          <span className="mc-icon"><Icon name="sun" size={26} /></span>
          <span className="eyebrow">{weekday} · Morning check</span>
          <h1 id="mcheck-title">How's the hamstring after {sessionName ?? "yesterday's Lower day"}?</h1>
          <p>Two quick taps before anything else. This feeds your phase criteria.</p>
        </div>
        <fieldset className="fset">
          <legend>Compared with normal</legend>
          <OptionTiles label="Hamstring compared with normal" options={VS} value={vs} onChange={setVs} tall
            render={(v) => <><span className={`vsicon ${v}`}><Icon name={VS_ICON[v]} size={22} stroke={2.4} /></span><span>{v.charAt(0).toUpperCase() + v.slice(1)}</span></>} />
        </fieldset>
        <fieldset className="fset">
          <legend>Pain at rest</legend>
          <NumberRow label="Pain at rest 0 to 10" from={0} to={10} cols={6} value={pain} onChange={setPain} ends={["No pain", "Worst imaginable"]} />
        </fieldset>
        <div className="rulebox">
          <span className="dot" aria-hidden />
          <div><b>{phase.name} pain rule</b><span>{phase.painRule.display}</span></div>
        </div>
      </div>
      <div className="mc-actions">
        <button className="btn2 primary block" disabled={!vs} onClick={() => void save()}>Save check</button>
        <button className="textbtn later" onClick={onLater}>Remind me later</button>
      </div>
    </div>
  );
}

export function PreSessionCheck() {
  const [pain, setPain] = useState(0);
  const [saved, setSaved] = useState(false);
  if (saved) return <div className="card presess saved"><b>Pre-session check saved</b><span>Pain at rest {pain}/10.</span></div>;
  return (
    <div className="card presess">
      <div className="presess-head"><b>Pre-session check</b><span className="opt">Optional</span></div>
      <div className="presess-q">Hamstring pain at rest</div>
      <NumberRow label="Hamstring pain at rest before session" from={0} to={10} cols={6} value={pain} onChange={setPain} />
      <button className="btn2 secondary block" onClick={() => void db.painChecks.add({ id: newId(), date: today(), kind: "pre-session", painAtRest: pain }).then(() => setSaved(true))}>Save check</button>
    </div>
  );
}

export function PrimerSheet({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  const [sets, setSets] = useState(phase.primer.sets);
  const [effort, setEffort] = useState(phase.primer.effortPct?.[0] ?? 60);
  const [pain, setPain] = useState(0);
  const save = async () => {
    const now = new Date();
    await db.primerLogs.add({
      id: newId(), date: today(), time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      setsDone: sets, effortPct: effort, pain,
    });
    onClose();
  };
  return (
    <Sheet title="Log primer holds" onClose={onClose}>
      <div className="editor">
        <div className="sheet-text">{phase.primer.display}</div>
        {phase.primer.ifReactive && <div className="rulebox"><span className="dot" aria-hidden /><div><b>If it feels reactive</b><span>{phase.primer.ifReactive}</span></div></div>}
        <HoldTimer seconds={phase.primer.holdSec} />
        <Stepper label="Sets done (each angle)" value={sets} step={1} min={0} max={20} onChange={setSets} />
        <Stepper label="Effort" value={effort} step={5} min={10} max={100} unit="%" onChange={setEffort} />
        <div>
          <div className="stepper-label">Pain</div>
          <NumberRow label="Primer pain 0 to 10" from={0} to={10} cols={6} value={pain} onChange={setPain} />
        </div>
      </div>
      <button className="btn2 primary block" onClick={() => void save()}>Save primer session</button>
    </Sheet>
  );
}

/** Tap-to-start countdown for timed holds. */
export function HoldTimer({ seconds, label = "Hold" }: { seconds: number; label?: string }) {
  const [end, setEnd] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (end === null) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [end]);
  const start = () => setEnd(Date.now() + seconds * 1000);
  return (
    <button className={`btn2 secondary block holdtimer ${left === 0 ? "done" : ""}`} onClick={start}>
      <Icon name={left === 0 ? "check" : "play"} size={16} />
      {left === null ? `${label} ${seconds} s` : left === 0 ? "Done · tap to restart" : `${label}: ${left} s`}
    </button>
  );
}
