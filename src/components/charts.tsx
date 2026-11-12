// Shared chart styling. Palette validated with the dataviz validator (light surface);
// every multi-series chart has a legend, and tooltips give exact values.
import type { ReactNode } from "react";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
// Mirrors the CSS tokens (design/HANDOFF.md §2): Recharts takes colors as props, not CSS variables.
export const INK = { primary: "#0B0D12", secondary: "#3F4752", muted: "#5E6573", grid: "#EEF0F3", accent: "#2563EB" };
const FONT = "'Inter Variable', Inter, system-ui, sans-serif";
export const AXIS = { fontSize: 10, fontFamily: FONT, fill: INK.muted };
export const TOOLTIP = {
  contentStyle: { fontFamily: FONT, fontSize: 12, borderRadius: 12, border: "1px solid #E5E7EB", boxShadow: "0 8px 24px rgba(16,24,40,.08)" },
  labelStyle: { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: INK.secondary },
};
export const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export function ChartCard({ title, sub, children, empty }: { title: string; sub?: string; children: ReactNode; empty?: string | false }) {
  return (
    <section className="card chartcard">
      <h3 className="cc-title">{title}</h3>
      {sub && <div className="cc-sub">{sub}</div>}
      {empty ? <div className="cc-empty">{empty}</div> : children}
    </section>
  );
}
