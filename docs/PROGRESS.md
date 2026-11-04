# Progress Log

Newest entry first. Every agent session adds an entry here (see `AGENTS.md` §5).

Template:

```
## YYYY-MM-DD — short title
**Done:** ...
**Not finished / known issues:** ...
**Next:** ...
```

---

## 2026-11-04 — Milestone 3: leaves, sepals & buds, architecture

**Done:**
- Leaves: heart / oval / slender / serrated, count, size, alternate / opposite / whorled, angle, color.
- Sepals & buds: sepal count + shape (pointed/round/narrow), bud shape (round/oval/pointed), bud count, color.
- Architecture: Single, Branched (uses Stem → Branching 1–6), Spike, Cluster (Flowers 3–30 for the last two).
- Refactor: shared blade builder (`blade.ts`); `layout.ts` + `assemble.ts` pipeline; instanced rendering in
  `Plant.tsx`; stamped flower-center parts. Default leaf size 16 cm.
- Tested in the browser: every mode × every shape/type option, max and zero values, Reset. No console errors.
  `npm run build` passes.

**Not finished / known issues:**
- Branches don't fork again, and leaves only grow on the main stem.
- Leaves start at the stem's center line (their base is hidden inside the stem); fine visually, no petiole.
- Frame rate untested on a real device (preview browser is throttled). Worth checking on a phone.
- GitHub Pages source still needs to be set to GitHub Actions by the user. "CTC" meaning still unknown.

**Next:** Milestone 4: drawing pad → outline → `w(v)` profile for petals, leaves and sepals.

## 2026-11-04 — Milestone 2: stem, petals, center with sliders

**Done:**
- Settings model `src/plant/spec.ts` + zustand store `src/state/store.ts`.
- Builders: `stem.ts` (straight/curved/spiral, tapered tube, lean), `petal.ts` (round/pointed/wavy, curvature,
  spread, layers, color fade), `center.ts` (disc/column/stamens, sunflower-spiral density).
- `src/scene/Plant.tsx` puts it together; flower head follows the stem's tip direction. Placeholder plant removed.
- Panel: working controls for Stem, Petals, Center + Reset. Camera can zoom to 25 cm; extra fill light.
- Tested in the browser: every shape/type, sliders at min/max, Reset. No console errors. `npm run build` passes.

**Not finished / known issues:**
- Leaves, Sepals & Buds, Architecture, Branching: not started (milestone 3).
- GitHub Pages: check the user switched Pages source to GitHub Actions (the first deploy failed for that reason).
- "CTC" meaning still unknown.

**Next:** Milestone 3: leaves (shapes, arrangement), sepals & buds, and the 4 architecture modes incl. branching.

## 2026-11-04 — Milestone 1: app skeleton

**Done:**
- Replaced the static placeholder with a Vite + React + TypeScript + React Three Fiber app.
- Layout: slider panel on the left with the 6 part sections (empty for now), 3D preview on the right
  (orbit camera, lights, ground, soft shadow). Stacks vertically under 720px wide.
- `src/scene/PlaceholderPlant.tsx`: a simple stem + 6 petals + center, only to prove 3D works.
- Added `.github/workflows/deploy.yml` (GitHub Pages via Actions).
- Checked in the browser: renders, no console errors, desktop and narrow layouts both fine. `npm run build` passes.

**Not finished / known issues:**
- Pages source must be set to **GitHub Actions** in repo Settings → Pages, or the deploy job fails.
- Panel sections have no controls yet.
- "CTC" meaning still unknown.

**Next:** Milestone 2 in `docs/ARCHITECTURE.md`: zustand store + real procedural stem, petals and center driven by sliders.
Delete `PlaceholderPlant.tsx` when done.

## 2026-11-04 — Pushed to GitHub

**Done:** The user created `https://github.com/MiniRunRun/CTC_MiniGame` (GitHub username confirmed: `MiniRunRun`)
and cloned it. Local history was merged in and pushed. The working copy is the clone.
**Not finished / known issues:** GitHub Pages must be turned on (Settings → Pages → `main`, `/ (root)`).
Tech stack approval and the meaning of "CTC" are still open.
**Next:** Milestone 1 in `ARCHITECTURE.md` once the user approves.

## 2026-11-04 — Dropped the node editor

**Done:** User clarified: no node editor in the game; nodes were only for picturing the plan. Updated
`GAME_DESIGN.md`, `ARCHITECTURE.md`, `DECISIONS.md` and `AGENTS.md` to a slider panel + 3D preview.
**Not finished / known issues:** Same as the entry below (tech OK pending, repo not on GitHub, "CTC" unknown).
**Next:** Milestone 1 in `ARCHITECTURE.md` once the user approves.

## 2026-11-04 — Flower builder researched and planned

**Done:**
- Wrote the user's flower builder requirements into `docs/GAME_DESIGN.md` (parts, sliders, 4 architecture types, free drawing, Blender-node UI).
- Researched feasibility and wrote the technical plan in `docs/ARCHITECTURE.md`. Result: everything is doable in the browser.
- Added the tech choice and drawing approach to `docs/DECISIONS.md` (marked *proposed*).

**Not finished / known issues:**
- Tech choice waits for the user's OK.
- "CTC" meaning still unknown.

**Next:**
- After approval, start milestone 1 in `docs/ARCHITECTURE.md` (Vite + React + R3F skeleton, deploy to Pages).

## 2026-11-04 — Repository created

**Done:**
- Created the repo skeleton: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` (progress, decisions, game design), a placeholder `index.html`, `src/main.js`, `src/style.css`, `assets/`.
- Set up git locally (not pushed yet; GitHub repo not created).

**Not finished / known issues:**
- No game exists yet. `index.html` is a placeholder page.
- The game idea is not defined. `docs/GAME_DESIGN.md` is mostly empty.
- "CTC" meaning is not yet recorded — ask the user and write it in `docs/GAME_DESIGN.md`.
- GitHub Pages may need to be turned on: repo Settings → Pages → Source: `main` branch, `/ (root)`.

**Next:**
- Ask the user what the game should be, fill in `docs/GAME_DESIGN.md`, then build the first playable version.
