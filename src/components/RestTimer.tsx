import { useCallback, useEffect, useRef, useState } from "react";
import { REST_ADJUST_SEC } from "../rules/rest";

interface TimerState { endAt: number; total: number }
const KEY = "wt.restTimer";

function load(): TimerState | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as TimerState | null;
    return v && typeof v.endAt === "number" ? v : null;
  } catch {
    return null;
  }
}
function save(v: TimerState | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

let audioCtx: AudioContext | null = null;
/** Call from a tap so iOS lets us play the end-of-rest beep later. */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch { /* no audio */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.17);
    }
  } catch { /* ignore */ }
}

export function useRestTimer(sound: boolean) {
  const [timer, setTimer] = useState<TimerState | null>(load);
  const [now, setNow] = useState(Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer]);

  const remaining = timer ? Math.ceil((timer.endAt - now) / 1000) : 0;
  useEffect(() => {
    if (timer && remaining <= 0 && !beeped.current) {
      beeped.current = true;
      if (sound) beep();
    }
  }, [timer, remaining, sound]);

  const start = useCallback((sec: number) => {
    beeped.current = false;
    const v = { endAt: Date.now() + sec * 1000, total: sec };
    save(v);
    setNow(Date.now());
    setTimer(v);
  }, []);
  const adjust = useCallback((delta: number) => {
    setTimer((t) => {
      if (!t) return t;
      const v = { endAt: Math.max(Date.now(), t.endAt + delta * 1000), total: Math.max(0, t.total + delta) };
      if (v.endAt > Date.now()) beeped.current = false;
      save(v);
      return v;
    });
  }, []);
  const stop = useCallback(() => {
    save(null);
    setTimer(null);
  }, []);

  return { active: !!timer, remaining, total: timer?.total ?? 0, start, adjust, stop };
}

const mmss = (s: number) => `${s < 0 ? "+" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;

export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.active) return null;
  const over = timer.remaining <= 0;
  const pct = timer.total > 0 ? Math.min(100, Math.max(0, ((timer.total - Math.max(0, timer.remaining)) / timer.total) * 100)) : 100;
  return (
    <div className={`restbar ${over ? "over" : ""}`} role="timer" aria-live="off" data-testid="rest-timer">
      <div className="rb-main">
        <div className="rb-top">
          <span className="rb-label">{over ? "Rest done" : "Rest"}</span>
          <span className="rb-time">{mmss(over ? -Math.abs(timer.remaining) : timer.remaining)}</span>
          <span className="rb-total">/ {mmss(timer.total)}</span>
        </div>
        <div className="rb-track"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <button className="adj" onClick={() => timer.adjust(-REST_ADJUST_SEC)} aria-label="15 seconds less">−15</button>
      <button className="adj" onClick={() => timer.adjust(REST_ADJUST_SEC)} aria-label="15 seconds more">+15</button>
      <button className="skip" onClick={timer.stop} aria-label="Skip rest">Skip</button>
    </div>
  );
}
