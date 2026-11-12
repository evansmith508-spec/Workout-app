import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getPhase, getSession, isSlot, program, SLOT_ORDER } from "../program/program";
import type { Phase, PhaseId, Session, Slot } from "../program/types";
import type { PhaseState, Workout } from "../db/types";
import { addDays, parseISODate, weekStart, weekdayOf } from "../rules/dates";
import { nextSession, slotFor, type CompletedSession } from "../rules/schedule";
import { sessionWorkingSets } from "../rules/volume";
import { lowerYesterday, weeksInPhase } from "../rules/criteria";
import { needsRegression, regressionActive, regressionUntil } from "../rules/pain";
import { primerTarget } from "../rules/reminders";
import { recentWorkoutsWithLogs, setLegRegression } from "../db/repo";
import { useDayLogs, useRecentWorkouts } from "../db/hooks";
import { Icon, PhaseBadge, ScreenHeader, Segmented, Tag } from "../components/ui";
import { db } from "../db/db";
import { MorningCheck, PrimerSheet } from "../components/RehabInputs";

const DAY_LETTER: Record<string, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const DAY_FULL: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function splitTitle(title: string): [string, string | undefined] {
  const at = title.indexOf(": ");
  return at < 0 ? [title, undefined] : [title.slice(0, at), title.slice(at + 2)];
}

/** The "Up next" hero card (design/HANDOFF.md §5.2). */
function SessionHero({ eyebrow, session, done, note, onOpen, onStart }: {
  eyebrow: string; session: Session; done: boolean; note?: string; onOpen: () => void; onStart: () => void;
}) {
  const [main, sub] = splitTitle(session.title);
  const first = session.exercises.slice(0, 3);
  return (
    <section className="herocard" aria-label={`${eyebrow}: ${session.title}`}>
      <div className="hc-top">
        <span className="eyebrow accent">{eyebrow}</span>
        <h2>{main}</h2>
        <span className="hc-sub">{[sub, `${session.exercises.length} exercises`, `${sessionWorkingSets(session)} sets`].filter(Boolean).join(" · ")}</span>
        {note && <span className="hc-note">{note}</span>}
        {done && <span className="hc-done"><Icon name="check" size={14} stroke={3} />Done this week</span>}
      </div>
      <div className="hc-list">
        {first.map((e) => (
          <div className="hc-ex" key={e.label}>
            <span className="numbadge">{e.label}</span>
            <span className="nm">{e.name}{e.isMainLift && <> <Tag kind="main">Main</Tag></>}</span>
            <span className="rx">{e.prescription.display}</span>
          </div>
        ))}
        {session.exercises.length > 3 && (
          <button className="textbtn seeall" onClick={onOpen}>See all {session.exercises.length} exercises<Icon name="chevronRight" size={16} /></button>
        )}
      </div>
      <button className="btn2 primary block" onClick={onStart}><Icon name="play" size={18} />Start workout</button>
    </section>
  );
}

function ResumeHero({ workout, onResume }: { workout: Workout; onResume: () => void }) {
  const session = getSession(workout.sessionId);
  const [main, sub] = splitTitle(session.title);
  const done = useLiveQuery(async () => {
    const logs = await db.setLogs.where("workoutId").equals(workout.id).toArray();
    return new Set(logs.filter((l) => !l.isWarmup).map((l) => `${l.exerciseIndex}:${l.setIndex}`)).size;
  }, [workout.id], 0);
  const total = session.exercises.reduce((n, e) => n + (e.prescription.sets ?? 1), 0);
  const started = new Date(workout.startedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return (
    <section className="herocard" data-testid="resume-banner">
      <div className="hc-top">
        <span className="eyebrow accent">In progress</span>
        <h2>{main}</h2>
        <span className="hc-sub">{[sub, `${done} of ${total} sets done`, `started ${started}`].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="lprogress hc-prog" aria-hidden><div style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} /></div>
      <button className="btn2 primary block" onClick={onResume}><Icon name="play" size={18} />Resume workout</button>
    </section>
  );
}

function InfoHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="herocard">
      <div className="hc-top">
        <span className="eyebrow accent">{eyebrow}</span>
        <h2>{title}</h2>
        <span className="hc-sub">{text}</span>
      </div>
    </section>
  );
}

/** The p3 drop-back banner (Section 7.4): pain > 0 on hamstring work in the latest Phase 3 session. */
export function RegressionBanner({ phase, state, date }: { phase: Phase; state: PhaseState; date: string }) {
  const latest = useLiveQuery(async () => (await recentWorkoutsWithLogs(5)).find((w) => w.workout.phaseId === "p3") ?? null, []);
  if (phase.id !== "p3" || !latest || regressionActive(state, date) || !needsRegression(phase, latest)) return null;
  return (
    <div className="alertcard big" data-testid="regression-banner">
      <strong><Icon name="alert" size={18} />Drop back to Phase 2 loads for 1 week</strong>
      Phase 3 allows no hamstring pain, and your last session ({latest.workout.date}) had some. Lower A and Lower B will use the Phase 2 sessions for 7 days.
      <button className="btn2 primary block" onClick={() => void setLegRegression(regressionUntil(date))}>Drop back for 1 week</button>
    </div>
  );
}

export function Today({ phaseId, phaseState, date, completed, active, sessionFor, onOpenSession, onStart, onResume }: {
  phaseId: PhaseId; phaseState: PhaseState; date: string; completed: CompletedSession[]; active: Workout | null;
  sessionFor: (slot: Slot) => Session;
  onOpenSession: (phase: PhaseId, slot: Slot) => void;
  onStart: (slot: Slot) => void; onResume: () => void;
}) {
  const phase = getPhase(phaseId);
  const slot = slotFor(phase, date);
  const dow = weekdayOf(date);
  const upNext = completed.length > 0 ? nextSession(phase, completed, date) : null;
  const doneSlots = new Set(completed.filter((c) => c.finished).map((c) => c.slot));
  const [browse, setBrowse] = useState<PhaseId>(phaseId);
  const [sheet, setSheet] = useState<"primer" | null>(null);
  const browsePhase = getPhase(browse);
  const day = useDayLogs(date);
  const recent = useRecentWorkouts(2, date);
  const regression = regressionActive(phaseState, date);
  const regressionNote = regression ? `Regression week until ${phaseState.legRegressionUntil}: Phase 2 loads.` : undefined;

  const needMorningAfter = day !== undefined && lowerYesterday(recent, date) && !day.painChecks.some((c) => c.kind === "morning-after");
  const snoozeKey = `wt.morningLater.${date}`;
  const [later, setLater] = useState(() => { try { return sessionStorage.getItem(snoozeKey) === "1"; } catch { return false; } });
  const remindLater = () => { try { sessionStorage.setItem(snoozeKey, "1"); } catch { /* ignore */ } setLater(true); };
  const yesterdayLower = recent.find((w) => w.date === addDays(date, -1) && (w.slot === "LA" || w.slot === "LB") && w.finishedAt);
  const yesterdayName = yesterdayLower ? splitTitle(getSession(yesterdayLower.sessionId).title)[0] : null;
  const primerTimes = day?.primer.length ?? 0;
  const target = primerTarget(phase, slot);
  const mobDone = (id: string) => day?.mobility.some((m) => m.routineId === id && m.completedItems >= m.total);

  const ws = weekStart(date);
  const heroSlot: Slot | null = isSlot(slot) && !doneSlots.has(slot) ? slot : upNext;
  const behind = isSlot(slot) && !doneSlots.has(slot) && upNext && upNext !== slot ? upNext : null;
  const mobTime = (id: string) => program.mobility.find((m) => m.id === id)?.time ?? "";
  const goMobility = () => window.dispatchEvent(new CustomEvent("wt:tab", { detail: "mobility" }));
  const primerOk = target.count > 0 && primerTimes >= target.count;

  let hero;
  if (active) hero = <ResumeHero workout={active} onResume={onResume} />;
  else if (heroSlot) {
    hero = (
      <SessionHero eyebrow="Up next" session={sessionFor(heroSlot)} done={false}
        note={[heroSlot !== slot ? (isSlot(slot) ? "Today's session is done. This is next in your order." : "Rest day on the calendar. This is next in your order if you want to train.") : null,
          heroSlot === "LA" || heroSlot === "LB" ? regressionNote : null].filter(Boolean).join(" ") || undefined}
        onOpen={() => onOpenSession(phaseId, heroSlot)} onStart={() => onStart(heroSlot)} />
    );
  } else if (isSlot(slot)) {
    hero = <SessionHero eyebrow="Today" session={sessionFor(slot)} done={doneSlots.has(slot)} onOpen={() => onOpenSession(phaseId, slot)} onStart={() => onStart(slot)} />;
  } else if (completed.length > 0) hero = <InfoHero eyebrow="This week" title="All four sessions done" text="Nice work. Evening mobility is still worth doing." />;
  else hero = <InfoHero eyebrow="Today" title="Rest day" text="Recover. Evening mobility is still worth doing." />;

  return (
    <>
      <div className="tpad">
        <ScreenHeader eyebrow={`${DAY_FULL[dow]} · Week ${weeksInPhase(phaseState.phaseStartedAt, date)}`} title="Today"
          right={<PhaseBadge id={phaseId}>{phase.name} · {phase.label}</PhaseBadge>} />

        {needMorningAfter && later && (
          <div className="card behind">
            <div><b>Morning check not done yet</b><small>How's the hamstring after {yesterdayName ?? "yesterday's Lower day"}? Two quick taps.</small></div>
            <button className="btn2 outline" onClick={() => { try { sessionStorage.removeItem(snoozeKey); } catch { /* ignore */ } setLater(false); }}>Do it now</button>
          </div>
        )}
        <RegressionBanner phase={phase} state={phaseState} date={date} />

        <div className="weekstrip" aria-label="This week">
          {phase.week.map((w, i) => {
            const d = addDays(ws, i);
            const isToday = d === date;
            const gym = isSlot(w.slot);
            const done = gym && doneSlots.has(w.slot as Slot);
            const code = gym ? w.slot : "Rest";
            const circle = done ? <span className="wc done"><Icon name="check" size={14} stroke={3} /></span>
              : isToday ? <span className="wc num">{parseISODate(d).getDate()}</span>
              : <span className={`wc ${gym ? "gym" : "rest"}`} />;
            const label = `${DAY_FULL[w.day]}: ${w.label}${done ? ", done" : ""}${isToday ? ", today" : ""}`;
            const body = <><span className="wd">{DAY_LETTER[w.day]}</span>{circle}<span className="wl">{code}</span></>;
            return gym
              ? <button key={w.day} className={`wtile ${isToday ? "today" : ""}`} aria-label={label} aria-current={isToday ? "date" : undefined} onClick={() => onOpenSession(phaseId, w.slot as Slot)}>{body}</button>
              : <div key={w.day} className={`wtile ${isToday ? "today" : ""}`} aria-label={label} aria-current={isToday ? "date" : undefined}>{body}</div>;
          })}
        </div>

        {hero}

        {behind && (
          <div className="card behind">
            <div><b>{sessionFor(behind).title.split(":")[0]} isn't done yet this week</b><small>Follow the session order rather than the calendar.</small></div>
            <button className="btn2 outline" onClick={() => onStart(behind)}>Start {sessionFor(behind).title.split(":")[0]}</button>
          </div>
        )}

        <h3 className="sechead">Daily</h3>
        <div className="lgroup">
          <button className="lrow" onClick={goMobility}>
            <span className={`cbox ${mobDone("morning") ? "on" : ""}`} aria-hidden><Icon name="check" size={14} stroke={3} /></span>
            <span className="txt"><b>Morning mobility</b><small>{mobDone("morning") ? "Done today" : mobTime("morning")}</small></span>
            <Icon name="chevronRight" size={18} />
          </button>
          <button className="lrow" onClick={() => setSheet("primer")} data-testid="primer-tile">
            <span className={`cbox ${primerOk ? "on" : ""}`} aria-hidden><Icon name="check" size={14} stroke={3} /></span>
            <span className="txt"><b>Primer holds</b><small>{phase.primer.sets} × {phase.primer.holdSec} s at each knee angle{target.count > 0 ? "" : ` · ${target.text}`}</small></span>
            {target.count > 0 && <span className="trail">{primerTimes} / {target.count}</span>}
          </button>
          <button className="lrow" onClick={goMobility}>
            <span className={`cbox ${mobDone("evening") ? "on" : ""}`} aria-hidden><Icon name="check" size={14} stroke={3} /></span>
            <span className="txt"><b>Evening mobility</b><small>{mobDone("evening") ? "Done today" : mobTime("evening")}</small></span>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        <h3 className="sechead">All sessions</h3>
        <Segmented label="Browse phase" options={program.phases.map((p) => p.id)} value={browse} onChange={setBrowse}
          render={(id) => getPhase(id).name.replace("Phase ", "P")} />
        <div className="lgroup sessgrid">
          {SLOT_ORDER.map((s) => {
            const sess = browse === phaseId ? sessionFor(s) : getSession(browsePhase.sessionIds[s]);
            const done = browse === phaseId && doneSlots.has(s);
            const [main, sub] = splitTitle(sess.title);
            return (
              <button key={s} className="lrow" onClick={() => onOpenSession(browse, s)}>
                <span className="numbadge code">{s}</span>
                <span className="txt"><b>{main}{browse === phaseId && s === upNext ? <> <Tag kind="main">Next</Tag></> : null}</b>
                  <small>{[sub, `${sess.id} · ${sessionWorkingSets(sess)} sets`].filter(Boolean).join(" · ")}{done && <span className="okmark"> · ✓ Done</span>}</small></span>
                <Icon name="chevronRight" size={18} />
              </button>
            );
          })}
        </div>
      </div>
      {sheet === "primer" && <PrimerSheet phase={phase} onClose={() => setSheet(null)} />}
      {needMorningAfter && !later && (
        <MorningCheck date={date} weekday={DAY_FULL[dow] ?? ""} sessionName={yesterdayName} phase={phase} onLater={remindLater} />
      )}
    </>
  );
}
