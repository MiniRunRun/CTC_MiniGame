# Decisions

Why the project is built the way it is. Newest first. Add one entry per real choice.

Template:

```
## YYYY-MM-DD — decision
**Choice:** what was picked
**Why:** reason
**Alternatives considered:** ...
```

---

## 2026-11-05 — Attached parts follow the stem via a per-copy anchor attribute

**Choice:** `assemble()` records each copy's attach point on the stem; the shader re-runs the stem's motion at
that point (sway offset + the stem's glitch band test) and moves the whole copy rigidly.
**Why:** Glitch tearing is per screen band, so a leaf must jump exactly when the stem's band at its attach point
jumps. Evaluating the stem's own formula at the anchor keeps them in sync with no CPU work per frame.
**Alternatives considered:** a scene-graph hierarchy with per-frame CPU matrices (can't reproduce screen-band
tearing, and costs per frame); using each vertex's own band (tears leaves apart instead of carrying them).

---

## 2026-11-05 — One motion per part, plus a whole-plant glitch

**Choice:** Replaced the mixable amount sliders with one `type` per part (+ amount, speed). Per-part glitch bands
are seeded per part; a separate `spec.plantAnimation.glitch` tears all parts with shared bands. Stem sway still
carries the other parts (otherwise they float off).
**Why:** User asked for a single effect per component and liked the glitch moving only the stem, while keeping
the glitch that moves everything together.
**Alternatives considered:** keeping mixable sliders (user rejected); a screen-space glitch post effect for
"whole plant" (would also tear the background — not what was shown).

---

## 2026-11-05 — Animation is its own per-part category, layered on any material

**Choice:** Each part has `Form / Material / Animation / Growing State`. Animation (`spec.animations[part]`) is a
set of mixable 0–1 amounts (sway, pulse, glitch, pattern) + speed, injected into whatever material the part uses
via `onBeforeCompile`. Materials became still images (their time input is driven by Animation → Pattern Motion).
Stem sway is applied to all parts by plant-space height.
**Why:** User asked to separate motion from material and to offer more than glitch. Injecting into three's shared
chunks means one animation system works for natural, pearl, dream and glitch. Amount sliders (instead of one
choice) let motions combine. Without the plant-wide stem sway, a swaying stem leaves its leaves floating.
**Alternatives considered:** one animation choice per part (simpler, but can't mix); animating instance
matrices on the CPU (costs per frame, can't do screen-space tearing).

---

## 2026-11-04 — Glitch is a per-part material, with screen-space patterns

**Choice:** Glitch is a 4th `MaterialType` (not a screen effect). Stripes, bands and blocks are computed from
gl_FragCoord (screen pixels); tearing shifts vertices per screen band in the vertex shader.
**Why:** The user asked for the image's components "as part of our material". Screen-space patterns match the
reference (a flat video frame) better than patterns stuck to the surface; moving vertices is the only way a
material can make the part itself tear, since it can't move pixels it doesn't own.
**Alternatives considered:** a post-processing Glitch effect (tears the whole frame incl. background — possible
later as an 08 Effect option); surface-space stripes (look like a striped texture, not a glitch).

---

## 2026-11-04 — Materials are chosen per part and stored apart from shapes

**Choice:** `spec.materials[part] = { type: natural|pearl|dream, pearl, dream }` for stem, leaves, petals, center,
sepals. Replaces the global `look` (which had pearl for everything and dream "petals only / all").
Stored in its own top-level group, not inside `spec.petals` etc.
**Why:** the user wants a material choice on every component. Keeping materials out of the part specs means
changing a material doesn't trigger geometry/layout rebuilds (those memo on the part specs).
**Alternatives considered:** a `material` field inside each part spec (simpler to read, but every color tweak
would rebuild the plant's geometry).

## 2026-11-04 — Two Dream versions: per-part shader and screen effect

**Choice:** Keep the screen effect (08) and add a Dream *material* (07 Look) as a custom ShaderMaterial using
three's shader chunks (so instancing works). Halo outside the outline = an enlarged transparent shell copy.
**Why:** user wanted both. A material can't paint outside its own pixels or blur across parts; the screen
effect can't give each part its own ramp. Together they cover both.
**Alternatives considered:** `onBeforeCompile` on MeshStandardMaterial (lighting not needed for this look);
three-custom-shader-material (new dependency for no gain here).

## 2026-11-04 — Dream effect = blur + gradient map with three.js EffectComposer

**Choice:** A screen pass chain (RenderPass → 6 Gaussian blur passes → one gradient-map shader that writes sRGB
straight to the screen). Mounted only when the effect is on; it takes over rendering via `useFrame(…, 1)`.
**Why:** the reference look comes from blurring the image and recoloring by brightness (halos appear where
blurred shapes fade into the background). EffectComposer ships with three, so no new dependency.
**Alternatives considered:** `@react-three/postprocessing` (nice API but a new dependency for two custom
shaders); doing it in the materials (can't blur across objects).

## 2026-11-04 — Stylized look = generated matcap; blobby shapes = SDF + MarchingCubes

**Choice:** The Pearl look uses `MeshMatcapMaterial` with a matcap painted on a canvas from a few color stops
(shadow → body → glow band → highlight → white core, plus rim). Fused petals are signed-distance pieces
(ball, ellipsoids, tapered stalks) combined with a polynomial smooth-min and meshed by three.js `MarchingCubes`
(its `field` is filled directly; each piece only touches grid cells in its own bounding box, for speed).
**Why:** the user asked for stylized, not realistic. A matcap *is* "painted light", costs nothing at runtime,
works with instancing, and every color is a slider. SDF smooth-min is the standard way to get melted joins
(like Blender metaballs) and MarchingCubes is built into three.js — no new dependency.
**Alternatives considered:** realistic PBR + AgX + AO (researched, the user rejected realism); a custom
fresnel/ramp shader (more control, world-fixed light; possible later); raymarching the SDF in a shader
(perfect smoothness but no shadows/instancing and heavy on the GPU); drei `<MarchingCubes>` balls only
(can't make tapered stalks).

## 2026-11-04 — Abstract petals reuse the petal ring; only the single-petal geometry changes

**Choice:** "Abstract" is a petal *style*. `buildPetalGeometry` returns a normalized primitive (fit into a
length × width × thickness box, grown along +X like a blade) instead of a blade; placement still comes from
`petalPlacements`, so instancing, spikes, clusters etc. work unchanged. Abstract layers are identical copies
offset by `layerGap` (like the Blender reference) instead of shrinking inner rings. Colors are vertex colors.
**Why:** one InstancedMesh per part stays, so it costs nothing extra; all existing sliders keep working.
**Alternatives considered:** a separate "abstract flower" generator (duplicates layout logic); a shader-based
gradient (not needed yet; vertex colors are enough for these smooth primitives).

## 2026-11-04 — Drawings become symmetric width profiles; pad shown only when "Drawn" is picked

**Choice:** A drawing is reduced to a half-width per row, mirrored around the pad's center line. Each shape
group gets a "Drawn 手绘" option; the pad only appears when it's selected.
**Why:** It reuses the existing blade/lathe builders, so drawn parts bend, curl and instance like presets.
Mirroring around the visible center line (not the drawing's own middle) lets players draw just one side.
Showing pads only on demand keeps the panel short (4 pads would be long).
**Trade-off:** asymmetric shapes, notches at the tip and holes can't be drawn. A true 2D outline
(triangulated polygon) could support them later, but bending it is harder.

## 2026-11-04 — Instanced rendering for repeated parts (milestone 3)

**Choice:** Every repeated part type (petals, sepals, leaves, buds, receptacles, each flower-center part) is drawn
as one `InstancedMesh`. Florets/stamens inside a center are "stamped" from a unit template into one geometry.
**Why:** Spike/cluster plants reached ~3,400 separate meshes (one draw call each). Instancing brings that to ~10.
Stamping made center rebuilds 2–3× faster than creating and merging hundreds of small geometries.
**Note:** frame rate can't be measured in Claude's preview browser (even a blank page runs at ~2 FPS there), so
the numbers in ARCHITECTURE.md are build times, not FPS.

## 2026-11-04 — Petals, leaves, sepals as width-profile grids

**Choice:** Blade shapes are a half-width function `w(v)` sampled onto a row×column grid (`src/plant/blade.ts`).
**Why:** A grid can bend smoothly along and across the blade; `ShapeGeometry` only has outline vertices.

## 2026-11-04 — Deploy with GitHub Actions, relative base path

**Choice:** `.github/workflows/deploy.yml` builds and deploys to Pages; `vite.config.ts` uses `base: "./"`.
**Why:** A Vite app must be built before Pages can serve it. A relative base works under the
`/CTC_MiniGame/` sub-path and locally without changes.
**Alternatives considered:** committing `dist/` to a `gh-pages` branch (manual, easy to forget).

## 2026-11-04 — No node editor in the game; slider panel instead

**Choice:** Players edit flowers with a slider panel (one section per part) beside a live 3D preview.
**Why:** The user said the Blender node look was only to help *them* picture the plan, not a player UI.
**Effect:** React Flow removed from the stack; node graphs are only used in diagrams explaining the design.

## 2026-11-04 — Tech for the 3D flower builder (approved by user, built in milestone 1)

**Choice:** Vite + React + TypeScript, three.js via React Three Fiber, zustand for state. (React Flow was in the
first draft; removed, see entry above.) Details in `ARCHITECTURE.md`.
**Why:** The user wants everything in 3D. R3F lets the 3D view share one React app and state with the slider panel.
**Alternatives considered:** Babylon.js, plain three.js + Tweakpane.
**Note:** this replaces the earlier "no build step" decision once approved. GitHub Pages will then be deployed by a
GitHub Actions workflow that runs the Vite build.

## 2026-11-04 — Free drawing = 2D outline turned into a bent 3D surface

**Choice:** Players draw a flat outline; sliders bend/cup/spread it into 3D. No free 3D sculpting.
**Why:** Drawing in 3D is hard for players and heavy to build. Real petals and leaves are thin curved sheets, so a
2D outline plus bending looks right and stays simple.

---

## 2026-11-04 — Plain HTML/CSS/JS, no build step

**Choice:** The game is plain static files served directly by GitHub Pages.
**Why:** Simplest setup. Nothing to install, nothing to build, and GitHub Pages can host it as-is.
Any agent can run it with one command.
**Alternatives considered:** Vite/React, Phaser via npm. Can be added later if the game needs it —
if so, record it here and update the run/publish steps in `AGENTS.md`.

## 2026-11-04 — Agent-readable docs in the repo

**Choice:** `AGENTS.md` + `docs/PROGRESS.md` + `docs/DECISIONS.md` + `docs/GAME_DESIGN.md`.
**Why:** The user asked that any future agent understands the project without access to past
conversations or agent memory. All context lives in the repo.
