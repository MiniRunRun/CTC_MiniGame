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
