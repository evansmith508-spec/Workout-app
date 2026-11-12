import { useState } from "react";
import { initSettings } from "../db/repo";
import { program } from "../program/program";
import { ScreenHeader } from "./ui";

/** Shown once, before anything else, until units are chosen. */
export function FirstLaunch() {
  const [busy, setBusy] = useState(false);
  const pick = async (u: "kg" | "lb") => {
    setBusy(true);
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
    await initSettings(u);
  };
  return (
    <div className="wrap">
      <div className="tpad">
        <ScreenHeader eyebrow="Welcome" title="Workout Tracker" />
        <p className="welcome-sub">{program.meta.name}. Everything stays on this phone. No account.</p>
        <section className="card firstcard">
          <span className="eyebrow accent">One question first</span>
          <h2>Which units do you lift in?</h2>
          <div className="grid2">
            <button className="btn2 primary" disabled={busy} onClick={() => void pick("kg")}>Kilograms (kg)</button>
            <button className="btn2 primary" disabled={busy} onClick={() => void pick("lb")}>Pounds (lb)</button>
          </div>
          <span className="fnote">You can set your bar, plates and dumbbells in Settings.</span>
        </section>
        <p className="disclaimer">{program.meta.disclaimer}</p>
      </div>
    </div>
  );
}
