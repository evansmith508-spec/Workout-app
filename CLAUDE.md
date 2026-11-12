# CLAUDE.md

Weights-only workout tracker PWA for one user: hamstring rehab plus strength training at home. No running or field work.

- **Spec:** `BUILD_SPEC.md`. Follow its milestones in order, and stop after each one to report.
- **Plan data:** `program.json` is the single source of truth. Load it at runtime or import it; never hand-copy exercises, sets, cues or science text into components.
- **Visual reference:** `design/HANDOFF.md` with the screenshots in `design/screens/` (clean look: light gray background, white cards, Inter, blue accent, phase colors as badges). This replaces the cream/Georgia look of `reference/recovery-app.html`, which is kept only as the old read-only app.
- **Don'ts:**
  - Don't suggest or add exercises that need equipment beyond: power rack with safeties and pull-up bar, barbell and plates, one flat bench, adjustable dumbbells, towel.
  - Don't change training content or rehab rules without asking the user.
  - Don't advance or regress phases automatically. Pre-fill the evidence, but the user confirms.
- **Code:**
  - TypeScript strict.
  - Put all business rules as pure functions in `src/rules/`, with Vitest tests that use the fixtures in BUILD_SPEC.md Section 8.
  - Mobile-first at 390 px wide, with tap targets of at least 44 px.
  - Must work offline.
- **Before saying a milestone is done:** run `npm test` and `npm run build`, and fix every failure.
