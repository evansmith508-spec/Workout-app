import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getPhase, program } from "../program/program";
import type { Exercise, PhaseId } from "../program/types";
import { db } from "../db/db";
import { recentWorkoutsWithLogs } from "../db/repo";
import { useSettings } from "../db/hooks";
import { weeklyPlanVolume } from "../rules/volume";
import { liftSeries, nauseaInsights, weeklyLoggedVolume } from "../rules/progress";
import { tracksE1rm } from "../rules/e1rm";
import { addDays, parseISODate, today, weekStart } from "../rules/dates";
import { AXIS, ChartCard, INK, shortDate, TOOLTIP } from "../components/charts";
import { Stepper } from "../components/controls";
import { ExpandRow, Icon, ScreenHeader, Segmented } from "../components/ui";
import { RehabCharts } from "./RehabCharts";

/** Distinct compound barbell/dumbbell lifts in the plan, keyed by exerciseId (variants share history only when equal). */
function compoundLifts(): Exercise[] {
  const seen = new Map<string, Exercise>();
  for (const s of Object.values(program.sessions))
    for (const e of s.exercises) if (tracksE1rm(e) && !seen.has(`${e.exerciseId}|${e.variant}`)) seen.set(`${e.exerciseId}|${e.variant}`, e);
  return [...seen.values()];
}

const pct = (r: number) => `${Math.round(r * 100)}%`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
type View = "Strength" | "Rehab" | "Nausea";
const VIEWS: readonly View[] = ["Strength", "Rehab", "Nausea"];

/** Dots: 3 px, the last point drawn as a ring (design/HANDOFF.md §5.6). */
function dotFor(count: number) {
  return (p: { cx?: number; cy?: number; index?: number; value?: unknown }) => {
    const { cx, cy, index } = p;
    if (cx === undefined || cy === undefined || p.value === null || p.value === undefined) return <g key={`d${index}`} />;
    return index === count - 1
      ? <circle key={`d${index}`} cx={cx} cy={cy} r={5} fill="#fff" stroke={INK.accent} strokeWidth={2.5} />
      : <circle key={`d${index}`} cx={cx} cy={cy} r={3} fill={INK.accent} />;
  };
}

export function Progress({ phaseId }: { phaseId: PhaseId }) {
  const phase = getPhase(phaseId);
  const settings = useSettings();
  const unit = settings.units;
  const [view, setView] = useState<View>("Strength");
  const [weekOf, setWeekOf] = useState(today());
  const lifts = useMemo(compoundLifts, []);
  const data = useLiveQuery(async () => ({
    workouts: await recentWorkoutsWithLogs(1000),
    bodyweights: (await db.bodyweights.orderBy("date").toArray()),
  }), []);
  const withHistory = useMemo(() => {
    if (!data) return [];
    return lifts.filter((e) => data.workouts.some((w) => w.logs.some((l) => l.exerciseId === e.exerciseId && l.variant === e.variant && !l.isWarmup)));
  }, [data, lifts]);
  const [liftKey, setLiftKey] = useState<string | null>(null);
  const lift = withHistory.find((e) => `${e.exerciseId}|${e.variant}` === liftKey) ?? withHistory[0];
  const liftHistory = lift && data
    ? data.workouts.map((w) => ({ workout: w.workout, logs: w.logs.filter((l) => l.exerciseId === lift.exerciseId && l.variant === lift.variant) }))
    : [];
  const series = lift ? liftSeries(lift, liftHistory) : [];

  // Headline: the latest e1RM (or top set when no set was ≤ 10 reps), and its change since the first point.
  const useE1rm = series.some((p) => p.e1rm !== null);
  const metric = (p: { top: number; e1rm: number | null }) => (useE1rm ? p.e1rm : p.top);
  const pts = series.filter((p) => metric(p) !== null);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = first && last && pts.length > 1 ? metric(last)! - metric(first)! : null;
  const spanWeeks = first && last ? Math.max(1, Math.round((parseISODate(last.date).getTime() - parseISODate(first.date).getTime()) / (7 * 86400000))) : 0;
  const lastSession = [...liftHistory].filter((h) => h.logs.some((l) => !l.isWarmup && (l.weight ?? 0) > 0)).sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt))[0];
  const topLog = lastSession?.logs.filter((l) => !l.isWarmup && (l.weight ?? 0) > 0).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];

  const plan = weeklyPlanVolume(phase);
  const logged = data ? weeklyLoggedVolume(data.workouts, weekOf) : {};
  const ws = weekStart(weekOf);
  // One shared scale for every muscle, so bar lengths and plan ticks compare across rows.
  const scaleMax = Math.max(1, ...program.muscles.map((m) => Math.max(plan[m.id] ?? 0, logged[m.id] ?? 0))) * 1.05;
  const isThisWeek = ws === weekStart(today());
  const nausea = data ? nauseaInsights(data.workouts.map((w) => w.workout)) : null;
  const nauseaList = data ? data.workouts.filter((w) => w.workout.nausea && w.workout.nausea !== "none").slice(0, 10) : [];

  const [bw, setBw] = useState<number | null>(null);
  const lastBw = data?.bodyweights[data.bodyweights.length - 1]?.weight;
  const bwValue = bw ?? lastBw ?? (unit === "kg" ? 75 : 165);

  return (
    <div className="tpad">
      <ScreenHeader title="Progress" />
      <Segmented label="Progress view" options={VIEWS} value={view} onChange={setView} />

      {view === "Strength" && (
        <>
          <section className="card liftcard">
            {data && withHistory.length === 0 ? (
              <><h3 className="cc-title">Strength trend</h3><div className="cc-empty">Log a compound lift to see its trend.</div></>
            ) : (
              <>
                <label className="picker">
                  <span>{lift?.name ?? "Exercise"}</span><Icon name="chevronDown" size={14} stroke={2.4} />
                  <select value={lift ? `${lift.exerciseId}|${lift.variant}` : ""} onChange={(e) => setLiftKey(e.target.value)} aria-label="Exercise">
                    {withHistory.map((e) => <option key={`${e.exerciseId}|${e.variant}`} value={`${e.exerciseId}|${e.variant}`}>{e.name}</option>)}
                  </select>
                </label>
                {last && (
                  <div className="bignum">
                    <b>{fmt(metric(last)!)} {unit}</b>
                    {delta !== null && delta !== 0 && <span className={delta > 0 ? "up" : "down"}>{delta > 0 ? "+" : "−"}{fmt(Math.abs(delta))} {unit} in {spanWeeks} wk</span>}
                  </div>
                )}
                <span className="bigsub">
                  {useE1rm ? "e1RM (estimate)" : "Top set"}{topLog ? ` · top set ${fmt(topLog.weight!)} ${unit} × ${topLog.reps ?? "–"}` : ""}
                </span>
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={pts} margin={{ top: 10, right: 0, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis orientation="right" domain={["auto", "auto"]} tick={AXIS} tickLine={false} axisLine={false} width={34} tickCount={3} />
                    <Tooltip {...TOOLTIP} formatter={(v: number, _n, item) => [`${fmt(v)} ${unit}${useE1rm ? ` · top set ${fmt(item.payload.top)} ${unit}` : ""}`, useE1rm ? "e1RM (est.)" : "Top set"]} labelFormatter={(d: string) => shortDate(d)} />
                    <Area dataKey={useE1rm ? "e1rm" : "top"} stroke="none" fill={INK.accent} fillOpacity={0.08} isAnimationActive={false} />
                    <Line dataKey={useE1rm ? "e1rm" : "top"} name={useE1rm ? "e1RM (est.)" : "Top set"} stroke={INK.accent} strokeWidth={2.5}
                      dot={dotFor(pts.length)} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="cc-sub">e1RM uses Epley on sets of 10 reps or fewer.</div>
              </>
            )}
          </section>

          <section className="card weekcard">
            <div className="wk-head">
              <h3 className="cc-title">Weekly sets</h3>
              <div className="wk-nav">
                <button className="iconbtn sm" onClick={() => setWeekOf(addDays(ws, -7))} aria-label="Previous week"><Icon name="chevronLeft" size={16} /></button>
                <span>{isThisWeek ? "This week" : `Week of ${shortDate(ws)}`} vs plan</span>
                <button className="iconbtn sm" disabled={isThisWeek} onClick={() => setWeekOf(addDays(ws, 7))} aria-label="Next week"><Icon name="chevronRight" size={16} /></button>
              </div>
            </div>
            <div className="vbars" role="table" aria-label="Logged versus planned sets">
              {program.muscles.map((m) => {
                const p = plan[m.id] ?? 0;
                const l = logged[m.id] ?? 0;
                return (
                  <div className="vbar" role="row" key={m.id}>
                    <div className="vb-top"><span role="cell">{m.label}</span><span role="cell" className="vb-num"><b>{fmt(l)}</b> / {fmt(p)}</span></div>
                    <div className="vb-track" aria-hidden>
                      <div className="vb-fill" style={{ width: `${(l / scaleMax) * 100}%` }} />
                      {p > 0 && <div className="vb-plan" style={{ left: `${(p / scaleMax) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cc-sub">Fractional sets: bar = logged, line = {phase.name} plan. Per-side work counts once per pair.</div>
          </section>

          <ChartCard title={`Bodyweight (${unit}) · optional`}>
            <div className="bwrow">
              <div style={{ flex: 1 }}><Stepper label="Today" value={bwValue} step={unit === "kg" ? 0.1 : 0.2} min={20} max={400} unit={unit} onChange={setBw} /></div>
              <button className="btn2 primary bwsave" onClick={() => void db.bodyweights.put({ id: today(), date: today(), weight: bwValue }).then(() => setBw(null))}>Save</button>
            </div>
            {data && data.bodyweights.length > 1 && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data.bodyweights} margin={{ top: 8, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={INK.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis orientation="right" domain={["auto", "auto"]} tick={AXIS} tickLine={false} axisLine={false} width={34} tickCount={3} />
                  <Tooltip {...TOOLTIP} formatter={(v: number) => [`${fmt(v)} ${unit}`, "Bodyweight"]} labelFormatter={(d: string) => shortDate(d)} />
                  <Line dataKey="weight" stroke={INK.accent} strokeWidth={2.5} dot={dotFor(data.bodyweights.length)} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {data && data.bodyweights.length === 1 && <div className="cc-empty">Saved {data.bodyweights[0]!.weight} {unit}. Log another day to see a line.</div>}
          </ChartCard>
        </>
      )}

      {view === "Rehab" && <RehabCharts phase={phase} />}

      {view === "Nausea" && (
        <>
          {!nausea || nausea.total === 0 ? (
            <section className="card"><h3 className="cc-title">Nausea log</h3><div className="cc-empty" style={{ marginTop: 8 }}>Finish a workout to start the nausea log.</div></section>
          ) : (
            <>
              <div className="sechead-row"><h3 className="sechead">By session</h3><span>{nausea.total} workouts</span></div>
              <div className="lgroup">
                {nausea.bySlot.map((r) => (
                  <div className="lrow static" key={r.group}><span className="txt"><b>{r.group}</b><small>{r.nauseous} of {r.n} with nausea</small></span><span className="trail strong">{pct(r.rate)}</span></div>
                ))}
              </div>
              <h3 className="sechead">By meal timing</h3>
              <div className="lgroup">
                {nausea.byMeal.map((r) => (
                  <div className="lrow static" key={r.group}><span className="txt"><b>{r.group}</b><small>{r.nauseous} of {r.n} with nausea</small></span><span className="trail strong">{pct(r.rate)}</span></div>
                ))}
              </div>
              <div className="fnote">Share of finished workouts with any nausea. Descriptive only.</div>
              {nauseaList.length > 0 && (
                <>
                  <h3 className="sechead">Recent episodes</h3>
                  <div className="lgroup">
                    {nauseaList.map((w) => (
                      <div className="lrow static" key={w.workout.id}>
                        <span className="txt">
                          <b>{w.workout.nausea!.charAt(0).toUpperCase() + w.workout.nausea!.slice(1)}{w.workout.nauseaWhen ? ` · at the ${w.workout.nauseaWhen}` : ""} · {program.sessions[w.workout.sessionId]?.title.split(":")[0]}</b>
                          <small>{w.workout.date} · {w.workout.mealSize ?? "meal ?"}{w.workout.hoursSinceMeal !== undefined ? ` ${w.workout.hoursSinceMeal} h before` : ""}{w.workout.notes ? ` · ${w.workout.notes}` : ""}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <h3 className="sechead">Nausea tips from your plan</h3>
          <div className="lgroup">
            {program.nauseaTips.map((t) => (
              <ExpandRow key={t.title} icon="info" title={t.title}>{t.text}</ExpandRow>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
