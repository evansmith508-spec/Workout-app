import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { MealSize, Nausea, NauseaWhen, SetLog, Workout } from "../db/types";
import { finishWorkout, logsForWorkout } from "../db/repo";
import { program } from "../program/program";
import type { MuscleId, Phase, Session } from "../program/types";
import { cautionMuscles, countWorkingSets, newBests, painFlags, workoutVolume, type Best, type PainFlag } from "../rules/summary";
import type { MuscleTotals } from "../rules/volume";
import { RegressionBanner } from "./Today";
import { usePhaseState, useSettings } from "../db/hooks";
import { p4StopNeeded, P4_STOP_TEXT } from "../rules/pain";
import { today } from "../rules/dates";
import { ChoiceChips, Icon, InlineStepper, NumberRow, OptionTiles, Segmented } from "../components/ui";

const NAUSEA: readonly Nausea[] = ["none", "mild", "moderate", "vomited"];
const WHEN: readonly NauseaWhen[] = ["start", "middle", "end", "after"];
const MEAL: readonly MealSize[] = ["fasted", "snack", "meal", "large"];
const muscleLabel = (m: MuscleId) => program.muscles.find((x) => x.id === m)?.label ?? m;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Summary { sets: number; volume: MuscleTotals; pain: PainFlag[]; caution: MuscleId[]; bests: Best[]; p4Stop: boolean }

function summarize(session: Session, phase: Phase, logs: SetLog[], prevLogs: SetLog[][]): Summary {
  const bests = session.exercises.flatMap((e, i) => newBests(e, logs.filter((l) => l.exerciseIndex === i), prevLogs[i] ?? []));
  const volume = workoutVolume(session, logs);
  const sets = session.exercises.reduce((n, _e, i) => n + countWorkingSets(logs.filter((l) => l.exerciseIndex === i)), 0);
  return { sets, volume, pain: painFlags(session, logs, phase), caution: cautionMuscles(volume), bests, p4Stop: p4StopNeeded(phase, session, logs) };
}

function splitTitle(title: string): string {
  const at = title.indexOf(": ");
  return at < 0 ? title : title.slice(0, at);
}

/** Summary card: three stat tiles and the new-best banner (design/HANDOFF.md §5.3). */
function SummaryCard({ session, summary, logs, startedAt, unit }: { session: Session; summary: Summary; logs: SetLog[]; startedAt: string; unit: string }) {
  const planned = session.exercises.reduce((n, e) => n + (e.prescription.sets ?? 1), 0);
  const pains = logs.filter((l) => !l.isWarmup && l.painDuring !== undefined).map((l) => l.painDuring!);
  const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const day = session.day.split("·").pop()?.trim() ?? session.day;
  return (
    <section className="sumcard">
      <div className="sum-head">
        <h2>{splitTitle(session.title)}</h2>
        <span>{day} · {minutes} min</span>
      </div>
      <div className="stattiles">
        <div><b>{summary.sets}/{planned}</b><span>Sets</span></div>
        <div><b>{pains.length ? `${Math.max(...pains)}/10` : "–"}</b><span>Peak pain</span></div>
        <div><b>{summary.bests.length}</b><span>{summary.bests.length === 1 ? "New best" : "New bests"}</span></div>
      </div>
      {summary.bests.map((b, k) => (
        <div className="prbanner" key={k}>
          <Icon name="trophy" size={18} />
          <span><strong>{b.exercise}</strong> · {b.kind === "e1RM" ? `e1RM ${fmt(b.value)} ${unit} (estimate)` : `top set ${fmt(b.value)} ${unit}`}
            {b.previous ? `, up ${fmt(b.value - b.previous)} ${unit}` : ""}</span>
        </div>
      ))}
    </section>
  );
}

export function FinishFlow({ workout, session, phase, prevLogs, onBack, onDone }: {
  workout: Workout; session: Session; phase: Phase; prevLogs: SetLog[][]; onBack: () => void; onDone: () => void;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [nausea, setNausea] = useState<Nausea>("none");
  const [when, setWhen] = useState<NauseaWhen | null>(null);
  const [hours, setHours] = useState(2);
  const [meal, setMeal] = useState<MealSize | null>(null);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);
  const phaseState = usePhaseState();
  const settings = useSettings();
  // Live preview of the summary before saving: the same pure rules as after save.
  const logs = useLiveQuery(() => logsForWorkout(workout.id), [workout.id], [] as SetLog[]);
  const preview = summary ?? summarize(session, phase, logs, prevLogs);

  const save = async () => {
    setSaving(true);
    await finishWorkout(workout.id, {
      sessionRpe: rpe ?? undefined, nausea, nauseaWhen: nausea !== "none" ? when ?? undefined : undefined,
      hoursSinceMeal: meal && meal !== "fasted" ? hours : undefined, mealSize: meal ?? undefined, notes: notes.trim() || undefined,
    });
    setSummary(summarize(session, phase, await logsForWorkout(workout.id), prevLogs));
    setSaving(false);
  };

  if (summary) {
    const muscles = (Object.entries(summary.volume) as [MuscleId, number][]).sort((a, b) => b[1] - a[1]);
    return (
      <div className="finish">
        <div className="ftop"><span className="ftop-spacer" /><h1 className="ftitle">Workout saved</h1><span className="ftop-spacer" /></div>
        <div className="fbody" data-testid="summary">
          {summary.p4Stop && <div className="alertcard big"><strong><Icon name="alert" size={18} />{P4_STOP_TEXT}</strong>You logged hamstring pain during jumps.</div>}
          {phaseState && <RegressionBanner phase={phase} state={phaseState} date={today()} />}
          <SummaryCard session={session} summary={summary} logs={logs} startedAt={workout.startedAt} unit={settings.units} />
          {summary.pain.length > 0 && (
            <div className="alertcard big">
              <strong><Icon name="alert" size={18} />Pain rule flags</strong>
              <ul className="flaglist">{summary.pain.map((p, k) => <li key={k}>{p.exercise}, set {p.setIndex + 1}{p.side ? ` ${p.side}` : ""}: {p.pain}/10</li>)}</ul>
              <span>{phase.painRule.onViolation}</span>
            </div>
          )}
          <div className="lgroup">
            <div className="lrow static"><span className="txt"><b>Session effort (RPE)</b></span><span className="trail strong">{rpe ?? "–"}</span></div>
          </div>
          <h3 className="sechead">Fractional sets per muscle</h3>
          <div className="lgroup">
            {muscles.map(([m, v]) => (
              <div className="lrow static" key={m}><span className="txt"><b>{muscleLabel(m)}</b></span><span className="trail strong">{fmt(v)}</span></div>
            ))}
          </div>
          {summary.caution.length > 0 && (
            <div className="fnote">
              {summary.caution.map(muscleLabel).join(", ")} went over {program.volumeCounting.perSessionCautionFractionalSets} fractional sets in one session.
            </div>
          )}
        </div>
        <div className="fsticky"><button className="btn2 primary block" onClick={onDone}>Done</button></div>
      </div>
    );
  }

  return (
    <div className="finish">
      <div className="ftop">
        <button className="textbtn back" onClick={onBack}>Back</button>
        <h1 className="ftitle">Finish workout</h1>
        <span className="ftop-spacer" />
      </div>
      <div className="fbody">
        <SummaryCard session={session} summary={preview} logs={logs} startedAt={workout.startedAt} unit={settings.units} />

        <fieldset className="fset">
          <legend>Session effort (RPE)</legend>
          <NumberRow label="Session RPE 1 to 10" from={1} to={10} cols={10} value={rpe} onChange={setRpe} />
        </fieldset>

        <fieldset className="fset">
          <legend>Nausea</legend>
          <Segmented label="Nausea" options={NAUSEA} value={nausea} onChange={setNausea} render={cap} />
          {(nausea === "moderate" || nausea === "vomited") && (
            <div className="alertcard big"><strong><Icon name="alert" size={18} />Red flags</strong>{program.redFlags}</div>
          )}
          {nausea !== "none" && (
            <>
              <span className="fsub">When did it hit?</span>
              <ChoiceChips label="When did it hit?" options={WHEN} value={when} onChange={setWhen} render={cap} />
            </>
          )}
        </fieldset>

        <div className="lgroup">
          <div className="fmeal">
            <span className="flabel">Meal size before</span>
            <OptionTiles label="Meal size before" options={MEAL} value={meal} onChange={setMeal} render={cap} />
          </div>
          {meal && meal !== "fasted" && (
            <div className="lrow static">
              <span className="txt"><b>Hours since last meal</b></span>
              <InlineStepper label="Hours since last meal" value={hours} step={0.5} min={0} max={24} onChange={setHours} />
            </div>
          )}
        </div>

        <label className="fset">
          <span className="flegend">Notes</span>
          <textarea className="fnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" />
        </label>
      </div>
      <div className="fsticky">
        <button className="btn2 primary block" disabled={saving} onClick={() => void save()}>Save workout</button>
      </div>
    </div>
  );
}
