# UI Redesign Handoff: "Clean" look

A visual reskin of the existing app. It replaces the cream / Georgia / monospace look from `reference/recovery-app.html` with a clean, modern style in the spirit of Strong: white cards on light gray, Inter, one blue action color, and green completed sets.

**This changes visuals and layout only.** It does not change behaviour, data, rules, or training content. Everything in `src/rules/`, the Dexie schema, `program.json` and all tests stay as they are.

## Kickoff prompt for Claude Code

> Read `CLAUDE.md` and `design/HANDOFF.md`, and look at every PNG in `design/screens/` (the matching HTML is in `design/mockups/`). Reskin the app to match, one screen at a time in the order of Section 5. Change styling and markup only: don't change rules, data, storage or `program.json` text. Every value in the mockups is sample data, so keep reading the real values from `program.json` and the database. After each screen, run `npm test`, `npm run build` and `npm run e2e`, fix any failures, then tell me what changed before you start the next one.

## 1. Files in this folder

| File | What it is |
|---|---|
| `screens/*.png` | 390 × 844 screenshots at 2×. **This is the visual target.** |
| `mockups/*.html` | Static HTML for each screen. Open it to inspect exact sizes and colors, but don't copy the inline styles across: turn them into the tokens and classes below. |
| `HANDOFF.md` | This spec. |

The mockups are cut off at 844 px. Real screens scroll, and the bottom of Rehab ("Advance to Phase 3" and "Drop back") is just off the edge in the PNG.

| # | Mockup | Existing file(s) |
|---|---|---|
| 01 | `01-today` | `screens/Today.tsx`, `components/Hero.tsx` |
| 02 | `02-workout` | `screens/Logger.tsx`, `components/RestTimer.tsx`, `components/controls.tsx`, `components/RehabInputs.tsx` |
| 03 | `03-finish` | `screens/FinishFlow.tsx` |
| 04 | `04-morning-check` | morning-after prompt (`components/RehabInputs.tsx` / `Today.tsx`) |
| 05 | `05-rehab` | `screens/Rehab.tsx` |
| 06 | `06-progress` | `screens/Progress.tsx`, `components/charts.tsx`, `screens/RehabCharts.tsx` |
| 07 | `07-mobility` | `screens/Mobility.tsx` |
| 08 | `08-settings` | `screens/Settings.tsx`, `components/Footer.tsx` |
| all | tab bar | `components/TabBar.tsx` |

## 2. Design tokens

Replace the `:root` block in `src/styles.css` with these:

```css
:root {
  /* surfaces */
  --bg: #F4F5F7;          /* app background */
  --card: #FFFFFF;
  --fill: #F4F5F7;        /* inset fills inside cards (stat tiles, suggestion box, secondary buttons) */
  --fill-2: #EEF0F3;      /* inputs, steppers, number badges */
  --line: #EEF0F3;        /* row dividers inside cards */
  --border: #E5E7EB;      /* tab bar top border, progress-bar tracks */
  --border-strong: #D5D8DE; /* outline buttons and chips, off switch */

  /* text */
  --ink: #0B0D12;
  --ink-2: #3F4752;       /* secondary text on white ("previous" column, unselected segment) */
  --muted: #5E6573;       /* labels, meta text: passes 4.5:1 on --bg and --card */

  /* action */
  --accent: #2563EB;      /* primary buttons, active tab, links, chart line */
  --accent-press: #1D4ED8;
  --accent-tint: #E6EDFD; /* selected option fill; "MAIN LIFT" chip bg */
  --accent-ink: #1E40AF;  /* text on --accent-tint */

  /* status */
  --done: #16A34A;        /* check buttons, Finish button, switch on, checkboxes */
  --done-tint: #E7F6EC;   /* completed set rows */
  --done-ink: #146C35;    /* "Met Nov 3" evidence text, positive deltas */
  --warmup: #B45309;      /* "W" set label */
  --pr-tint: #FFF4E5;  --pr-ink: #6B3E06;   /* new-best banner */
  --danger: #B91C1C;      /* Reset all data */
  --dark: #0B0D12;        /* rest-timer bar and stretch timer card */
  --dark-2: #22262E;      /* buttons on the dark bar */
  --dark-track: #2A2F38;
  --dark-muted: #B7BCC6;

  /* phase: set from program.json phase.color at runtime (see below) */
  --phase: #EAB308;
  --phase-tint: #FBF3D5;
  --phase-ink: #6B4F00;

  /* shape */
  --r-sm: 9px;   /* set inputs, check buttons */
  --r-md: 12px;  /* buttons, segmented controls, inset boxes */
  --r-lg: 16px;  /* list groups */
  --r-xl: 18px;  /* cards (20px for the Today hero card) */
  --shadow-hero: 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06);
  --shadow-float: 0 12px 32px rgba(11,13,18,.28);
  --safe-b: env(safe-area-inset-bottom, 0px);
}
```

**Phase colors.** The base color comes from `program.json` (`phase.color`) and is only used for the small dot, the timeline bar, and the progress fill. Text never sits on a phase color directly, because yellow and green fail contrast. Badges use a tint and a dark text color instead. Keep this lookup next to the theme code (it's styling, not training content):

| Phase | `--phase` (from JSON) | `--phase-tint` | `--phase-ink` |
|---|---|---|---|
| p1 Foundation | #3B82F6 | #E6EFFE | #1E3A8A |
| p2 Rebuild | #EAB308 | #FBF3D5 | #6B4F00 |
| p3 Power & Speed | #F97316 | #FFEDDF | #9A3412 |
| p4 Return to Soccer | #10B981 | #DDF6EC | #065F46 |

Primary buttons are always `--accent`, not the phase color. (Today they use `--phase`, so `.btn.primary` and `.chip.main` change.)

## 3. Typography

- **Font: Inter, self-hosted** so it works offline: `npm i @fontsource-variable/inter` and import it in `main.tsx`. Don't load it from Google Fonts (the PWA has to work offline). Fallback: `Inter, system-ui, -apple-system, sans-serif`.
- Turn on tabular figures app-wide (`font-feature-settings: 'tnum'`) so numbers line up in set tables and timers.
- Drop Georgia and the monospace labels (`--mono`, `.mono`, `.label`). Labels become uppercase Inter (see below).

| Role | Size / weight / tracking |
|---|---|
| Screen title ("Today", "Rehab") | 34 / 800 / -0.03em |
| Hero title ("Lower A", morning-check question) | 26–30 / 800 / -0.02em |
| Section heading ("Daily", "Criteria for Phase 3") | 17 / 700 |
| Exercise name in logger | 17 / 700, color `--accent` |
| Body / list-row title | 15 / 500–600 |
| Meta / sublines | 13 / 400, `--muted` |
| Eyebrow / group label ("UP NEXT", "EQUIPMENT", table headers) | 11–13 / 600–700 / +0.04–0.06em, uppercase, `--muted` (`--accent` for "UP NEXT") |
| Big numbers (timer 22, e1RM 36) | 800 |
| Tab label | 11 / 600 |

## 4. Components

Build these once (in `components/controls.tsx` or a new `components/ui.tsx`) and reuse them.

- **Card.** `--card`, radius `--r-xl`, padding 16, no border. The Today hero card adds `--shadow-hero` and radius 20.
- **List group** (Daily checklist, criteria, settings, stretches). A white card with radius `--r-lg` and rows at least 48–56 px tall, padding `0 16px`, and a 1 px `--line` divider between rows. Each row holds a leading control, a title plus a 13 px muted subline, and trailing text, a chevron or a switch.
- **Group label** above a list group: uppercase 12/700, `--muted`, 4 px left inset.
- **Primary button.** 54 px tall, radius 14, `--accent`, white 17/700, full width. Disabled: `--border` fill and `--muted` text (no opacity fade).
- **Secondary button.** 44–50 px tall, `--fill` fill, or white with a 1 px `--border-strong` outline.
- **Segmented control** (Nausea, Strength/Rehab/Nausea, Morning/Evening/Foam, kg/lb). Track: `--border` with 3 px padding and radius 12. Selected segment: white with `0 1px 3px rgba(16,24,40,.12)` and weight 700. Unselected: transparent, `--ink-2`. Height 38–40.
- **Choice chips** (When did it hit?). Pills 36 px tall with a 1 px `--border-strong` outline. Selected: filled `--ink` with white text.
- **Option tiles** (meal size, Better/Same/Worse). Default fill `--fill`. Selected: `--accent-tint` fill, a 1.5–2 px inset `--accent` ring, and `--accent-ink` text.
- **Number row** (RPE 1–10, pain 0–10). Equal-width 44–48 px buttons on white. Selected: `--accent` fill with white text. 10–11 items: use a 10-column grid for RPE and 6 columns (two rows) for pain.
- **Switch.** 51 × 31 iOS style: on is `--done`, off is `--border-strong`. Use `<button role="switch" aria-checked>`.
- **Stepper.** `−` and `+` buttons 44 × 40 on `--fill-2`, value 16/700 centered between them.
- **Chips / tags.** 11/700, radius 6, padding `3px 7px`. Main lift: `--accent-tint` with `--accent-ink`. Rehab or hamstring: `--phase-tint` with `--phase-ink`.
- **Phase badge.** Pill 28–30 px tall with `--phase-tint` background, `--phase-ink` text 13/600–700, and an 8 px `--phase` dot.
- **Tab bar.** 84 px tall plus the safe area, white at 96% opacity, 1 px `--border` top border, 5 equal columns. 24 px stroke icons (stroke 2, round caps) over an 11/600 label. Active is `--accent`, inactive `--muted`. Icons: calendar (Today), pulse line (Rehab), stick figure (Mobility), bar chart (Progress), sliders (Settings). The inline SVG paths are in any mockup's `<nav>`.

## 5. Screens (build in this order)

### 5.1 Logger (`02-workout`): the most important screen
- **Full screen, no tab bar.** Top bar: a 44 × 44 white "minimize" button (chevron down, returns to Today and keeps the workout resumable), centered elapsed time (17/700) with "N of M sets" under it, and a green **Finish** pill on the right. Below the top bar, a 4 px progress bar (`--done` on `--border`) showing completed working sets out of the total.
- Session title 26/800, with "subtitle · Phase N · Day" under it.
- **Exercise card:** label number and name in `--accent` (for example "2 · Barbell Back Squat"), the prescription line in muted 13 px (sets × reps · rest · effort), and a chip on the right (MAIN LIFT, or REHAB when `hamstringLoad`). The cue toggle can sit under the prescription line as a small "Cues" text button.
- **Suggested load:** an inset `--fill` box with an up-arrow icon, **bold suggestion** and the one-line reason.
- **Set table:** a grid with an uppercase 11/700 header row. Columns depend on the exercise:
  - Weighted: `SET · PREVIOUS · KG · REPS · RIR · ✓` → `34px 1fr 64px 48px 44px 40px`
  - Nordic / slider (`hamstringLoad` with control rating): `SET · PREVIOUS · REPS · PAIN · CTRL · ✓` → `34px 1fr 52px 52px 56px 40px`
  - Other hamstring-load exercises: add a PAIN column after RIR, or show the pain slider below the table. Keep the spec's 0–10 pain input and its default to the previous value.
  - Per-side exercises: one row per side, with the SET cell reading "1L" / "1R".
- **Row states.** Pending rows are 44 px tall, with values in 36 px `--fill-2` inputs (tap opens the existing stepper or RIR chips) and a grey check button. Completed rows get a `--done-tint` background that bleeds 6 px past the table edges, the values turn to plain text, and the check button turns solid `--done` with a white tick. Warm-up rows show "W" in `--warmup` (still excluded from volume).
- "+ Add set" is a full-width 44 px `--fill` button.
- **Rest timer:** a floating dark bar (`--dark`, radius 20, `--shadow-float`) 12 px from the sides and 24 px plus the safe area from the bottom. It shows a "REST" label, the remaining time 22/800, "/ total", a thin progress line, then `−15`, `+15` (on `--dark-2`) and a white **Skip** button. Pad the scroll area at the bottom so the last card can scroll above the bar. All the existing timer logic (superset pairing, defaults) stays as it is.
- Collapsed "What changed" and "Science" sections and the warm-up reminder: put them in a list group between the title and the first exercise, each row expanding when tapped.

### 5.2 Today (`01-today`)
- An uppercase eyebrow ("TUESDAY · WEEK 6"), the 34 px "Today" title, and the phase badge on the right.
- **Week strip:** 7 tiles. Done: a green circle with a tick. Today: the whole tile `--accent` with white text and the date number in a white circle. Upcoming gym day: a 1.5 px outline circle. Field day: a dashed circle. Rest: a filled `--fill-2` circle. Each tile shows its slot code (UA/LA/UB/LB) or "Field" / "Rest".
- **Hero card ("Up next"):** the eyebrow, session title, "subtitle · N exercises · N sets" and an estimated-time pill on the right. If the estimate isn't something the app can compute, drop the pill rather than invent a number. Below that, a divider and the first 3 exercises (number badge, name, MAIN chip, prescription), then the Start button. The field-day and rest-day versions use the same card with that day's text and the "Log field session" button.
- **Resume banner** (an unfinished workout): the same hero card with "IN PROGRESS", sets done out of total, and a "Resume workout" button.
- **Daily list group:** morning mobility, primer holds (target from `phase.primer`, with an "0 / 1"-style counter), evening mobility.

### 5.3 Finish flow (`03-finish`)
A full-screen page with a "Back" text button. A summary card holds three stat tiles (sets, peak pain, new bests) and a new-best banner (`--pr-tint` with a trophy icon). Then come the RPE number row, the nausea segmented control, the "When did it hit?" chips, a list group with the hours-since-meal stepper and meal-size tiles, notes, and a sticky **Save workout** button. The red-flags text (for moderate nausea or worse) appears as a card with a `#FEF2F2` fill and `--danger` heading under the nausea control. The fractional-sets-per-muscle summary goes after save (or below notes) as a list group.

### 5.4 Morning-after check (`04-morning-check`)
Full screen, shown before anything else on the morning after a Lower session. A 52 px icon tile, the eyebrow, a 30/800 question and a muted explainer. Then Better / Same / Worse tiles (88 px tall, with a green up arrow, a dash and an orange down arrow), the pain-at-rest 0–10 number row with "No pain / Worst imaginable" end labels, and the current phase's pain rule in a `--phase-tint` box. At the bottom, **Save check** and a "Remind me later" text button.

### 5.5 Rehab (`05-rehab`)
- **Phase timeline:** 4 equal 6 px bars. Past phases are solid in their color, the current one shows progress in its color over its tint, and future ones are `--border`. Labels go under the bars (current one bold `--ink`).
- **Current phase card:** the phase badge, "Week X of …", the goal text, and fact chips (pain rule summary, primer summary). The full pain rule, primer and field text can sit in expandable rows under it.
- **Criteria list group:** checkbox, criterion text 15/600, and an evidence line. Met: `--done-ink` 600 ("Met Nov 3 · 3 × 6, control 3"). Not met: muted ("Best so far · …" or "Tick manually when you've done it").
- **Actions:** "Advance to Phase N" uses the primary style, disabled until every criterion is ticked, and keeps its confirm dialog. "Drop back" is an outline button beside it. Charts and the field log go below in cards styled like Progress.

### 5.6 Progress (`06-progress`)
A segmented control (Strength / Rehab / Nausea) splits the existing sections. **Strength:** an exercise picker (a `--fill` button with a chevron), the big e1RM number with "(estimate)" and a green delta, then a line chart. Chart style: a 2.5 px `--accent` line, 3 px dots with the last point as a ring, a light area fill (`--accent` at 8% opacity), faint `--line` gridlines and muted 10 px axis labels. Restyle Recharts to match. **Weekly sets:** rows with "Muscle" and "**done** / plan" above an 8 px bar (`--accent` on `--line`). If you keep the plan-target tick mark from the spec, draw it as a 2 px `--ink` line at the target. Rehab and Nausea tabs reuse the same cards and charts.

### 5.7 Mobility (`07-mobility`)
A segmented control for Morning / Evening / Foam (hide Foam when the user has no roller; a done routine gets a green tick in its segment). A routine heading with subtitle and time, and a "2 / 7" counter. The **active timer card** is dark: a 76 px progress ring (`--accent` on `--dark-track`) with the time inside, "HOLDING · LEFT SIDE", the stretch name and its cue, and a pause button. The list group rows hold a checkbox, the name and prescription, and a play button for timed holds. Done rows are struck through and muted. The active row gets a `#F5F8FF` background and an `--accent-ink` status line.

### 5.8 Settings (`08-settings`)
Three list groups with uppercase labels:
- **Equipment:** units (kg/lb segmented control), barbell, plates, dumbbells (each row opens the existing editor), and a foam roller switch.
- **Training:** current phase (with the phase dot) and the rest timer sound switch.
- **Your data:** Export JSON (with "Last: …" if it's tracked), Import, Export CSV, and Reset (`--danger`, keep the confirm).

Below them: a sources link and the disclaimer line in muted 13 px. The disclaimer must stay visible.

## 6. Rules to keep

- **Tap targets ≥ 44 px.** In the set table, the 36 px inputs and check buttons sit inside a 44 px row, so make the whole cell the hit area.
- **Use real controls:** `<button>`, `<input>`, `<label>`. Give icon-only buttons an `aria-label`, and mark selected options with `aria-pressed`, `aria-current` or `aria-checked`.
- **No emoji in the UI.** That includes the spec's 🔬 on "Science"; use a stroke icon instead.
- **Contrast:** body text on white and `--bg` needs ≥ 4.5:1. The tokens above already pass, so don't lighten `--muted`.
- **No changes to `program.json` text,** rules, or phase logic. Displayed text still comes from the JSON.
- **Safe areas:** pad the top for `env(safe-area-inset-top)` and the bottom for the tab bar and rest bar with `--safe-b`.
- **Dark mode** is out of scope for now. Keep every color in tokens so it can be added later.
