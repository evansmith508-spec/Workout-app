import type { ReactNode } from "react";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function Stepper({ label, value, step, min = 0, max = 9999, unit, onChange, testId }: {
  label: string; value: number; step: number; min?: number; max?: number; unit?: string;
  onChange: (v: number) => void; testId?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)));
  return (
    <div className="stepper" data-testid={testId}>
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - step)} disabled={value <= min}>−</button>
        <output aria-label={label}>{fmt(value)}{unit ? <small> {unit}</small> : null}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + step)} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

export function Chips<T extends string | number>({ label, options, value, onChange, render }: {
  label: string; options: readonly T[]; value: T | null | undefined; onChange: (v: T) => void; render?: (v: T) => ReactNode;
}) {
  return (
    <div className="chips-field">
      <div className="stepper-label">{label}</div>
      <div className="chipset" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={String(o)} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
            {render ? render(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PainSlider({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const over = value > max;
  return (
    <div className={`pain ${over ? "over" : ""}`}>
      <div className="stepper-label">Pain during <b>{value}/10</b>{over ? ` · above ${max}/10 rule` : ""}</div>
      <input type="range" min={0} max={10} step={1} value={value} aria-label="Pain 0 to 10" onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
