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

## 2026-11-04 — Pearl look + fused (blobby) abstract petals

**Done:**
- User wanted a *stylized, not realistic* look matching a reference image: pearl-like balls (lavender-pink
  highlight, olive-yellow glow/rim, off-white body) joined to a center by smooth, melted stalks, on black.
- **07 Look 风格** section: Natural 自然光照 / **Pearl 珍珠风格化**. Pearl paints the light into a matcap
  (`src/scene/matcap.ts`) with Highlight / Glow / Body / Shadow colors, Highlight Size, Softness, Rim,
  Light Angle, Part Colors on/off and Background. Ground and shadows are hidden in Pearl. A 72 px preview ball
  shows the current matcap.
- Petals → Abstract → **Join 连接: Separate / Fused 融合**. Fused builds one melted mesh per flower
  (`src/plant/fused.ts`): center ball + one ellipsoid per petal + tapered stalks, smooth-min blended, meshed
  with three.js MarchingCubes, then instanced on every flower head. Sliders: Stalk Length, Stalk Width,
  Blend 融合度, Detail 精度 (32–96).
- Bug fixed on the way: `Instances` now re-applies matrices when the material changes (the mesh is rebuilt).
- Tested: 7 fused petals + Pearl closely matches the reference image (top view). Toggled every new option,
  spike architecture, part colors on/off, natural ↔ pearl. No console errors after a fresh load.
  Rebuild times in the (throttled) preview browser: detail 64 ≈ 50–130 ms, detail 96 with 72 petals ≈ 400 ms.

**Not finished / known issues:**
- Fused uses rounded ellipsoids only (the Primitive choice is hidden) and ignores petal curvature.
- Fused flowers on a spike all use the fully open shape (no younger, closed flowers).
- High Detail + many petals lags while dragging sliders; a low-res-while-dragging mode could fix that.
- Pearl light follows the camera (that's how matcaps work); a world-fixed light would need a custom shader.
- No bloom/glow post-processing yet.

**Next:** user feedback on the pearl look; maybe bloom, more matcap presets, fused leaves/center.

## 2026-11-04 — Abstract petals (抽象几何)

**Done:**
- User asked for an "abstract" option that replaces parts with geometric shapes, like their Blender Geometry
  Nodes video (Curve Circle → Instance on Points of a squashed Ico Sphere → Rotate 57.5° → 3 stacked copies with
  separate materials). Started with petals, as asked.
- Petals → **Style 风格: Natural 自然 / Abstract 抽象几何**. Abstract replaces each petal with a primitive:
  Sphere 球 / Gem 多面体 / Cube 方块 / Cone 圆锥 / Torus 圆环 / Capsule 胶囊, with Width and Thickness sliders.
  Number, Layers, Size, Curvature and Spread still apply. Layers become identical stacked copies with a
  **Layer Gap 层间距** (negative = stack downward). Two colors with a **Gradient 渐变** (Top ↔ Under / Base → Tip)
  and **Bands 色带** (repeat count, for stripes).
- Code: `src/plant/abstract.ts` (new), `petal.ts` (routes the abstract style), `spec.ts` (new fields),
  `Panel.tsx`, `styles.css` (6-option grid).
- Tested in the browser: all 6 primitives, both gradients, bands, gap ±, curvature, switching styles. No console errors.

**Not finished / known issues:**
- Only petals have the abstract style. Leaves, sepals, buds and the center could get the same option next.
- The video's per-layer materials (different colors per copy) aren't there yet; every layer uses the same two colors.

**Next:** ask the user whether to extend Abstract to other parts, add per-layer colors, or start the Material section
(MeshPhysicalMaterial presets + procedural textures; plan given to the user on 2026-11-04).

## 2026-11-04 — Milestone 4: free drawing

**Done:**
- `src/plant/profile.ts`: `strokesToProfile` (drawing → 65-sample half-width profile), `profileAt`, `sampleProfile`.
- `src/ui/DrawPad.tsx`: canvas pad (mouse, pen, touch), silhouette preview, Clear.
- "Drawn 手绘 ✎" option for petal shape, leaf shape, sepal shape and bud shape, each with its own starter drawing.
- Tested: a drawn circle converts within 0.6% of the true shape; one-sided and full drawings match; tiny
  scribbles are ignored; drawing on each pad updates the 3D (lobed leaves, needle sepals, onion bud). No console errors.

**Not finished / known issues:**
- Notches/holes and asymmetric shapes can't be drawn (see DECISIONS.md).
- No undo beyond Clear; drawings are lost on page reload (save/load is milestone 6).
- Testing tip: in the dev page, `import('/src/state/store.ts')` from the console can give a *different* copy of
  the store than the app uses (HMR), so read state from the UI instead.
- GitHub Pages source still needs to be set to GitHub Actions by the user. "CTC" meaning still unknown.

**Next:** Milestone 5 (panel polish: presets, randomize) and 6 (save/load flower as JSON).

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
