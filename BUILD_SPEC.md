# Workout Tracker: Build Spec (handoff for Claude Code)

## 0. Kickoff prompt

Paste this into Claude Code from the folder that contains these files:

> Read `CLAUDE.md`, `BUILD_SPEC.md` and `program.json`. Build the workout tracking app described in BUILD_SPEC.md, one milestone at a time (Section 10). `program.json` is the single source of truth for the training plan: load it, don't retype exercises into code. `reference/recovery-app.html` is the current read-only version; match its look. After each milestone, run the tests, then tell me how to try it on my iPhone before you start the next one.

---

## 1. What we're building

A **mobile-first workout tracker** for one person: a soccer player rehabbing an old hamstring injury while building upper- and lower-body strength and size, training at home.

The training plan already exists (see `program.json` and `reference/recovery-app.html`). It's a 4-phase, criteria-based hamstring rehab and strength program:

- 4 gym days a week, on an Upper/Lower split: **Upper A (Mon) · Lower A (Tue) · Upper B (Thu) · Lower B (Fri)**
- Weights only: no running or field days. Wed, Sat and Sun are rest.
- Daily hamstring isometric "primer" holds, plus morning and evening mobility routines.

The current app only *displays* the plan. The new app must let him **log every set, follow the rehab rules, and see progress.**

**Priorities, in order:**
1. Hamstring rehab safety and progression: pain rules, morning-after checks, criteria-based phase changes.
2. Fast, one-handed set logging on a phone mid-workout.
3. Progress tracking: strength trends, weekly sets per muscle versus plan, and Nordic progression.
4. Nausea troubleshooting. He used to get nauseous near the end of leg day, and the plan was restructured to fix it, so log whether the fix works.

## 2. Platform and stack

- **PWA** that installs to the iPhone home screen and works **fully offline** after the first load.
- Recommended stack (change it only with a reason): **Vite + React + TypeScript (strict)**, **Dexie** (IndexedDB) for storage, **vite-plugin-pwa** for the manifest and service worker, **Recharts** for charts, **Vitest** for unit tests, and **Playwright** for one end-to-end smoke test at a 390×844 viewport.
- **No backend and no accounts in v1.** All data lives on the device:
  - Call `navigator.storage.persist()` on first launch.
  - **JSON export/import is a must-have** for backups.
  - Add a CSV export of all set logs.
- Deploy as a static site (GitHub Pages, Netlify, Cloudflare Pages or Vercel). HTTPS is needed for install.
- **iOS limits:** no Vibration API and unreliable web push for home-screen apps. Timers and reminders are **in-app only**: an on-screen countdown plus an optional short sound. Don't build push notifications.

## 3. Hard constraints

- **Equipment is fixed:** power rack (safeties and pull-up bar), barbell and plates, one flat bench (propped on plates for incline), adjustable dumbbells, a towel and floor space. The app must **never suggest an exercise or substitution that needs anything else**: no machines, cables, bands, boxes or Swiss ball.
- **Never change training content** (exercises, sets, reps, cues, science notes) without asking the user. Show `program.json` text as written.
- **Phase changes are never automatic.** The app can pre-tick criteria from the logs, but the user confirms every advance or drop-back.
- Keep the disclaimer visible in Settings and the footer: *"Not a substitute for professional assessment."*

## 4. `program.json` (read-only plan data)

Top-level keys: `meta`, `equipment`, `volumeCounting`, `muscles`, `phases`, `sessions`, `mobility`, `nauseaTips`, `redFlags`, `principles`, `sources`.

```ts
type Slot = "UA" | "LA" | "UB" | "LB";
type DaySlot = Slot | "REST";
type MuscleId = "chest"|"back"|"frontDelt"|"sideDelt"|"rearDelt"|"biceps"|"triceps"|"hamstrings"|"quads"|"glutes"|"adductors"|"calves";

interface Phase {
  id: "p1" | "p2" | "p3" | "p4";
  name: string; label: string; weeks: string; color: string;
  goal: string; frequency: string;
  painRule: { display: string; maxDuringPain: number; mustSettleByNextMorning: boolean; onViolation: string };
  primer: { display: string; angles: string[]; schedule: "daily" | "non-leg-days" | "warm-up";
            timesPerDay?: [number, number]; sets: number; holdSec: number; effortPct: [number, number] | null; ifReactive?: string };
  week: { day: "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"; slot: DaySlot; label: string }[];
  criteriaType: "advance-to-next-phase" | "return-to-play";
  criteria: { id: string; text: string; autoCheck: AutoCheck | null }[];
  sessionIds: Record<Slot, string>;        // keys into program.sessions
}

interface Session {
  id: string;                              // "UA", "UB", "p1-LA", "p2-LB" ...
  slot: Slot; title: string; day: string;
  whatChanged: string[];                   // shown collapsed: what changed vs his old plan
  science: { level: "study" | "coaching-call"; source: string; text: string }[];
  exercises: Exercise[];
}

interface Exercise {
  exerciseId: string;                      // stable movement id, shared across sessions/phases (history key)
  variant: string | null;                  // e.g. nordic-curl: "fingertip-assist" | "full-unassisted" | "maintenance"
  name: string;
  category: "compound" | "accessory" | "rehab" | "power";
  equipment: "barbell" | "dumbbell" | "bodyweight";
  prescription: { display: string; sets: number|null; repsMin: number|null; repsMax: number|null;
                  timeSecMin: number|null; timeSecMax: number|null; perSide: boolean };
  rest: { display: string; minSec: number|null; maxSec: number|null; afterSupersetPair?: boolean } | null;
  effort: { display: string; rirMin: number|null; rirMax: number|null } | null;   // RIR = reps in reserve
  tag: string | null;
  muscles: Partial<Record<MuscleId, number>>;  // fractional-set weights: 1 direct, 0.5 indirect
  countsTowardVolume: boolean;             // false for power items
  hamstringLoad: boolean;                  // true => ask for pain 0–10
  progression: "double" | "nordic" | "slider" | "pullup-stage" | "reps" | "range" | "quality";
  superset: "first" | "second" | null;     // "first" pairs with the next exercise
  label: string;                           // "1", "2", "4a", "4b" ...
  isMainLift: boolean;                     // the session's main compound lift
  cue: string;
}

type AutoCheck =
  | { exerciseId: string; variant?: string; minSets: number; minReps?: number; painMax?: number; perSide?: boolean; sideDiffMaxPct?: number; requiresUserConfirm?: string }
  | { morningAfterNotWorseForDays: number };
```

Display strings (`prescription.display`, `rest.display`, `effort.display`) are what the user sees. The parsed numbers drive logic. Where a number is `null` (e.g. "Graded volume" or "Lowering as slow as possible"), show the text and skip number-based logic.

## 5. Screens

Bottom tab bar, max 5 tabs: **Today · Rehab · Mobility · Progress · Settings**. Tap targets ≥ 44 px. Use steppers rather than the keyboard wherever possible. Style should match the reference: cream background, Georgia serif headings, monospace labels, and phase colors from `program.json`.

### 5.1 Today (default screen)
- Current phase badge plus today's slot from `phase.week`. On a gym day, show the session card (title, working-set count, main lift) and a **Start** button. On a REST day, show a rest message.
- **"Up next" logic:** if he missed a day, suggest the next session not yet done this week (Mon–Sun), in order UA → LA → UB → LB. He can always pick any session manually.
- Checklist strip: morning mobility, primer holds (with today's target count from `phase.primer`), evening mobility.
- **Morning-after prompt:** the day after a Lower session, ask "Hamstring vs normal: better / same / worse" and "pain at rest 0–10" before anything else.

### 5.2 Session logger
- Header: title, day, "N working sets", phase color.
- Collapsed sections: **What changed** (`whatChanged`) and **🔬 Science behind this session** (`science`; tag each item "Study" or "Coaching call").
- Warm-up reminder (morning routine plus 1–2 ramp-up sets). In Phases 3–4, include the primer holds as a warm-up checkbox.
- Show exercises in order with their labels. Mark the main lift with a "Main lift" chip. Show supersets as a joined a/b pair.
- **Each exercise card:**
  - Prescription line (sets × reps · rest · effort target), plus the cue behind a "Cues" toggle.
  - **Last time:** e.g. "80 kg × 6, 6, 5, 5". Match history by `exerciseId` and `variant`.
  - **Suggested load** (Section 7.3), with a one-line reason.
  - **Set rows, prefilled from the suggestion:**
    - Weight stepper (barbell/dumbbell), or "added weight" for bodyweight exercises.
    - Reps stepper and ✓ to complete the set. No RIR is logged: progression goes by reps only (the plan's effort text is guidance).
    - Per-side exercises log L and R separately.
    - If `hamstringLoad` is true, a **pain 0–10** slider (defaults to the previous value).
    - Nordic and slider exercises also get a **control** rating: 1 = dropped early, 2 = controlled halfway, 3 = controlled near the floor.
  - Power items get a completion checkbox, reps done, and a quality note.
  - Warm-up sets can be added and are flagged `isWarmup` (excluded from volume).
- **Rest timer:** starts when a set is ticked. Default length is `rest.maxSec` for compound lifts and `rest.minSec` for everything else, adjustable ±15 s. For the first exercise of a superset (rest 0), don't start a timer; start it after the second exercise using the pair rest. The countdown stays visible in a sticky bar while scrolling.
- **Finish flow:**
  - Ask: session RPE 1–10, nausea (none / mild / moderate / vomited), when it hit (start / middle / end / after), hours since the last meal, meal size (fasted / snack / meal / large), and notes.
  - Show the red-flags text from `program.json` if nausea is moderate or worse.
  - Summary: sets completed, fractional sets per muscle for this session, any pain-rule flags, and any new bests (top set or e1RM).
- An unfinished workout survives app close and reload. Offer a "Resume workout" banner.

### 5.3 Rehab
- Phase timeline (p1–p4). Current phase card: goal, frequency, pain rule, primer.
- **Criteria checklist:** each criterion shows its auto-evidence when `autoCheck` matches the logs (e.g. "Met on 12 Dec: Nordic fingertip-assist 3×6"). Manual tick with an optional note. **Advance phase** is enabled only when every criterion is ticked, and asks for confirmation. **Drop back a phase** is always available. Store both in the history.
- Charts: hamstring pain over time (during-set max, at rest, morning-after); Nordic progression (variant, reps, control); primer adherence.

### 5.4 Mobility
- Morning, evening and foam routines from `program.mobility` as checklists. Timed holds get a tap-to-start countdown.
- Hide the foam routine if Settings says he doesn't own a roller.

### 5.5 Progress
- Per-exercise chart of top-set load and **e1RM** (estimated one-rep max) for compound lifts. Label e1RM "estimate".
- **Weekly fractional sets per muscle:** logged versus plan, for the current phase, as bars with the plan target marked.
- Nausea log: list plus a simple table of nausea rate by session slot and by meal timing.
- Bodyweight (optional) as a simple line.

### 5.6 Settings
- Units (kg/lb; ask on first launch), barbell weight, plate inventory (pairs available), adjustable dumbbell min/max/step, owns a foam roller (yes/no), rest-timer sound on/off.
- Current phase (manual override, which also goes into the phase history), export/import JSON, export CSV, reset all data (with confirmation), disclaimer, and the `sources` list.

## 6. Local data model (Dexie tables)

```ts
interface Settings { id: "singleton"; units: "kg"|"lb"; barbellWeight: number; plates: number[]; // plate sizes available in pairs
  dumbbell: { min: number; max: number; step: number }; ownsFoamRoller: boolean; restTimerSound: boolean }
interface PhaseState { id: "singleton"; currentPhaseId: Phase["id"]; phaseStartedAt: string;
  history: { phaseId: Phase["id"]; startedAt: string; endedAt?: string; reason: "advanced"|"dropped-back"|"manual" }[];
  legRegressionUntil?: string }          // ISO date; see 7.4
interface Workout { id: string; date: string; phaseId: Phase["id"]; sessionId: string; slot: Slot;
  startedAt: string; finishedAt?: string; sessionRpe?: number;
  nausea?: "none"|"mild"|"moderate"|"vomited"; nauseaWhen?: "start"|"middle"|"end"|"after";
  hoursSinceMeal?: number; mealSize?: "fasted"|"snack"|"meal"|"large"; notes?: string }
interface SetLog { id: string; workoutId: string; exerciseId: string; variant: string|null; exerciseIndex: number;
  setIndex: number; side?: "L"|"R"; weight?: number; addedWeight?: number; reps?: number; durationSec?: number;
  rir?: number; painDuring?: number; control?: 1|2|3; isWarmup: boolean; completedAt: string }
interface PainCheck { id: string; date: string; kind: "pre-session"|"morning-after"|"ad-hoc"; painAtRest: number; vsNormal?: "better"|"same"|"worse"; note?: string }
interface PrimerLog { id: string; date: string; time: string; setsDone: number; effortPct?: number; pain?: number }
// FieldLog: table kept only so old backups still import. The app no longer logs running or field work.
interface FieldLog { id: string; date: string; phaseId: Phase["id"];
  type: "walk"|"jog"|"walk-jog"|"tempo"|"sprint"|"kicking"|"small-sided"|"team-training"|"match";
  durationMin?: number; reps?: number; distanceM?: number; effortPct?: number; painMax: number; notes?: string }
interface MobilityLog { id: string; date: string; routineId: "morning"|"evening"|"foam"; completedItems: number; total: number }
interface CriterionCheck { id: string; phaseId: Phase["id"]; checkedAt: string; evidence: string; source: "auto"|"manual" }
```

Dates are local `yyyy-mm-dd`, and the week starts Monday. Version the Dexie schema from day one.

## 7. Rules (pure functions in `src/rules/`, each with unit tests)

### 7.1 Schedule
`slotFor(phase, date)` returns `phase.week[weekday].slot`. `nextSession(phase, logs, date)` returns the first slot of UA→LA→UB→LB not completed in the current Mon–Sun week, or `null` if all are done.

### 7.2 Loadable weights
- **Barbell:** the bar plus pairs of plates from the inventory. `roundToLoadable(target)` rounds to the nearest achievable total. The smallest jump is 2 × the smallest plate.
- **Dumbbells:** clamp to min/max and snap to `step`.

### 7.3 Load suggestion (progression)
Look at the most recent completed logs of the same `exerciseId` + `variant`, ignoring warm-ups. For per-side exercises, judge by the weaker side.

- **`double`** (barbell/dumbbell exercises; this is double progression):
  - Every working set hit `repsMax`: suggest the **next loadable step up**. Reps only; RIR is not logged or used.
  - Any set fell below `repsMin`: **keep the load**. If that happens in **2 sessions in a row**, suggest **−10%**, rounded to loadable.
  - Otherwise: keep the load and aim for +1 rep on the earliest sets.
  - Dumbbell already at `max`: suggest +1 rep, up to `repsMax + 3`, then the cue "slow the lowering to 3 s".
- **`nordic`:** progress reps toward `repsMax` with control ≥ 2. Variant changes only come with a phase change (fingertip-assist → full-unassisted → maintenance). Show "use less fingertip help" when all sets hit `repsMax` with control 3.
- **`slider`:** the two-leg version progresses reps. Once two-leg reaches full range with pain ≤ 2/10, show "ready for single-leg lowering" (matches the p1 criterion).
- **`pullup-stage`:** from the latest max-reps test: 0 → Stage 1, 1–5 → Stage 2, 6–10 → Stage 3, >10 → Stage 4 (stage text is in the cue). Prompt a retest every 14 days.
- **`reps` / `range`:** suggest +1 rep (or a little more range) when all sets are complete with pain within the rule.
- **`quality`** (power): no load suggestion. Show the cue.
- **Pain override (beats all of the above):** see 7.4.

### 7.4 Pain rules (from `phase.painRule`)
- An exercise with `hamstringLoad` logs `painDuring` per set.
- **Phases 1–2** (`maxDuringPain: 4`, `mustSettleByNextMorning: true`):
  - If any set's pain is > 4, **or** the morning-after check is "worse": no load increase on any hamstring-load exercise next session.
  - Show `painRule.onViolation`, and suggest less range or about 10% less load.
- **Phase 3** (`maxDuringPain: 0`): any pain > 0 on a hamstring-load exercise shows a banner, "Drop back to Phase 2 loads for 1 week". One tap sets `legRegressionUntil = today + 7 days`. Until then, Lower A and Lower B show the **Phase 2** sessions (`p2-LA`, `p2-LB`).
- **Phase 4** (`maxDuringPain: 0`): hamstring pain during jumps shows "Stop the session and get assessed". No auto-regression.

### 7.5 Phase criteria
- Evaluate each `autoCheck` against the logs.
- When a match is found, pre-fill the evidence text, but **the user still taps to confirm.**
- For `requiresUserConfirm`, show the extra question (e.g. "full range?").
- Weeks in the current phase versus `phase.weeks` are shown **for information only**. Progress is criteria-based, not time-based.

### 7.6 Weekly volume (fractional sets)
- For each completed, non-warm-up set of an exercise with `countsTowardVolume`, add `muscles[m] × 1` to each muscle `m`. Per-side exercises count as one set per side pair.
- Weekly total = sum over Mon–Sun.
- **Session caution:** if one session goes over `volumeCounting.perSessionCautionFractionalSets` (11) for any muscle, show a small note on the summary.

### 7.7 Estimated 1RM
Epley: `w × (1 + reps / 30)` for sets of ≤ 10 reps, on barbell and dumbbell compound lifts only. Always label it "est."

### 7.8 Primer and mobility reminders
In-app only:
- **Phase 1:** 2–3 primer sessions per day.
- **Phase 2:** once a day on non-leg days.
- **Phases 3–4:** a warm-up checkbox inside sessions.

### 7.9 Nausea insights
Group finished workouts by slot and by `hoursSinceMeal` bucket (<1, 1–2, 2–3, >3, fasted). Show the nausea rate per group. Keep it descriptive, with no medical claims.

## 8. Test fixtures (must pass)

### 8.1 Weekly fractional sets in the plan (computed from `program.json`, all four sessions once each)

| Muscle | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| chest | 12 | 12 | 12 | 12 |
| back | 10 | 10 | 10 | 10 |
| frontDelt | 10 | 10 | 10 | 10 |
| sideDelt | 10 | 10 | 10 | 10 |
| rearDelt | 10.5 | 10.5 | 10.5 | 10.5 |
| biceps | 11 | 11 | 11 | 11 |
| triceps | 14 | 14 | 14 | 14 |
| hamstrings | 10 | 11.5 | 11.5 | 11.5 |
| quads | 6 | 8 | 10 | 10 |
| glutes | 9 | 9.5 | 11 | 11 |
| adductors | 3.5 | 7 | 10 | 10 |
| calves | 6 | 6 | 8 | 8 |

### 8.2 Working sets per session (excluding power items) and main lift

| Session | Sets | Main lift |
|---|---|---|
| UA (all phases) | 27 | Barbell Bench Press |
| UB (all phases) | 26 | One-Arm DB Row (Heavy) |
| p1-LA / p1-LB | 14 / 14 | Goblet Squat / DB Romanian Deadlift (pain-free range) |
| p2-LA / p2-LB | 16 / 15 | Barbell Back Squat / Barbell RDL (Progressive Load + Depth) |
| p3-LA / p3-LB | 18 / 19 | Barbell Back Squat (Heavy) / Barbell Stiff-Leg Deadlift |
| p4-LA / p4-LB | 18 / 19 | Barbell Back Squat (Heavy) / Barbell RDL (Heavy) |

### 8.3 Rules

Assume kg, a 20 kg bar, plates `[25, 20, 15, 10, 5, 2.5, 1.25]`, and dumbbells 2.5–32.5 step 2.5.

1. **Bench 4 × 4–6.** Last session 80 × 6, 6, 6, 6 → suggest **82.5**.
2. Same lift, last session 80 × 6, 6, 5, 5 → **keep 80**.
3. Same lift, 80 × 4, 3, 4, 3 in **two consecutive** sessions → suggest **72.5** (−10%, rounded to loadable).
4. **One-arm DB row 4 × 5–8** at 32.5 (the dumbbell max), 8 / 8 / 8 / 8 each side → **keep 32.5**, suggest "+1 rep / slow the lowering to 3 s".
5. **p2 Barbell RDL** with a set at pain 5/10 → no increase next time, and the p2 `onViolation` text is shown.
6. **p3 Nordic full-unassisted** with pain 1/10 → drop-back banner. After one tap, `legRegressionUntil` is set, and the next Tuesday resolves to `p2-LA`.
7. **Schedule:** Phase 4 on a Tuesday → `p4-LA`, whose first exercise is `squat-jump` (`category: "power"`).
8. **`nextSession`:** UA and LA done this week, today is Friday → `UB`.
9. **Superset:** in `UB`, completing `4a` starts no timer; completing `4b` starts a 60 s timer (`rest.minSec` of the pair, since it's not a compound lift).
10. Export → reset → import gives identical tables.

**E2E smoke test (Playwright, 390×844):** start p2 Lower A, log one set of each exercise, finish with nausea "none", reload, and confirm the workout and sets persisted.

## 9. Out of scope for v1
Accounts and cloud sync, social features, AI coaching, push notifications, exercise videos, Apple Health, and editing the plan in-app. Plan edits happen by editing `program.json` (a v2 program editor can come later).

## 10. Milestones

Build in order. Each milestone ends with tests passing and a short "how to try it" note.

1. **M1: Scaffold and plan viewer.** Vite/React/TS app, load `program.json`, Today and read-only session screens for every phase and slot at 390 px. *Done when:* every session renders and the 8.1 and 8.2 fixtures pass.
2. **M2: Logging.** Dexie schema, set logging, steppers, pain slider, rest timer, supersets, finish flow with nausea fields, resume banner. *Done when:* a full session can be logged offline and survives reload, and fixture 9 passes.
3. **M3: Smart suggestions.** Last-time display, load suggestions, loadable rounding, pain overrides. *Done when:* fixtures 1–6 pass.
4. **M4: Rehab.** Morning-after and pre-session pain checks, primer log, criteria auto-evidence, advance and drop-back, leg regression window. *Done when:* fixtures 6–8 pass and a phase can be advanced only with every criterion ticked.
5. **M5: Progress.** e1RM and top-set charts, weekly volume versus plan, nausea insights, pain and Nordic charts.
6. **M6: Ship.** PWA manifest and icons, offline caching, `storage.persist()`, export/import/CSV, Settings, the E2E test, and deploy instructions (GitHub Pages or Netlify), plus how to "Add to Home Screen" on iPhone.

## 11. Assumptions (change these if they're wrong)
- One user and one device. The week starts Monday. Units are chosen on first launch.
- If he trains on different days, the app follows session order (7.1), not the calendar.
- The rack has a pull-up bar. If it doesn't, the Pull-Up Progression cue already gives the inverted-row fallback.
