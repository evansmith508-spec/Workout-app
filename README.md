# Workout Tracker

A mobile-first, offline workout tracker for one person: hamstring rehab (4 criteria-based phases) plus upper/lower strength training at home. Built from `BUILD_SPEC.md`; the training plan lives in `program.json` and is never hand-copied into code.

All data stays on the phone (IndexedDB). There is no account and no server. **Export a backup regularly** (Settings → Export backup).

## Run it locally

Node 24 lives in `~/.local/node` on this Mac. Put it on your PATH once:

```bash
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

```bash
npm install
npm run dev        # http://localhost:5173, and on your Wi-Fi at http://<your-mac-ip>:5173
npm test           # Vitest: all rules + BUILD_SPEC fixtures
npm run e2e        # Playwright smoke test at 390×844 (builds first)
npm run build      # production build in dist/
```

The dev server is fine for trying screens, but offline mode and "Add to Home Screen" need the deployed HTTPS site.

## Deploy (pick one)

### GitHub Pages (workflow included)
1. Create a GitHub repo and push this folder to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs the tests, builds, and publishes to `https://<user>.github.io/<repo>/`.

### Netlify
1. In Netlify: **Add new site → Import an existing project** and pick the repo (or drag the `dist/` folder onto app.netlify.com/drop).
2. `netlify.toml` already sets the build command (`npm run build`) and publish folder (`dist`).

Any static host with HTTPS works (Cloudflare Pages, Vercel): build command `npm run build`, output `dist`.

## Install on iPhone
1. Open the deployed URL in **Safari** (not Chrome; iOS only installs from Safari).
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
3. Open it once from the Home Screen while online. After that it works fully offline.
4. Updates: when you deploy a new version, open the app while online; it updates itself on the next launch.

iOS limits: no vibration and no reliable push for home-screen apps, so timers and reminders are in-app only (countdown + optional beep).

## Backups
- **Export backup (JSON)**: everything (settings, phase history, workouts, sets, pain checks, primer, mobility, criteria, bodyweight).
- **Import backup**: replaces all data on the device with the file's contents.
- **Export set logs (CSV)**: one row per logged set, for spreadsheets.

## Changing the plan
Edit `program.json` (exercises, sets, cues, criteria) and redeploy. Tests in `src/rules/volume.test.ts` check the weekly-volume and per-session fixtures, so update them if you intentionally change the plan.

## Code map
- `src/rules/` – pure business rules with tests (schedule, loadable weights, progression, pain rules, criteria, volume, e1RM, nausea insights).
- `src/db/` – Dexie schema (versioned), storage helpers, backup/CSV.
- `src/screens/` – Today, Session logger, Finish flow, Rehab, Mobility, Progress, Settings.
- `scripts/make_icons.py` – regenerates the app icons (`npm run icons`).

*Not a substitute for professional assessment.*
