import { lazy, Suspense, useEffect, useState } from "react";
import { getPhase, sessionForSlot } from "./program/program";
import type { PhaseId, Slot } from "./program/types";
import { today } from "./rules/dates";
import { useActiveWorkout, usePhaseState, useSettings, useStoredSettings, useWeekWorkouts } from "./db/hooks";
import { FirstLaunch } from "./components/FirstLaunch";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { discardWorkout, setCurrentPhase, startWorkout } from "./db/repo";
import { resolveSession } from "./rules/pain";
import { TabBar, type Tab } from "./components/TabBar";
import { Footer } from "./components/Footer";
import { Today } from "./screens/Today";
import { SessionView } from "./screens/SessionView";
import { Logger, clearDraft } from "./screens/Logger";
import { Rehab } from "./screens/Rehab";
import { Mobility } from "./screens/Mobility";
import { Settings } from "./screens/Settings";
import { applyPhaseTheme } from "./theme";

const Progress = lazy(() => import("./screens/Progress").then((m) => ({ default: m.Progress })));

type Open = { phaseId: PhaseId; slot: Slot } | null;

export function App() {
  const phaseState = usePhaseState();
  const settings = useSettings();
  const stored = useStoredSettings();
  const active = useActiveWorkout();
  const week = useWeekWorkouts();
  const [tab, setTab] = useState<Tab>("today");
  const [open, setOpen] = useState<Open>(null);
  const [logging, setLogging] = useState<string | null>(null);
  // Follow the workout by id so the summary still shows after it is marked finished.
  const loggingWorkout = useLiveQuery(async () => (logging ? (await db.workouts.get(logging)) ?? null : null), [logging]);
  const date = today();
  const phaseId: PhaseId = phaseState?.currentPhaseId ?? "p1";

  useEffect(() => {
    const id = loggingWorkout ? loggingWorkout.phaseId : open?.phaseId ?? phaseId;
    applyPhaseTheme(id);
  }, [phaseId, open, loggingWorkout]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, open, logging]);
  useEffect(() => {
    const go = (e: Event) => { setOpen(null); setLogging(null); setTab((e as CustomEvent<Tab>).detail); };
    window.addEventListener("wt:tab", go);
    return () => window.removeEventListener("wt:tab", go);
  }, []);

  const start = async (pid: PhaseId, slot: Slot) => {
    if (active) {
      const ok = window.confirm("You have an unfinished workout. Discard it and start this one?");
      if (!ok) return;
      await discardWorkout(active.id);
      clearDraft(active.id);
    }
    const phase = getPhase(pid);
    const session = phaseState && pid === phaseState.currentPhaseId ? resolveSession(phase, slot, phaseState, today()) : sessionForSlot(phase, slot);
    const w = await startWorkout(phase, session);
    setOpen(null);
    setLogging(w.id);
  };

  if (!phaseState || active === undefined || stored === undefined) return <div className="wrap" />;
  if (stored === null) return <FirstLaunch />;

  let screen;
  if (logging && loggingWorkout) {
    screen = <Logger key={loggingWorkout.id} workout={loggingWorkout} settings={settings} onExit={() => setLogging(null)} />;
  } else if (open) {
    const phase = getPhase(open.phaseId);
    const session = open.phaseId === phaseId ? resolveSession(phase, open.slot, phaseState, date) : sessionForSlot(phase, open.slot);
    screen = <SessionView phase={phase} session={session} onBack={() => setOpen(null)}
      onStart={open.phaseId === phaseId ? () => void start(open.phaseId, open.slot) : undefined} />;
  } else if (tab === "today") {
    screen = (
      <Today phaseId={phaseId} phaseState={phaseState} date={date} active={active}
        sessionFor={(slot) => resolveSession(getPhase(phaseId), slot, phaseState, date)}
        completed={week.map((w) => ({ date: w.date, slot: w.slot, finished: !!w.finishedAt }))}
        onOpenSession={(p, s) => setOpen({ phaseId: p, slot: s })}
        onStart={(s) => void start(phaseId, s)} onResume={() => active && setLogging(active.id)} />
    );
  } else if (tab === "rehab") screen = <Rehab phaseId={phaseId} phaseState={phaseState} />;
  else if (tab === "mobility") screen = <Mobility />;
  else if (tab === "progress") screen = <Progress phaseId={phaseId} />;
  else screen = <Settings phaseId={phaseId} onPhase={(p) => void setCurrentPhase(p, "manual")} />;

  return (
    <>
      <div className={`wrap ${logging ? "full" : ""}`}>
        <Suspense fallback={<div className="tpad"><div className="card loading">Loading…</div></div>}>{screen}</Suspense>
        {!logging && <Footer />}
      </div>
      {/* The logger is full screen: no tab bar (design/HANDOFF.md §5.1). */}
      {!logging && <TabBar tab={tab} onChange={(t) => { setOpen(null); setLogging(null); setTab(t); }} />}
    </>
  );
}
