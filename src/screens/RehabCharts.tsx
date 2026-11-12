import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, ComposedChart, Bar, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "../db/db";
import { recentWorkoutsWithLogs } from "../db/repo";
import type { Phase } from "../program/types";
import { nordicSeries, painSeries, primerAdherence } from "../rules/progress";
import { today } from "../rules/dates";
import { AXIS, ChartCard, INK, SERIES, shortDate, TOOLTIP } from "../components/charts";

const VARIANT: Record<string, string> = { "fingertip-assist": "fingertip assist", "full-unassisted": "full", maintenance: "maintenance" };

export function RehabCharts({ phase }: { phase: Phase }) {
  const data = useLiveQuery(async () => {
    const workouts = (await recentWorkoutsWithLogs(500)).reverse();
    return {
      pain: painSeries(workouts, await db.painChecks.toArray()),
      nordic: nordicSeries(workouts),
      primer: primerAdherence(await db.primerLogs.toArray(), phase, today(), 14),
    };
  }, [phase.id]);
  if (!data) return null;
  const primerAny = data.primer.some((d) => d.target > 0 || d.done > 0);
  return (
    <>
      <ChartCard title="Hamstring pain over time" sub={`0–10 · dashed line = Phase rule (${phase.painRule.maxDuringPain}/10)`} empty={data.pain.length === 0 && "Log a session with hamstring work or a pain check to see this."}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.pain} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: INK.grid }} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={AXIS} tickLine={false} axisLine={false} />
            <ReferenceLine y={phase.painRule.maxDuringPain} stroke={INK.muted} strokeDasharray="4 4" />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
            <Line name="During sets (max)" dataKey="during" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line name="At rest" dataKey="atRest" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line name="Morning-after" dataKey="morningAfter" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Nordic progression" sub="Best reps per session · tooltip shows variant and control (1–3)" empty={data.nordic.length === 0 && "No Nordic sessions yet (they start in Phase 2)."}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.nordic.map((n) => ({ ...n, variantText: VARIANT[n.variant] ?? n.variant }))} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: INK.grid }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} formatter={(v, _n, item) => [`${v} reps · ${item.payload.variantText} · control ${item.payload.control ?? "–"}`, "Nordic"]} />
            <Line name="Reps" dataKey="reps" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="cc-list">
          {data.nordic.slice(-4).reverse().map((n, i) => (
            <div className="cc-row" key={i}><span><b>{n.reps} reps</b> · {VARIANT[n.variant] ?? n.variant}</span><small>{n.date} · control {n.control ?? "–"}</small></div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Primer adherence · last 14 days" sub="Bars = primer sessions logged · line = daily target" empty={!primerAny && "In this phase the primer is part of your session warm-up."}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data.primer} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: INK.grid }} interval={1} />
            <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(3, max)]} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar name="Done" dataKey="done" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Line name="Target" type="stepAfter" dataKey="target" stroke={INK.secondary} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
