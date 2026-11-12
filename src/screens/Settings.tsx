import { useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getPhase, program } from "../program/program";
import type { PhaseId } from "../program/types";
import { useSettings } from "../db/hooks";
import { saveSettings } from "../db/repo";
import { downloadText, exportAll, importAll, parseBackup, resetAll, setLogsCsv } from "../db/backup";
import { today } from "../rules/dates";
import { Chips, Stepper } from "../components/controls";
import { Sheet } from "../components/Sheet";
import { GroupLabel, Icon, ScreenHeader, Switch, type IconName } from "../components/ui";
import { phaseTheme } from "../theme";

const STANDARD_PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
type Editor = "barbell" | "plates" | "dumbbells" | null;

/** A tappable list row with a trailing value and chevron. */
function ValueRow({ title, value, onClick }: { title: string; value: ReactNode; onClick: () => void }) {
  return (
    <button className="lrow setrow2" onClick={onClick}>
      <span className="txt"><b>{title}</b></span>
      <span className="trail">{value}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  );
}

function ActionRow({ icon, title, sub, danger, onClick }: { icon: IconName; title: string; sub?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`lrow actrow ${danger ? "danger" : ""}`} onClick={onClick}>
      <Icon name={icon} size={20} />
      <span className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
    </button>
  );
}

export function Settings({ phaseId, onPhase }: { phaseId: PhaseId; onPhase: (p: PhaseId) => void }) {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [sources, setSources] = useState(false);
  const persisted = useLiveQuery(async () => (navigator.storage?.persisted ? navigator.storage.persisted() : null), []);
  const phase = getPhase(phaseId);

  const sizes = [...new Set([...STANDARD_PLATES[s.units], ...s.plates])].sort((a, b) => b - a);
  const pairs = (size: number) => s.plates.filter((p) => p === size).length;
  const setPairs = (size: number, n: number) => {
    const rest = s.plates.filter((p) => p !== size);
    void saveSettings({ plates: [...rest, ...Array(n).fill(size)].sort((a, b) => b - a) });
  };
  const owned = [...new Set(s.plates)].sort((a, b) => b - a);
  const platesText = owned.length ? owned.map((p) => (pairs(p) > 1 ? `${p}×${pairs(p)}` : String(p))).join(" · ") : "None";

  const setUnits = (u: "kg" | "lb") => {
    if (u === s.units) return;
    if (!window.confirm(`Switch to ${u}? Logged weights are not converted, and plate/dumbbell settings reset to ${u} defaults.`)) return;
    void saveSettings(u === "kg"
      ? { units: "kg", barbellWeight: 20, plates: STANDARD_PLATES.kg, dumbbell: { min: 2.5, max: 32.5, step: 2.5 } }
      : { units: "lb", barbellWeight: 45, plates: STANDARD_PLATES.lb, dumbbell: { min: 5, max: 75, step: 5 } });
  };
  const doExport = async () => {
    downloadText(`workout-backup-${today()}.json`, JSON.stringify(await exportAll(), null, 1), "application/json");
    setMsg("Backup downloaded.");
  };
  const doCsv = async () => {
    downloadText(`workout-sets-${today()}.csv`, await setLogsCsv(), "text/csv");
    setMsg("CSV downloaded.");
  };
  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!window.confirm(`Replace ALL data on this device with the backup from ${backup.exportedAt.slice(0, 10)}?`)) return;
      await importAll(backup);
      setMsg("Backup restored.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    }
  };
  const doReset = async () => {
    if (!window.confirm("Delete ALL workouts, logs and settings on this device? This can't be undone. Export a backup first.")) return;
    if (!window.confirm("Really delete everything?")) return;
    await resetAll();
    try { Object.keys(localStorage).filter((k) => k.startsWith("wt.")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    location.reload();
  };

  return (
    <div className="tpad">
      <ScreenHeader title="Settings" />

      <GroupLabel>Equipment</GroupLabel>
      <div className="lgroup">
        <div className="lrow static">
          <span className="txt"><b>Units</b></span>
          <div className="segc mini" role="radiogroup" aria-label="Weight units" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {(["kg", "lb"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={s.units === u} className={s.units === u ? "on" : ""} onClick={() => setUnits(u)}>{u}</button>
            ))}
          </div>
        </div>
        <ValueRow title="Barbell" value={`${s.barbellWeight} ${s.units}`} onClick={() => setEditor("barbell")} />
        <ValueRow title="Plates (pairs)" value={platesText} onClick={() => setEditor("plates")} />
        <ValueRow title="Dumbbells" value={`${s.dumbbell.min}–${s.dumbbell.max} ${s.units}, step ${s.dumbbell.step}`} onClick={() => setEditor("dumbbells")} />
        <div className="lrow static">
          <span className="txt"><b>I own a foam roller</b><small>Shows the foam routine in Mobility</small></span>
          <Switch label="I own a foam roller" checked={s.ownsFoamRoller} onChange={(v) => void saveSettings({ ownsFoamRoller: v })} />
        </div>
      </div>

      <GroupLabel>Training</GroupLabel>
      <div className="lgroup">
        <div className="phaserow">
          <div className="lrow static">
            <span className="txt"><b>Current phase</b></span>
            <span className="trail phasetrail"><span className="dot" style={{ background: phaseTheme(phaseId).color }} />{phase.name} · {phase.label}</span>
          </div>
          <div className="segc seg" role="radiogroup" aria-label="Current phase" style={{ gridTemplateColumns: `repeat(${program.phases.length}, 1fr)` }}>
            {program.phases.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={phaseId === p.id} className={phaseId === p.id ? "on" : ""}
                onClick={() => { if (p.id !== phaseId && window.confirm(`Set the current phase to ${p.name}: ${p.label}? This is recorded in your phase history.`)) onPhase(p.id); }}>
                {p.name.replace("Phase ", "P")}
              </button>
            ))}
          </div>
          <div className="phasehint">Manual override, for corrections. Advance or drop back from Rehab.</div>
        </div>
        <div className="lrow static">
          <span className="txt"><b>Rest timer sound</b></span>
          <Switch label="Rest timer sound" checked={s.restTimerSound} onChange={(v) => void saveSettings({ restTimerSound: v })} />
        </div>
      </div>

      <GroupLabel>Your data</GroupLabel>
      <div className="lgroup">
        <ActionRow icon="download" title="Export backup (JSON)" sub="Everything, stored only on this device" onClick={() => void doExport()} />
        <ActionRow icon="upload" title="Import backup" sub="Replaces all data on this device" onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
        <ActionRow icon="file" title="Export set logs (CSV)" onClick={() => void doCsv()} />
        <ActionRow icon="trash" title="Reset all data" danger onClick={() => void doReset()} />
      </div>
      {msg && <div className="okcard" role="status">{msg}</div>}
      {persisted !== null && persisted !== undefined && (
        <div className="fnote">
          {persisted ? "Storage is persistent: the browser won't clear it automatically." : "Storage isn't marked persistent yet. Add the app to your Home Screen and export backups regularly."}
        </div>
      )}

      <div className="setfoot">
        <button className="textbtn" onClick={() => setSources(!sources)} aria-expanded={sources}>Sources and research<Icon name={sources ? "chevronDown" : "chevronRight"} size={14} /></button>
        {sources && (
          <div className="lgroup">
            {program.sources.map((src) => (
              <a key={src.url} className="lrow srcrow" href={src.url} target="_blank" rel="noreferrer"><span className="txt"><b>{src.title}</b></span></a>
            ))}
            <div className="lrow static"><span className="txt"><b>Equipment the plan assumes</b><small>{program.equipment.available.join(", ")}</small></span></div>
          </div>
        )}
        <p className="disclaimer">{program.meta.disclaimer}</p>
      </div>

      {editor === "barbell" && (
        <Sheet title="Barbell" onClose={() => setEditor(null)}>
          <div className="editor">
            <Stepper label="Barbell weight" value={s.barbellWeight} step={s.units === "kg" ? 2.5 : 5} min={0} max={60} unit={s.units} onChange={(v) => void saveSettings({ barbellWeight: v })} />
          </div>
          <button className="btn2 secondary block" onClick={() => setEditor(null)}>Done</button>
        </Sheet>
      )}
      {editor === "plates" && (
        <Sheet title="Plate pairs you own" onClose={() => setEditor(null)}>
          <div className="editor grid2">
            {sizes.map((size) => (
              <Stepper key={size} label={`${size} ${s.units}`} value={pairs(size)} step={1} min={0} max={8} unit="pairs" onChange={(n) => setPairs(size, n)} />
            ))}
          </div>
          <button className="btn2 secondary block" onClick={() => setEditor(null)}>Done</button>
        </Sheet>
      )}
      {editor === "dumbbells" && (
        <Sheet title="Adjustable dumbbells (per hand)" onClose={() => setEditor(null)}>
          <div className="editor">
            <div className="grid2">
              <Stepper label="Lightest" value={s.dumbbell.min} step={s.dumbbell.step} min={0} max={s.dumbbell.max} unit={s.units} onChange={(v) => void saveSettings({ dumbbell: { ...s.dumbbell, min: v } })} />
              <Stepper label="Heaviest" value={s.dumbbell.max} step={s.dumbbell.step} min={s.dumbbell.min} max={200} unit={s.units} onChange={(v) => void saveSettings({ dumbbell: { ...s.dumbbell, max: v } })} />
            </div>
            <Chips label="Increment" options={(s.units === "kg" ? [1, 1.25, 2, 2.5, 5] : [2.5, 5, 10]) as readonly number[]} value={s.dumbbell.step}
              onChange={(v) => void saveSettings({ dumbbell: { ...s.dumbbell, step: v } })} />
          </div>
          <button className="btn2 secondary block" onClick={() => setEditor(null)}>Done</button>
        </Sheet>
      )}
    </div>
  );
}
