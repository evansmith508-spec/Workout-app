import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { program } from "../program/program";
import type { MobilityRoutine } from "../program/types";
import { db } from "../db/db";
import { useSettings } from "../db/hooks";
import { today } from "../rules/dates";
import { Icon, ScreenHeader } from "../components/ui";

const key = (date: string, id: string) => `wt.mob.${date}.${id}`;
function loadChecked(date: string, id: string, n: number): boolean[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(date, id)) ?? "null") as boolean[] | null;
    if (Array.isArray(v) && v.length === n) return v;
  } catch { /* ignore */ }
  return Array(n).fill(false) as boolean[];
}

/** A running hold: which item, which side, and when it ends (or how much is left while paused). */
interface Hold { item: number; side: "L" | "R" | null; total: number; endAt: number | null; left: number }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const holdSec = (r: MobilityRoutine, i: number) => r.items[i]!.prescription.timeSecMax ?? r.items[i]!.prescription.timeSecMin ?? 0;

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** The dark "holding" card with a progress ring (design/HANDOFF.md §5.7). */
function HoldCard({ r, hold, now, onPause, onResume, onNextSide, onClose, onDone }: {
  r: MobilityRoutine; hold: Hold; now: number;
  onPause: () => void; onResume: () => void; onNextSide: () => void; onClose: () => void; onDone: () => void;
}) {
  const it = r.items[hold.item]!;
  const left = hold.endAt !== null ? Math.max(0, Math.ceil((hold.endAt - now) / 1000)) : hold.left;
  const finished = left === 0;
  const R = 33;
  const C = 2 * Math.PI * R;
  const frac = hold.total ? left / hold.total : 0;
  const sideText = hold.side === "L" ? "Left side" : hold.side === "R" ? "Right side" : "";
  const status = finished
    ? hold.side === "L" ? "Left done · switch sides" : "Hold done"
    : `${hold.endAt === null ? "Paused" : "Holding"}${sideText ? ` · ${sideText}` : ""}`;
  return (
    <section className="holdcard" aria-live="polite">
      <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${left} seconds left of ${hold.total}`} className="ring">
        <circle cx="38" cy="38" r={R} fill="none" className="track" strokeWidth="6" />
        <circle cx="38" cy="38" r={R} fill="none" className="prog" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 38 38)" />
        <text x="38" y="44" textAnchor="middle">{mmss(left)}</text>
      </svg>
      <div className="hc-txt">
        <span className="hc-status">{status}</span>
        <b>{it.name}</b>
        <span className="hc-cue">{it.cue}</span>
      </div>
      <div className="hc-btns">
        {finished ? (
          hold.side === "L"
            ? <button className="hbtn wide" onClick={onNextSide}>Start right</button>
            : <button className="hbtn wide light" onClick={onDone}>Mark done</button>
        ) : hold.endAt === null ? (
          <button className="hbtn" onClick={onResume} aria-label="Resume hold"><Icon name="play" size={16} /></button>
        ) : (
          <button className="hbtn" onClick={onPause} aria-label="Pause hold"><Icon name="pause" size={18} stroke={3} /></button>
        )}
        <button className="hbtn ghost" onClick={onClose} aria-label="Stop timer"><Icon name="close" size={16} /></button>
      </div>
    </section>
  );
}

function Routine({ r, date }: { r: MobilityRoutine; date: string }) {
  const stored = useLiveQuery(() => db.mobilityLogs.get(`${date}-${r.id}`), [date, r.id]);
  const [checked, setChecked] = useState(() => loadChecked(date, r.id, r.items.length));
  const [open, setOpen] = useState<number | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [about, setAbout] = useState(false);
  const now = useNow(!!hold && hold.endAt !== null);
  const done = Math.max(checked.filter(Boolean).length, stored?.completedItems ?? 0);
  const setItem = async (i: number, v: boolean) => {
    const next = checked.map((c, j) => (j === i ? v : c));
    setChecked(next);
    try { localStorage.setItem(key(date, r.id), JSON.stringify(next)); } catch { /* ignore */ }
    await db.mobilityLogs.put({ id: `${date}-${r.id}`, date, routineId: r.id, completedItems: next.filter(Boolean).length, total: r.items.length });
  };
  const start = (i: number, side: Hold["side"]) => {
    const total = holdSec(r, i);
    setHold({ item: i, side, total, endAt: Date.now() + total * 1000, left: total });
  };
  const remaining = hold ? (hold.endAt !== null ? Math.max(0, Math.ceil((hold.endAt - now) / 1000)) : hold.left) : 0;

  return (
    <>
      <div className="rt-head">
        <div>
          <h2>{r.label}</h2>
          <span>{r.subtitle} · {r.time}{r.optional ? " · optional" : ""}</span>
        </div>
        <span className={`rt-count ${done >= r.items.length ? "ok" : ""}`}>{done} / {r.items.length}</span>
      </div>
      <button className="textbtn rt-about" onClick={() => setAbout(!about)} aria-expanded={about}>
        About this routine<Icon name={about ? "chevronDown" : "chevronRight"} size={14} />
      </button>
      {about && <div className="rt-desc">{r.description}</div>}

      {hold && (
        <HoldCard r={r} hold={hold} now={now}
          onPause={() => setHold({ ...hold, endAt: null, left: remaining })}
          onResume={() => setHold({ ...hold, endAt: Date.now() + hold.left * 1000 })}
          onNextSide={() => start(hold.item, "R")}
          onClose={() => setHold(null)}
          onDone={() => { void setItem(hold.item, true); setHold(null); }} />
      )}

      <div className="lgroup mobgroup" data-testid={`routine-${r.id}`}>
        {r.items.map((it, i) => {
          const isDone = checked[i] ?? false;
          const timed = holdSec(r, i) > 0;
          const active = hold?.item === i;
          const sub = active
            ? hold.side === "L" ? `Left ${mmss(remaining)} · Right next` : hold.side === "R" ? `Right ${mmss(remaining)}` : mmss(remaining)
            : it.prescription.display;
          return (
            <div key={it.name} className={`mobrow ${isDone ? "done" : ""} ${active ? "active" : ""}`}>
              <div className="mob-main">
                <input type="checkbox" className="cb" checked={isDone} aria-label={`${it.name} done`} onChange={(e) => void setItem(i, e.target.checked)} />
                <button className="mob-txt" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <b>{it.name}</b><small>{sub}</small>
                </button>
                {timed && !active && !isDone && (
                  <button className="playbtn" onClick={() => start(i, it.prescription.perSide ? "L" : null)} aria-label={`Start ${it.name} timer`}>
                    <Icon name="play" size={14} />
                  </button>
                )}
              </div>
              {open === i && <div className="mob-cue">{it.cue}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Mobility() {
  const settings = useSettings();
  const date = today();
  const routines = program.mobility.filter((r) => r.id !== "foam" || settings.ownsFoamRoller);
  const [sel, setSel] = useState<string>(() => (new Date().getHours() < 14 ? "morning" : "evening"));
  const logs = useLiveQuery(() => db.mobilityLogs.where("date").equals(date).toArray(), [date], []);
  const doneIds = new Set(logs.filter((l) => l.completedItems >= l.total).map((l) => l.routineId));
  const current = routines.find((r) => r.id === sel) ?? routines[0]!;
  const short = (r: MobilityRoutine) => r.label.split(" ")[0];

  return (
    <div className="tpad">
      <ScreenHeader title="Mobility" />
      <div className="segc" role="radiogroup" aria-label="Routine" style={{ gridTemplateColumns: `repeat(${routines.length}, 1fr)` }}>
        {routines.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={current.id === r.id} className={current.id === r.id ? "on" : ""} onClick={() => setSel(r.id)}>
            {r.id === "foam" ? "Foam" : short(r)}
            {doneIds.has(r.id) && <span className="segtick"><Icon name="check" size={14} stroke={3} label="done" /></span>}
          </button>
        ))}
      </div>
      <Routine key={current.id} r={current} date={date} />
      {!settings.ownsFoamRoller && <div className="fnote">Foam-roller routine hidden. Turn it on in Settings if you own one.</div>}
    </div>
  );
}
