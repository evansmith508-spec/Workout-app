import { Icon, type IconName } from "./ui";

export type Tab = "today" | "rehab" | "mobility" | "progress" | "settings";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "today", label: "Today", icon: "calendar" },
  { id: "rehab", label: "Rehab", icon: "pulse" },
  { id: "mobility", label: "Mobility", icon: "figure" },
  { id: "progress", label: "Progress", icon: "bars" },
  { id: "settings", label: "Settings", icon: "sliders" },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => onChange(t.id)} aria-current={tab === t.id ? "page" : undefined}>
          <Icon name={t.icon} size={24} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
