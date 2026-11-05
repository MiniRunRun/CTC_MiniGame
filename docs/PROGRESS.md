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

## 2026-11-05 — Four categories per part: Form / Material / Animation / Growing State

**Done:**
- User: put the glitch motion in a separate **Animation** category (not only glitch); keep the flat
  pattern/texture in Material; every part gets **Form, Material, Animation, Growing State**.
- Panel: parts 01–05 now use `PartSection` with collapsible `Category` blocks (Form open by default).
  Growing State is a placeholder ("Coming later 之后再设计").
- Materials are now still images: removed Dream `speed`, Glitch `tear` and `speed`.
- New `spec.animations[part]` (`AnimationSpec`) + `src/scene/animation.ts`: Sway, Pulse, Glitch tearing (+ band
  height), Pattern Motion (Dream/Glitch only), Speed. Works on every material via onBeforeCompile. Stem sway moves
  the whole plant so leaves/flowers stay attached.
- Tested: categories render; petal sway + glitch + pattern on Glitch material; stem sway with leaves/flower
  following; leaf pulse; glitch tearing on Natural petals and Pearl leaves. No new console errors.

**Not finished / known issues:** Shadows don't follow animation. Pulse on parts scales around their attach
point. Dream now moves only if Pattern Motion > 0 (was moving by default before). Growing State not designed yet.

**Next:** talk with the user about Growing State (生长状态).

---

## 2026-11-04 — Glitch material (故障材质) from the user's glitch image

**Done:**
- User asked to read the image's metadata and turn its parts into a material. The file (2000×1125 WebP) only has
  an sRGB ICC profile (Google 2016) — no EXIF/XMP, nothing about how it was made. So the parts were measured from
  the pixels instead: greys #3e3e3e / #a4a4a4 / #d8d8d8 / #f0f0f0 (≈ 90% of the image), neon green #07fe15 /
  #00aa04 and cyan #31ceb4 / #6eb8af accents, vertical stripes with a 4–7 px period, horizontal torn bands,
  fine grain (±3 levels).
- New 4th material type **Glitch 故障** on every part (`src/scene/glitchMaterial.ts`, `GlitchSpec` in spec.ts,
  `GlitchControls` in Panel.tsx). Defaults use the measured colors.
- Tested: all five parts on Glitch, grey background + hidden ground looks like the reference, Reset → Natural,
  no console errors.

**Not finished / known issues:** Stripe/band sizes are in screen pixels (they don't scale with zoom, on purpose).
Tearing moves vertices, so a triangle that spans two bands stretches (reads as smear). No halo for Glitch.

**Next:** maybe a screen-effect version of Glitch in 08 Effect (whole-frame tearing incl. background).

---

## 2026-11-04 — Material choice in every part (每个部件的材质)

**Done:**
- User correction: they want a **Material** option on *each component*, with Pearl as one of the choices — not
  one global look. The global "07 Look" section is gone.
- Every part section (01 Stem, 02 Leaves, 03 Petals, 04 Center, 05 Sepals & Buds) now ends with a
  **Material 材质** block: Natural / Pearl 珍珠 / Dream 梦境, each with its own full settings per part.
  Stem's material also applies to receptacles; Sepals' to buds. "Length" is only offered on blade parts.
  Halo is offered on everything except the stem (a single tube can't be scaled around a center sensibly).
- New **07 Scene 场景**: background color and ground show/hide (previously Pearl hid the ground automatically).
- Code: `spec.materials` (+ `MaterialSpec`, `PearlSpec`, `DreamSpec`, `SceneSpec`), new `src/scene/partMaterial.ts`,
  `Plant.tsx` `<Part>` component, `Panel.tsx` `MaterialControls` / `PearlControls` / `DreamControls` / `SceneControls`.
- Tested: different materials on every part at once, per-part pearl settings stay independent, fused + dream
  halo, scene hide ground, Reset → all Natural. No console errors.

**Not finished / known issues:** same as the two entries below (fused limits, edge-fade sorting).

**Next:** user feedback; maybe material presets / copy a material to all parts.

## 2026-11-04 — Dream material (梦境材质), the per-part version of Dream

**Done:**
- User asked whether the Dream look can live inside a single petal, and wanted **both** options.
  Explained: a material can only color the pixels its part covers, so blur across parts / spill onto the
  background needs the screen effect; a halo shell fakes the spill.
- 07 Look → **Dream 梦境材质** (`src/scene/dreamMaterial.ts`, a ShaderMaterial that works with InstancedMesh):
  Apply To (petals only / all parts), Color By (facing / length / noise), 5 ramp colors, Repeat, Fringe,
  Flow, Speed (animated), Edge Fade, Halo size / color / opacity. Halo = a second enlarged, see-through copy
  of each petal (or fused flower) that fades out at its edge.
- 08 Effect → Dream (screen) is unchanged; both can be combined.
- Bug fixed: dream sliders changed quickly in a row undid each other (they copied a stale settings object);
  `set` now reads the latest store state.
- Tested: natural / abstract / fused petals, all inputs, all parts, edge fade, halo on/off. No console errors
  (only three.js' own deprecation warnings about Clock and PCFSoftShadowMap, which were there before).

**Not finished / known issues:**
- Buds, stem and center have no length axis, so "Length" falls back to "Facing" on them.
- Edge Fade makes parts see-through without sorting; overlapping faded petals can look slightly off.
- Other panel sections still copy their part's settings per render; only an issue for scripted rapid changes.

**Next:** user feedback; ramp presets shared by both Dream versions.

## 2026-11-04 — Dream screen effect (梦境)

**Done:**
- User shared a reference: melted, blurred shapes in lavender-grey with pink halos fading to white, olive bands,
  and rainbow fringes. This is a post-process, not a material.
- New **08 Effect 后期效果** section: None / **Dream 梦境**. `src/scene/Effects.tsx` uses three.js'
  EffectComposer: render → 3 rounds of separable Gaussian blur → gradient map (brightness → 5-color ramp,
  optional ping-pong Repeat for contour rings) with color fringes and grain. Sliders: Blur, Contrast, Offset,
  Repeat, Fringe, Grain, plus 5 ramp colors and a ramp preview strip.
- Works with both Natural and Pearl looks. Tested: on/off, extreme values, no console errors.

**Not finished / known issues:**
- Ramp stops are evenly spaced (no per-stop position sliders yet).
- The effect reads only brightness, so very different colors with the same brightness get the same ramp color.

**Next:** user feedback; maybe ramp presets, stop positions, depth-based blur.

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
