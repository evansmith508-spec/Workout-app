// Shared building blocks for the "Clean" look (design/HANDOFF.md §4). Styling and markup only.
import type { CSSProperties, ReactNode } from "react";
import type { PhaseId } from "../program/types";
import { phaseTheme } from "../theme";

const PATHS = {
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  check: "M5 12l5 5L20 7",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M5 12l7 7 7-7",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  upload: "M12 20V8M7 13l5-5 5 5M5 4h14",
  file: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21V5",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 100-18 9 9 0 000 18z",
  pause: "M10 6v12M14 6v12",
  changes: "M4 7h16M4 12h10M4 17h7",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3M7.5 15h9",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3-.5-2.5-1-5 0-8z",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  play: "M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z",
  calendar: "M3 7a3 3 0 013-3h12a3 3 0 013 3v11a3 3 0 01-3 3H6a3 3 0 01-3-3zM3 9h18M8 2v4M16 2v4",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  figure: "M12 2.5a2 2 0 110 4 2 2 0 010-4zM5 9l7 1.5L19 9M12 10.5V15l-4 6M12 15l4 6",
  bars: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  sun: "M12 8a4 4 0 110 8 4 4 0 010-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 6h3v2a3 3 0 01-3 3M7 6H4v2a3 3 0 003 3",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4a2 2 0 110 4 2 2 0 010-4zM10 10a2 2 0 110 4 2 2 0 010-4zM18 16a2 2 0 110 4 2 2 0 010-4z",
} as const;
export type IconName = keyof typeof PATHS;

/** 24-unit stroke icon. Decorative unless a label is given. */
export function Icon({ name, size = 20, stroke = 2, label }: { name: IconName; size?: number; stroke?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={PATHS[name]} fill={name === "play" ? "currentColor" : undefined} stroke={name === "play" ? "none" : undefined} />
    </svg>
  );
}

/** 11/700 tag. "main" = accent tint, "rehab" = phase tint. */
export function Tag({ kind, children }: { kind: "main" | "rehab" | "plain"; children: ReactNode }) {
  return <span className={`tag2 ${kind}`}>{children}</span>;
}

/** A row in a list group that expands when tapped. */
export function ExpandRow({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children: ReactNode }) {
  return (
    <details className="lrow-x">
      <summary>
        <span className="lead"><Icon name={icon} size={20} /></span>
        <span className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
        <span className="chev"><Icon name="chevronDown" size={18} /></span>
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}

/** Equal-width number buttons (RPE 1–10, pain 0–10). Selected = accent fill. */
export function NumberRow({ label, from, to, value, onChange, cols, ends }: {
  label: string; from: number; to: number; value: number | null; onChange: (v: number) => void; cols?: number; ends?: [string, string];
}) {
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="numrow-wrap">
      <div className="numrow" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${cols ?? nums.length}, 1fr)` }}>
        {nums.map((n) => (
          <button type="button" key={n} role="radio" aria-checked={value === n} className={value === n ? "on" : ""} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      {ends && <div className="numrow-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>}
    </div>
  );
}

/** Screen header: uppercase eyebrow, 34 px title, optional right slot. Keeps header.hero h1 for tests. */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="hero screenhead">
      <div className="sh-left">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** Pill with the phase tint, dark phase ink and an 8 px dot in the phase color. */
export function PhaseBadge({ id, children }: { id: PhaseId; children: ReactNode }) {
  const t = phaseTheme(id);
  const style = { "--pb-color": t.color, "--pb-tint": t.tint, "--pb-ink": t.ink } as CSSProperties;
  return <span className="phasebadge" style={style}><span className="dot" aria-hidden />{children}</span>;
}

/** Segmented control: grey track, selected segment white. */
export function Segmented<T extends string>({ label, options, value, onChange, render }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void; render?: (v: T) => ReactNode;
}) {
  return (
    <div className="segc" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Uppercase label above a list group. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="grouplabel">{children}</div>;
}

/** Pill chips with a 44 px hit area. Selected = filled ink. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, render }: {
  label: string; options: readonly T[]; value: T | null; onChange: (v: T) => void; render?: (v: T) => ReactNode;
}) {
  return (
    <div className="choicechips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          <span>{render ? render(o) : o}</span>
        </button>
      ))}
    </div>
  );
}

/** Option tiles: grey fill; selected gets the accent tint, ring and ink. */
export function OptionTiles<T extends string>({ label, options, value, onChange, render, tall }: {
  label: string; options: readonly T[]; value: T | null; onChange: (v: T) => void; render?: (v: T) => ReactNode; tall?: boolean;
}) {
  return (
    <div className={`otiles ${tall ? "tall" : ""}`} role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Inline − value + stepper for list rows. */
export function InlineStepper({ label, value, step, min, max, unit, onChange }: {
  label: string; value: number; step: number; min: number; max: number; unit?: string; onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)));
  return (
    <div className="istep">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => set(value - step)}>−</button>
      <output aria-label={label}>{value}{unit ? <small> {unit}</small> : null}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

/** iOS-style switch: on = --done, off = --border-strong. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}
