import { useState } from "react";
import type { Exercise, Phase, Session } from "../program/types";
import { mainLift, sessionWorkingSets } from "../rules/volume";
import { ExpandRow, Icon, Tag } from "../components/ui";

/** Group exercises so a superset "first" + "second" render as one joined pair. */
export function groupExercises(exs: Exercise[]): Exercise[][] {
  const out: Exercise[][] = [];
  for (let i = 0; i < exs.length; i++) {
    const e = exs[i]!;
    const next = exs[i + 1];
    if (e.superset === "first" && next?.superset === "second") {
      out.push([e, next]);
      i++;
    } else out.push([e]);
  }
  return out;
}

export function prescriptionLine(e: Exercise): string {
  return [e.prescription.display, e.rest?.display, e.effort?.display].filter(Boolean).join(" · ");
}

function ExerciseCard({ e }: { e: Exercise }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="excard" data-testid={`ex-${e.label}`}>
      <div className="exhead">
        <div className="extitle">
          <h2>{e.label} · {e.name}</h2>
          <span className="exsub">{prescriptionLine(e)}</span>
        </div>
        {e.isMainLift ? <Tag kind="main">Main lift</Tag> : e.hamstringLoad ? <Tag kind="rehab">Rehab</Tag> : null}
      </div>
      <button className="textbtn cues" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Hide cues" : "Cues"}<Icon name="chevronDown" size={14} />
      </button>
      {open && <div className="cue">{e.cue}</div>}
    </section>
  );
}

function splitTitle(title: string): [string, string | undefined] {
  const at = title.indexOf(": ");
  return at < 0 ? [title, undefined] : [title.slice(0, at), title.slice(at + 2)];
}

export function SessionView({ session, phase, onBack, onStart }: { session: Session; phase: Phase; onBack: () => void; onStart?: () => void }) {
  const main = mainLift(session);
  const warmupPrimer = phase.primer.schedule === "warm-up";
  const [titleMain, titleSub] = splitTitle(session.title);
  const dayShort = session.day.split("·").pop()?.trim() ?? session.day;
  return (
    <div className="finish">
      <div className="ftop">
        <button className="textbtn back" onClick={onBack}>Back</button>
        <span className="ftitle">{phase.name} · {phase.label}</span>
        <span className="ftop-spacer" />
      </div>
      <div className="fbody">
        <header className="hero ltitle">
          <h1>{titleMain}</h1>
          <p>{[titleSub, `${sessionWorkingSets(session)} sets`, main ? `main lift ${main.name}` : null, dayShort].filter(Boolean).join(" · ")}</p>
        </header>

        <div className="lgroup">
          {session.whatChanged.length > 0 && (
            <ExpandRow icon="changes" title="What changed" sub={`${session.whatChanged.length} change${session.whatChanged.length === 1 ? "" : "s"} from the old plan`}>
              <ul>{session.whatChanged.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </ExpandRow>
          )}
          {session.science.length > 0 && (
            <ExpandRow icon="flask" title="Science behind this session" sub={`${session.science.length} notes`}>
              {session.science.map((s, i) => (
                <div className="sci-it" key={i}>
                  <span className={`lvl ${s.level === "study" ? "study" : "call"}`}>{s.level === "study" ? "Study" : "Coaching call"}</span>
                  <span className="src">{s.source}</span><div>{s.text}</div>
                </div>
              ))}
            </ExpandRow>
          )}
          <ExpandRow icon="flame" title="Warm-up" sub="Wake-up routine, then ramp-up sets">
            Morning wake-up routine, then 1–2 light ramp-up sets of your first exercise.
            {warmupPrimer && <> Include the primer holds: {phase.primer.display}</>}
          </ExpandRow>
        </div>

        {groupExercises(session.exercises).map((g) =>
          g.length === 2 ? (
            <div className="ssgroup" key={g[0]!.label}>
              <div className="sslabel">Superset {g[0]!.label} + {g[1]!.label}</div>
              <ExerciseCard e={g[0]!} />
              <ExerciseCard e={g[1]!} />
            </div>
          ) : (
            <ExerciseCard key={g[0]!.label} e={g[0]!} />
          ),
        )}
      </div>
      {onStart && <div className="fsticky"><button className="btn2 primary block" onClick={onStart}><Icon name="play" size={18} />Start this session</button></div>}
    </div>
  );
}
