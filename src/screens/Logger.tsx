import { useEffect, useMemo, useState } from "react";
import type { SetLog, Settings, Workout } from "../db/types";
import { newId } from "../db/db";
import { deleteSetLogs, discardWorkout, historyFor, logsForWorkout, putSetLogs, recentWorkoutsWithLogs } from "../db/repo";
import { db } from "../db/db";
import { hamstringHold, p4StopNeeded, P4_STOP_TEXT } from "../rules/pain";
import { suggest, type Suggestion } from "../rules/progression";
import { today } from "../rules/dates";
import { getPhase, getSession } from "../program/program";
import type { Exercise, Phase, Session } from "../program/types";
import { restSeconds } from "../rules/rest";
import {
  hasControl, logKind, minWeight, plannedSetCount, rowDefaults, usesAddedWeight, weightStep,
} from "../rules/prefill";
import { Chips, PainSlider, Stepper } from "../components/controls";
import { RestTimerBar, unlockAudio, useRestTimer } from "../components/RestTimer";
import { groupExercises, prescriptionLine } from "./SessionView";
import { FinishFlow } from "./FinishFlow";
import { PreSessionCheck } from "../components/RehabInputs";
import { Sheet } from "../components/Sheet";
import { ExpandRow, Icon, Tag, type IconName } from "../components/ui";

export interface Row {
  key: string; setIndex: number; isWarmup: boolean;
  weight: number; reps: number; repsR: number; pain: number; control: 1 | 2 | 3 | null;
  note: string; done: boolean; logIds: string[];
}
interface Draft { rows: Row[][]; primerDone: boolean }
type History = Awaited<ReturnType<typeof historyFor>>;

const draftKey = (id: string) => `wt.draft.${id}`;
function loadDraft(id: string): Draft | null {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "null") as Draft | null;
  } catch {
    return null;
  }
}
function saveDraft(id: string, d: Draft) {
  try { localStorage.setItem(draftKey(id), JSON.stringify(d)); } catch { /* ignore */ }
}
export function clearDraft(id: string) {
  try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ }
}

const CONTROL_OPTIONS = [1, 2, 3] as const;
const CONTROL_TEXT: Record<number, string> = { 1: "1 early", 2: "2 halfway", 3: "3 floor" };

function lastPainOf(logs: SetLog[]): number | null {
  const p = logs.filter((l) => l.painDuring !== undefined);
  return p.length ? p[p.length - 1]!.painDuring! : null;
}

function buildRows(e: Exercise, i: number, existing: SetLog[], last: SetLog[], s: Settings, sug: Suggestion | null): Row[] {
  const mine = existing.filter((l) => l.exerciseIndex === i);
  const rows: Row[] = [];
  const lastPain = lastPainOf(last);
  const fromLogs = (ls: SetLog[], warm: boolean, setIndex: number): Row => {
    const L = ls.find((l) => l.side !== "R") ?? ls[0]!;
    const R = ls.find((l) => l.side === "R");
    return {
      key: `${warm ? "w" : "s"}${setIndex}`, setIndex, isWarmup: warm,
      weight: (usesAddedWeight(e) ? L.addedWeight : L.weight) ?? 0, reps: L.reps ?? 0, repsR: R?.reps ?? L.reps ?? 0,
      pain: L.painDuring ?? 0, control: L.control ?? null, note: L.note ?? "", done: true, logIds: ls.map((l) => l.id),
    };
  };
  const warmIdx = [...new Set(mine.filter((l) => l.isWarmup).map((l) => l.setIndex))].sort((a, b) => a - b);
  for (const si of warmIdx) rows.push(fromLogs(mine.filter((l) => l.isWarmup && l.setIndex === si), true, si));
  const work = mine.filter((l) => !l.isWarmup);
  const count = Math.max(plannedSetCount(e), ...work.map((l) => l.setIndex + 1));
  for (let si = 0; si < count; si++) {
    const ls = work.filter((l) => l.setIndex === si);
    if (ls.length) rows.push(fromLogs(ls, false, si));
    else {
      const d = rowDefaults(e, si, last, s, lastPain, sug);
      rows.push({ key: `s${si}`, setIndex: si, isWarmup: false, weight: d.weight, reps: d.reps, repsR: d.reps, pain: d.pain, control: d.control, note: "", done: false, logIds: [] });
    }
  }
  return rows;
}

function rowToLogs(e: Exercise, i: number, r: Row, workoutId: string): SetLog[] {
  const base: Omit<SetLog, "id"> = {
    workoutId, exerciseId: e.exerciseId, variant: e.variant, exerciseIndex: i, setIndex: r.setIndex,
    isWarmup: r.isWarmup, completedAt: new Date().toISOString(), reps: r.reps,
  };
  if (logKind(e) === "load") {
    if (usesAddedWeight(e)) base.addedWeight = r.weight;
    else base.weight = r.weight;
  }
  if (e.hamstringLoad) base.painDuring = r.pain;
  if (hasControl(e) && r.control) base.control = r.control;
  if (r.note.trim()) base.note = r.note.trim();
  if (e.prescription.perSide) {
    return [
      { ...base, id: r.logIds[0] ?? newId(), side: "L", reps: r.reps },
      { ...base, id: r.logIds[1] ?? newId(), side: "R", reps: r.repsR },
    ];
  }
  return [{ ...base, id: r.logIds[0] ?? newId() }];
}

const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
type Col = "w" | "reps" | "pain" | "ctrl" | "note";
const COL_W: Record<Col, string> = { w: "60px", reps: "48px", pain: "42px", ctrl: "42px", note: "minmax(0,1fr)" };

/** Which columns the set table shows for this exercise (design/HANDOFF.md §5.1). */
function columnsFor(e: Exercise, rows: Row[]): Col[] {
  if (logKind(e) === "quality") return ["reps", ...(e.hamstringLoad ? (["pain"] as Col[]) : []), "note"];
  const cols: Col[] = [];
  if (!usesAddedWeight(e) || rows.some((r) => r.weight > 0)) cols.push("w");
  cols.push("reps");
  if (e.hamstringLoad) cols.push("pain");
  if (hasControl(e)) cols.push("ctrl");
  return cols;
}

/** "70 × 8", "BW × 6" or "BW+5 × 6" from the matching set last session. */
function previousText(e: Exercise, last: SetLog[], r: Row, side?: "L" | "R"): string {
  const l = last.find((x) => x.isWarmup === r.isWarmup && x.setIndex === r.setIndex && (!side || (x.side ?? "L") === side));
  if (!l) return "–";
  const reps = l.reps ?? "–";
  if (logKind(e) === "quality") return String(reps);
  if (usesAddedWeight(e)) return l.addedWeight ? `BW+${fmtN(l.addedWeight)} × ${reps}` : `BW × ${reps}`;
  return l.weight !== undefined ? `${fmtN(l.weight)} × ${reps}` : `× ${reps}`;
}

function rowName(r: Row): string {
  return r.isWarmup ? `Warm-up ${r.setIndex + 1}` : r.note === "max-test" ? `Set ${r.setIndex + 1} · max-reps test` : `Set ${r.setIndex + 1}`;
}

/** The existing stepper / chip controls for one set, shown in a sheet when a value is tapped. */
function RowEditor({ e, r, phase, settings, onChange, onTick, onClose }: {
  e: Exercise; r: Row; phase: Phase; settings: Settings;
  onChange: (patch: Partial<Row>) => void; onTick: () => void; onClose: () => void;
}) {
  const quality = logKind(e) === "quality";
  return (
    <Sheet title={rowName(r)} onClose={onClose}>
      <div className="editor">
        {!quality && (
          <Stepper label={usesAddedWeight(e) ? "Added weight" : "Weight"} unit={settings.units} value={r.weight} step={weightStep(e, settings)}
            min={usesAddedWeight(e) ? 0 : minWeight(e, settings)} max={e.equipment === "dumbbell" ? settings.dumbbell.max : 9999}
            onChange={(v) => onChange({ weight: v })} />
        )}
        {e.prescription.perSide ? (
          <div className="grid2">
            <Stepper label="Reps L" value={r.reps} step={1} onChange={(v) => onChange({ reps: v })} />
            <Stepper label="Reps R" value={r.repsR} step={1} onChange={(v) => onChange({ repsR: v })} />
          </div>
        ) : (
          <Stepper label={quality ? "Reps done" : "Reps"} value={r.reps} step={1} onChange={(v) => onChange({ reps: v })} />
        )}
        {hasControl(e) && (
          <Chips label="Control (1 dropped early · 3 near floor)" options={CONTROL_OPTIONS} value={r.control} onChange={(v) => onChange({ control: v })} render={(v) => CONTROL_TEXT[v]} />
        )}
        {e.hamstringLoad && <PainSlider value={r.pain} max={phase.painRule.maxDuringPain} onChange={(v) => onChange({ pain: v })} />}
        {quality && (
          <input className="textin" placeholder="Quality note (optional)" aria-label="Quality note" value={r.note} onChange={(ev) => onChange({ note: ev.target.value })} />
        )}
      </div>
      <div className="editor-actions">
        {!r.done && <button className="btn2 done block" onClick={() => { onTick(); onClose(); }}>Complete set</button>}
        <button className="btn2 secondary block" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

function SetTable({ e, rows, phase, settings, last, onChange, onTick }: {
  e: Exercise; rows: Row[]; phase: Phase; settings: Settings; last: SetLog[];
  onChange: (k: number, patch: Partial<Row>) => void; onTick: (k: number) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const cols = columnsFor(e, rows);
  const showPrev = logKind(e) !== "quality";
  const grid = { gridTemplateColumns: ["30px", showPrev ? "minmax(0,1fr)" : null, ...cols.map((c) => COL_W[c]), "40px"].filter(Boolean).join(" ") };
  const head: Record<Col, string> = { w: usesAddedWeight(e) ? `+${settings.units.toUpperCase()}` : settings.units.toUpperCase(), reps: "Reps", pain: "Pain", ctrl: "Ctrl", note: "Note" };
  const max = phase.painRule.maxDuringPain;

  const cell = (r: Row, k: number, c: Col, side?: "L" | "R") => {
    let v: string;
    let cls = "";
    if (side === "R" && c !== "reps") return <span key={c} />;
    switch (c) {
      case "w": v = fmtN(r.weight); break;
      case "reps": v = String(side === "R" ? r.repsR : r.reps); break;
      case "pain": v = String(r.pain); if (r.pain > max) cls = "over"; break;
      case "ctrl": v = r.control ? String(r.control) : "–"; break;
      case "note": v = r.note || (r.done ? "" : "Add"); cls = "note"; break;
    }
    const label = `${rowName(r)}${side ? ` ${side}` : ""} ${head[c]}: ${v || "none"}. Tap to edit`;
    return (
      <button key={c} type="button" className={`cellbtn ${cls}`} aria-label={label} onClick={() => setEditing(k)}>
        <span className="val">{v}</span>
      </button>
    );
  };

  const line = (r: Row, k: number, side?: "L" | "R") => (
    <div className="setline" style={grid} key={side ?? "x"}>
      <span className={`setno ${r.isWarmup ? "warm" : ""}`}>{r.isWarmup ? "W" : `${r.setIndex + 1}${side ?? ""}`}</span>
      {showPrev && <span className="prev">{r.note === "max-test" && side !== "R" ? "Max test" : previousText(e, last, r, side)}</span>}
      {cols.map((c) => cell(r, k, c, side))}
      {side === "R" ? <span /> : (
        <button type="button" className={`tick ${r.done ? "on" : ""}`} aria-pressed={r.done} aria-label={r.done ? `Undo ${rowName(r)}` : `Complete ${rowName(r)}`} onClick={() => onTick(k)}>
          <span className="box"><Icon name="check" size={16} stroke={3} /></span>
        </button>
      )}
    </div>
  );

  const editRow = editing !== null ? rows[editing] : undefined;
  return (
    <>
      <div className="sethdr" style={grid} aria-hidden>
        <span>Set</span>{showPrev && <span>Previous</span>}
        {cols.map((c) => <span key={c} className="c">{head[c]}</span>)}<span />
      </div>
      <div className="setrows">
        {rows.map((r, k) => (
          <div key={r.key} className={`setrow ${r.done ? "done" : ""} ${r.isWarmup ? "warm" : ""}`} data-testid="setrow">
            {e.prescription.perSide ? [line(r, k, "L"), line(r, k, "R")] : line(r, k)}
          </div>
        ))}
      </div>
      {editRow && editing !== null && (
        <RowEditor e={e} r={editRow} phase={phase} settings={settings}
          onChange={(patch) => onChange(editing, patch)} onTick={() => onTick(editing)} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

const TONE_ICON: Record<Suggestion["tone"], IconName> = { up: "arrowUp", keep: "minus", down: "arrowDown", info: "info", hold: "pause" };

function ExerciseLogger({ e, rows, phase, settings, last, suggestion, p4Stop, onRows, onTick }: {
  e: Exercise; rows: Row[]; phase: Phase; settings: Settings; last: SetLog[]; suggestion: Suggestion | null; p4Stop: boolean;
  onRows: (rows: Row[]) => void; onTick: (rowIdx: number) => void;
}) {
  const [cues, setCues] = useState(false);
  const workCount = rows.filter((r) => !r.isWarmup).length;
  const addRow = (warm: boolean, note = "") => {
    const src = [...rows].reverse().find((r) => !r.isWarmup) ?? rows[rows.length - 1];
    const same = rows.filter((r) => r.isWarmup === warm);
    const setIndex = same.length ? Math.max(...same.map((r) => r.setIndex)) + 1 : 0;
    const base: Row = src
      ? { ...src, done: false, logIds: [], note: "" }
      : { key: "", setIndex: 0, isWarmup: warm, weight: minWeight(e, settings), reps: e.prescription.repsMin ?? 5, repsR: e.prescription.repsMin ?? 5, pain: 0, control: null, note: "", done: false, logIds: [] };
    const row: Row = { ...base, key: `${warm ? "w" : "s"}${setIndex}`, setIndex, isWarmup: warm, note, weight: warm ? minWeight(e, settings) : base.weight };
    const firstWork = rows.findIndex((r) => !r.isWarmup);
    if (warm) {
      const lastWarm = rows.map((r) => r.isWarmup).lastIndexOf(true);
      const at = lastWarm >= 0 ? lastWarm + 1 : firstWork >= 0 ? firstWork : rows.length;
      onRows([...rows.slice(0, at), row, ...rows.slice(at)]);
    } else onRows([...rows, row]);
  };
  const removeLast = () => {
    const idx = rows.map((r) => !r.isWarmup && !r.done).lastIndexOf(true);
    if (idx >= 0 && workCount > 1) onRows(rows.filter((_, k) => k !== idx));
  };
  const footnote = [
    e.hamstringLoad ? `Pain 0–10 (rule: ${phase.painRule.maxDuringPain}/10 max)` : null,
    hasControl(e) ? "Control: 1 dropped early, 2 halfway, 3 near the floor" : null,
  ].filter(Boolean).join(" · ");
  return (
    <section className="excard" data-testid={`log-${e.label}`}>
      <div className="exhead">
        <div className="extitle">
          <h2>{e.label} · {e.name}</h2>
          <span className="exsub">{prescriptionLine(e)}</span>
        </div>
        {e.isMainLift ? <Tag kind="main">Main lift</Tag> : e.hamstringLoad ? <Tag kind="rehab">Rehab</Tag> : null}
      </div>
      <button className="textbtn cues" onClick={() => setCues(!cues)} aria-expanded={cues}>
        {cues ? "Hide cues" : "Cues"}<Icon name="chevronDown" size={14} />
      </button>
      {cues && <div className="cue">{e.cue}</div>}
      {suggestion && (
        <div className={`suggest ${suggestion.tone}`} data-testid="suggestion">
          <span className="ic"><Icon name={TONE_ICON[suggestion.tone]} size={18} /></span>
          <div>
            <strong>{/^\d/.test(suggestion.text) ? `Suggested ${suggestion.text}` : suggestion.text}.</strong> {suggestion.reason}
            {suggestion.notes.map((n, k) => <div key={k} className="sn">{n}</div>)}
          </div>
        </div>
      )}
      {p4Stop && <div className="alertcard"><strong>{P4_STOP_TEXT}</strong>Hamstring pain during jumps in Phase 4.</div>}
      <SetTable e={e} rows={rows} phase={phase} settings={settings} last={last}
        onChange={(k, patch) => onRows(rows.map((x, j) => (j === k ? { ...x, ...patch } : x)))} onTick={onTick} />
      {footnote && <div className="exfoot">{footnote}</div>}
      <button className="btn2 secondary block addset" onClick={() => addRow(false)}>+ Add set</button>
      <div className="exmore">
        {logKind(e) === "load" && <button className="textbtn" onClick={() => addRow(true)}>+ Warm-up set</button>}
        {e.progression === "pullup-stage" && <button className="textbtn" onClick={() => addRow(false, "max-test")}>+ Max test</button>}
        {rows.some((r) => !r.isWarmup && !r.done) && workCount > 1 && <button className="textbtn" onClick={removeLast}>Remove last set</button>}
      </div>
    </section>
  );
}

function useElapsed(startedAt: string): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function Logger({ workout, settings, onExit }: { workout: Workout; settings: Settings; onExit: () => void }) {
  const session: Session = getSession(workout.sessionId);
  const phase = getPhase(workout.phaseId);
  const timer = useRestTimer(settings.restTimerSound);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [suggestions, setSuggestions] = useState<(Suggestion | null)[]>([]);
  const [mode, setMode] = useState<"log" | "finish">("log");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [existing, hist, recent, checks] = await Promise.all([
        logsForWorkout(workout.id),
        Promise.all(session.exercises.map((e) => historyFor(e.exerciseId, e.variant, workout.id))),
        recentWorkoutsWithLogs(20),
        db.painChecks.toArray(),
      ]);
      if (!alive) return;
      const hold = hamstringHold(phase, recent.filter((r) => r.workout.id !== workout.id), checks);
      const sugs = session.exercises.map((e, i) => suggest(e, hist[i] ?? [], { settings, phase, hold, today: today() }));
      setHistory(hist);
      setSuggestions(sugs);
      const stored = loadDraft(workout.id);
      const rows = session.exercises.map((e, i) => buildRows(e, i, existing, hist[i]?.[0]?.logs ?? [], settings, sugs[i] ?? null));
      // Keep unticked edits from the stored draft; logged sets always come from the database.
      if (stored && stored.rows.length === rows.length) {
        stored.rows.forEach((sr, i) => {
          const dbRows = rows[i]!;
          const merged = sr.map((r) => {
            const fromDb = dbRows.find((x) => x.key === r.key && x.done);
            return fromDb ?? { ...r, done: false, logIds: [] };
          });
          for (const d of dbRows) if (d.done && !merged.some((m) => m.key === d.key)) merged.push(d);
          rows[i] = merged;
        });
      }
      setDraft({ rows, primerDone: stored?.primerDone ?? false });
    })();
    return () => { alive = false; };
  }, [workout.id, session, settings, phase]);

  useEffect(() => {
    if (draft) saveDraft(workout.id, draft);
  }, [draft, workout.id]);

  const lastLogs = useMemo(() => history.map((h) => h[0]?.logs ?? []), [history]);
  const prevAll = useMemo(() => history.map((h) => h.flatMap((x) => x.logs)), [history]);

  if (!draft) return <div className="tpad"><div className="card loading">Loading workout…</div></div>;

  const setRows = (i: number, rows: Row[]) => {
    // Edits to a logged set are saved straight away.
    const e = session.exercises[i]!;
    const prev = draft.rows[i]!;
    rows.forEach((r) => {
      const before = prev.find((p) => p.key === r.key);
      if (r.done && before && before !== r) void putSetLogs(rowToLogs(e, i, r, workout.id));
    });
    updateRows(i, () => rows);
  };

  const updateRows = (i: number, fn: (rows: Row[]) => Row[]) =>
    setDraft((d) => (d ? { ...d, rows: d.rows.map((x, j) => (j === i ? fn(x) : x)) } : d));

  const tick = async (i: number, k: number) => {
    unlockAudio();
    const e = session.exercises[i]!;
    const r = draft.rows[i]![k]!;
    if (r.done) {
      updateRows(i, (rows) => rows.map((x) => (x.key === r.key ? { ...x, done: false, logIds: [] } : x)));
      await deleteSetLogs(r.logIds);
      return;
    }
    const logs = rowToLogs(e, i, r, workout.id);
    updateRows(i, (rows) => {
      const at = rows.findIndex((x) => x.key === r.key);
      return rows.map((x, j) => {
        if (j === at) return { ...x, done: true, logIds: logs.map((l) => l.id) };
        // Carry weight and pain forward to the following unticked working sets.
        if (!r.isWarmup && j > at && !x.done && !x.isWarmup) return { ...x, weight: r.weight, pain: r.pain };
        return x;
      });
    });
    if (!r.isWarmup) {
      const sec = restSeconds(session, i);
      if (sec) timer.start(sec);
    }
    await putSetLogs(logs);
  };

  const discard = async () => {
    if (!window.confirm("Discard this workout and every set logged in it?")) return;
    await discardWorkout(workout.id);
    clearDraft(workout.id);
    timer.stop();
    onExit();
  };

  if (mode === "finish") {
    return (
      <FinishFlow workout={workout} session={session} phase={phase} prevLogs={prevAll}
        onBack={() => setMode("log")}
        onDone={() => { clearDraft(workout.id); timer.stop(); onExit(); }} />
    );
  }

  const workRows = draft.rows.flat().filter((r) => !r.isWarmup);
  const doneSets = workRows.filter((r) => r.done).length;
  const warmPrimer = phase.primer.schedule === "warm-up";
  const [titleMain, titleSub] = splitTitle(session.title);
  const dayShort = session.day.split("·").pop()?.trim() ?? session.day;

  return (
    <div className="logger">
      <LoggerTop startedAt={workout.startedAt} done={doneSets} total={workRows.length} onMinimize={onExit} onFinish={() => setMode("finish")} />
      <div className="lbody">
        <header className="hero ltitle">
          <h1>{titleMain}</h1>
          <p>{[titleSub, phase.name, dayShort].filter(Boolean).join(" · ")}</p>
        </header>

        <div className="lgroup">
          {session.whatChanged.length > 0 && (
            <ExpandRow icon="changes" title="What changed" sub={`${session.whatChanged.length} change${session.whatChanged.length === 1 ? "" : "s"} from the old plan`}>
              <ul>{session.whatChanged.map((w, k) => <li key={k}>{w}</li>)}</ul>
            </ExpandRow>
          )}
          {session.science.length > 0 && (
            <ExpandRow icon="flask" title="Science behind this session" sub={`${session.science.length} notes`}>
              {session.science.map((s, k) => (
                <div className="sci-it" key={k}>
                  <span className={`lvl ${s.level === "study" ? "study" : "call"}`}>{s.level === "study" ? "Study" : "Coaching call"}</span>
                  <span className="src">{s.source}</span><div>{s.text}</div>
                </div>
              ))}
            </ExpandRow>
          )}
          <ExpandRow icon="flame" title="Warm-up" sub="Wake-up routine, then ramp-up sets">
            Morning wake-up routine, then 1–2 light ramp-up sets of your first exercise (use “+ Warm-up set”).
          </ExpandRow>
          {warmPrimer && (
            <label className="lrow-check">
              <input type="checkbox" checked={draft.primerDone} onChange={(ev) => setDraft({ ...draft, primerDone: ev.target.checked })} />
              <span className="txt"><b>Primer holds done</b><small>{phase.primer.sets} × {phase.primer.holdSec} s at each knee angle</small></span>
            </label>
          )}
        </div>

        {session.exercises.some((e) => e.hamstringLoad) && doneSets === 0 && <PreSessionCheck />}

        {groupExercises(session.exercises).map((g) => {
          const render = (e: Exercise) => {
            const i = session.exercises.indexOf(e);
            return (
              <ExerciseLogger key={i} e={e} rows={draft.rows[i]!} phase={phase} settings={settings} last={lastLogs[i] ?? []}
                suggestion={suggestions[i] ?? null}
                p4Stop={p4StopNeeded(phase, session, draft.rows[i]!.filter((r) => r.done).map((r) => ({ exerciseIndex: i, painDuring: e.hamstringLoad ? r.pain : undefined } as SetLog)))}
                onRows={(rows) => setRows(i, rows)} onTick={(k) => void tick(i, k)} />
            );
          };
          return g.length === 2 ? (
            <div className="ssgroup" key={g[0]!.label}>
              <div className="sslabel">Superset {g[0]!.label} + {g[1]!.label} · rest after the pair</div>
              {render(g[0]!)}{render(g[1]!)}
            </div>
          ) : render(g[0]!);
        })}

        <button className="textbtn danger discard" onClick={() => void discard()}>Discard workout</button>
      </div>
      <RestTimerBar timer={timer} />
    </div>
  );
}

function splitTitle(title: string): [string, string | undefined] {
  const at = title.indexOf(": ");
  return at < 0 ? [title, undefined] : [title.slice(0, at), title.slice(at + 2)];
}

function LoggerTop({ startedAt, done, total, onMinimize, onFinish }: {
  startedAt: string; done: number; total: number; onMinimize: () => void; onFinish: () => void;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <div className="ltop">
      <div className="ltop-row">
        <button className="iconbtn" onClick={onMinimize} aria-label="Minimize workout"><Icon name="chevronDown" size={20} stroke={2.2} /></button>
        <div className="ltop-mid">
          <span className="clock" role="timer" aria-label={`Elapsed ${elapsed}`}>{elapsed}</span>
          <span className="count">{done} of {total} sets</span>
        </div>
        <button className="finishpill" onClick={onFinish} aria-label="Finish workout">Finish</button>
      </div>
      <div className="lprogress" role="progressbar" aria-label="Working sets done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
