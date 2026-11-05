# Architecture: Flower Building Tool

How the 3D flower builder works technically. **Status: milestones 1–4 done (see Build order).**
When code is written, keep this file matching the code.

## Tech stack

| Job | Library | Why |
|-----|---------|-----|
| Build tool | **Vite** + TypeScript | Fast dev server; outputs static files for GitHub Pages. |
| UI | **React** | Slider panel, drawing pad and later garden screens as components; works with React Three Fiber. |
| 3D | **three.js** via **React Three Fiber** + **drei** | Standard WebGL engine for the web; runs on GitHub Pages; drei gives camera controls and lighting. |
| State | **zustand** | One store holds the flower settings; the slider panel writes it and the 3D view reads it. |

Versions checked 2026-11-04: three 0.187, @react-three/fiber 9.8, drei 10.7, zustand 5.0, vite 8.3.

Alternatives considered: Babylon.js (fine, but R3F fits a React UI more simply); plain three.js + Tweakpane
(lighter, but custom panels and later game screens are easier in React).
**No node editor library** (React Flow, Rete, litegraph): the user decided players get a slider panel, not nodes.

## Screen layout

```
┌──────────────────────┬──────────────────────────────┐
│ Slider panel         │                              │
│ ▸ 01 Stem            │                              │
│ ▸ 02 Leaves  [draw]  │      3D preview (R3F)        │
│ ▸ 03 Petals  [draw]  │      orbit / zoom            │
│ ▸ 04 Center          │                              │
│ ▸ 05 Sepals & Buds   │                              │
│ ▸ 06 Architecture    │                              │
└──────────────────────┴──────────────────────────────┘
```
On phones, the 3D view sits on top and the panel scrolls below it.

## Data model (how the parts feed into the plant)

Not a UI: this is the internal pipeline. The user likes to picture it as a Blender-style node graph.
Each panel section edits one "spec" object; specs combine into the plant.

| Part | Inputs | Output |
|------|--------|--------|
| **Shape** (preset or drawn) | preset dropdown or drawing pad | `Outline2D` (list of 2D points) |
| **Stem** | sliders: shape, length, thickness, branching, direction | `StemSpec` |
| **Leaves** | `Outline2D`, sliders: number, size, arrangement, angle | `LeafSpec` |
| **Petals** | `Outline2D`, sliders: number, layers, curvature, spread | `PetalSpec` |
| **Flower Center** | sliders: type, size, height, density, color | `CenterSpec` |
| **Sepals & Buds** | `Outline2D` (sepal), sliders: sepal count, bud shape, bud count | `SepalBudSpec` |
| **Flower Head** | Petals + Center + Sepals | `FlowerSpec` |
| **Architecture** | Stem + Leaves + Flower Head, mode: single / branched / spike / cluster | `PlantSpec` |
| **Plant Output** | `PlantSpec` | drives the 3D preview |

The specs only hold **numbers and outlines** (small JSON). A separate pure function
`buildPlant(plantSpec) → three.js Group` makes the meshes. This keeps it fast and lets a saved flower be one
small JSON file, which the garden can reuse later.

## How each part becomes 3D

- **Stem:** a 3D curve (`CatmullRomCurve3`) made from the shape: straight line, bent arc, or helix (spiral).
  Direction tilts it. `TubeGeometry` wraps it with the thickness, tapering toward the tip. Branches are child curves
  that start at points along the parent.
- **Leaves, petals, sepals (preset or drawn):** the outline is stored as a **half-width profile** `w(v)`
  (v = 0 base → 1 tip). The surface is a grid of rows along the length and columns across the width, so it
  bends smoothly (a plain `ShapeGeometry` has no inner vertices and can't bend). Implemented for petals in
  `src/plant/petal.ts` (`petalWidth`, `buildPetalGeometry`). Then the vertices are bent:
  - *curvature* bends it along its length,
  - *cupping* bends it across its width,
  - *spread* rotates it open from the center.
- **Abstract petals (`src/plant/abstract.ts`):** when `petals.style = "abstract"`, the petal geometry is a three.js
  primitive fit into a box (length = size along +X from the origin, width/thickness as fractions of size), bent by
  curvature, normals recomputed (flat for gem/cube, welded smooth for the rest), and vertex-colored between
  `color` and `color2` by facing (normal.y) or by length, optionally repeated as bands. `petalPlacements` stacks
  abstract layers as identical rings offset by `layerGap`.
- **Fused abstract flower (`src/plant/fused.ts`):** `petals.join = "fused"`. Signed distance pieces — a center
  ball, an ellipsoid per petal (same ring as abstract petals, radius + `stalk`), a tapered stalk from the center to
  each petal — are smooth-min blended (`blend` → radius) into a `detail`³ grid, each piece only over its bounding
  box. three.js `MarchingCubes` (field = −distance, isolation 0) makes the triangles, which are copied into a plain
  geometry with vertex colors (`color` near the center → `color2` on the petals) and instanced on `parts.heads`.
- **Materials per part (`spec.materials`, `src/scene/partMaterial.ts`):** `materials.stem | leaves | petals |
  center | sepals` each hold `{ type, pearl, dream }`. They're kept outside the part specs so a material change
  never rebuilds geometry. `buildPartMaterials(spec, info)` returns `{ material, halo, disposables }`; the stem's
  material also covers receptacles, the sepals' covers buds. `Plant.tsx` draws each part with `<Part>` (instances +
  optional halo instances). `spec.scene` holds background color and ground on/off.
- **Pearl (`src/scene/matcap.ts`):** `MeshMatcapMaterial` with a canvas-painted matcap (per pixel: d = normal·light;
  shadow → body → glow → highlight → white core, glow on the rim). `pearl.tint` multiplies by part colors.
- **Dream material (`src/scene/dreamMaterial.ts`):** ShaderMaterial built from three chunks
  (`beginnormal/defaultnormal/begin/project_vertex`, so InstancedMesh works). t = 1−|n·v| (facing), x/len
  (length; radial for fused) or 3D value noise; + flow noise moving with time×speed; ping-pong repeat; r/g/b
  sampled at t±fringe. Edge Fade → alpha (transparent, no depth write). Halo: same geometry/matrices, vertices
  scaled around the geometry's bbox center by 1+halo, alpha = facing²×opacity, renderOrder 2. `uTime` (pattern
  motion) comes from the part's animation, see below.
- **Glitch material (`src/scene/glitchMaterial.ts`):** ShaderMaterial, same chunks. Light = fixed view-space
  direction + facing, + grain, posterized to `levels` greys. Screen-space (gl_FragCoord) pieces: bands of
  `(6+block·90)·dpr` px; vertical stripes on the top level and on random bands; accent color on level edges
  (fract(l·levels) near 0/1) in random bands and in random blocks. Random choices use step = floor(uTime·10), so
  with pattern motion they re-roll; with uTime 0 it's a still image. Tearing moved to Animation.
- **Cube build (`spec.cubes[part]`, `src/plant/cubes.ts`):** `cubify(geometry, {spec, color, axis})` scatters
  points over every triangle (by area, deterministic RNG), buckets them into cells of the cube size (one cube per
  cell; thin blades' two faces merge), then places a cube per cell — follow: at the averaged point, basis =
  (part length direction projected on the surface, averaged normal); grid: cell center, axis-aligned. Corner
  colors = lerp(color, color2) by position along the axis (x blades, y stem/bud/center, radial for fused), so
  materials need vertexColors (Plant.tsx switches stem/center to vertex colors when cubed). Output stays in part
  space, so materials/animation are unchanged. Plant.tsx wraps each geometry memo with it and frees the smooth
  source (not the stem's, which the layout owns).
- **Animation per part (`spec.animations`, `src/scene/animation.ts`):** `{ type: none|sway|pulse|glitch|pattern,
  amount, glitchBlock, speed }` per part (same keys as materials) — one motion per part. Whole-plant glitch is
  `spec.plantAnimation { glitch, glitchBlock, speed }`, passed to every part as `PlantMotion.whole`; its tearing
  uses shared bands (seed 0), while a part's own glitch is seeded per part (uAnSeed) so only that part tears.
  Receptacles use the stem's animation but follow (instead of repeating) its sway/glitch.
  **Following the stem:** `assemble()` also returns `anchors[list]` — each copy's attach point on the stem
  (flower parts → flower position, bud sepals → bud position, leaves → leaf position). `<Instances>` writes them as
  an `anchor` InstancedBufferAttribute on the geometry. Non-stem parts (ANIM_FOLLOW) add the stem's sway offset at
  anchor.y, then (ANIM_STEM_GLITCH) project the anchor and apply the stem's glitch test for that screen band
  (same seed 1, band, time as the stem's own tear), shifting the whole copy rigidly. Stem pulse is not followed
  (its bulge is ≤ 1 cm).
  `buildPartMaterials(m, info, anim)` builds the material, then
  `applyAnimation()` adds `onBeforeCompile` code to it — after `#include <begin_vertex>` (sway/pulse in part-local
  space; kind stem = bend by height, blade = flap along local Y by x/len, blob = wobble by distance; per-instance
  phase from instanceMatrix[3]) and after `#include <project_vertex>` (follow the stem — see below; then glitch
  tearing per screen band). Works on MeshStandard / MeshMatcap / our ShaderMaterials alike. Uniforms live in
  `material.userData.anim`; `Plant.tsx` useFrame sets uAnTime = t·speed·2, uAnPlantTime (stem speed), uAnWTime
  (whole-plant speed), uAnRes, and for ShaderMaterials uTime = t·amount·speed when type = pattern (else 0). No program change when only pattern motion is on. Shadows
  don't animate (the depth pass uses three's own material).
- **Screen effects (`src/scene/Effects.tsx`):** when `effect.mode = "dream"`, an EffectComposer renders the scene
  to a texture, blurs it (separable 9-tap Gaussian, 3 horizontal+vertical rounds, radius ∝ screen height ×
  `blur`), then maps perceptual brightness through `contrast`/`offset`/`repeat` onto the 5 `ramp` colors
  (sRGB uniforms), with red/blue sampled at offsets for fringes, plus grain. Output is sRGB, no tone mapping.
- **Drawn shapes (`src/plant/profile.ts`, `src/ui/DrawPad.tsx`):** each shape group has a "Drawn 手绘" option.
  Picking it opens a 240×150 pad showing the current drawn silhouette (a starter shape until the player draws).
  Base = bottom of the drawing, tip = top; its height = the part's length. `strokesToProfile(strokes, axisX)`
  takes, for each of 65 rows, the farthest stroke point from the pad's dashed center line → half-width ÷ height,
  fills empty rows by interpolation, smooths lightly, clamps to 0.8. So a full outline or one side gives the
  same result (mirrored). Profiles are stored in the spec as number arrays: `petals.drawn`, `leaves.drawn`,
  `sepals.drawnSepal`, `sepals.drawnBud`. Drawn blades use 64 rows so details survive. Drawn buds read the
  profile as radius ÷ height and are lathed.
  **Limit:** only the widest point per row counts, so notches cut into the tip and holes are filled in.
  Material is double-sided.
- **Placement on the stem (phyllotaxis):** alternate = 180° turns, opposite = pairs, whorled = N per node.
  Petals sit in rings; extra layers are smaller, rotated rings.
- **Flower center:** disc = flattened dome; column = cone-like cylinder; stamens = thin filaments with anthers
  around a taller pistil. Florets/stamens are placed in a sunflower spiral (golden angle 137.5°); density = how many.
  Small repeated parts are merged into one geometry per color (`mergeGeometries`), so 400 parts = a few draw calls.
- **Buds:** a lathe (`LatheGeometry`) of the bud profile (egg / pointed / round), wrapped in small sepals.
- **Rendering pipeline (code):** `layoutPlant(spec)` → stem tubes merged into one geometry + placements for
  flowers/buds/leaves. `assemble(spec, layout)` → one `Matrix4` per petal, sepal, receptacle, flower center, bud, leaf.
  `Plant.tsx` draws each part type as one `InstancedMesh`, so ~10 draw calls whatever the flower count.
  Measured (heaviest settings: 30 flowers × 24 petals × 4 layers = 2,880 petals): layout ≤ 10 ms, assemble ≤ 10 ms,
  flower center rebuild 16–30 ms at density 400.
- **Leaves:** on the lower main stem (t 0.08–0.6; up to 0.4 for spikes). alternate = 1 per node turning 180°,
  opposite = 2 per node turning 90°, whorled = 3 per node turning 60°. Upper leaves are smaller. Tips droop slightly.
- **Sepals:** a ring just below the petals, opening ~25° wider than the outer petals. Buds get a nearly upright ring.
- **Architecture:**
  - Single: one stem → one flower head.
  - Branched: N side branches (Stem → Branching) leave the upper main stem at 40°, curve upward, each ends in a
    flower; lower branches are longer. Not recursive (branches don't fork again).
  - Spike: flowers spaced along the upper stem, smaller and more closed toward the tip, buds at the top.
  - Cluster: equal stalks fan out from the stem tip up to 75° (sunflower-spiral spacing) → a dome of small flowers.
  - Buds: single/branched put them on stalks below the main flower, long enough to stick out past its petals;
    spike puts them at the very top; cluster puts them inside the dome on shorter stalks.

## Feasibility

| Requirement | Doable? | Notes |
|-------------|---------|-------|
| All parts with sliders | ✅ Yes | Standard procedural geometry. |
| Live 3D update | ✅ Yes | Rebuild only the part that changed; use instancing for repeated parts. |
| Slider panel UI | ✅ Yes | One section per part, live 3D update. |
| Free drawing of shapes | ✅ Yes, as 2D outline → bent 3D | Full 3D sculpting by players is not recommended. |
| 4 architecture types | ✅ Yes | Same flower-head builder reused in different layouts. |
| Host on GitHub Pages | ✅ Yes | Vite build + GitHub Actions deploy workflow. |
| Mobile | ⚠️ Limited | Node editor is cramped on phones; plan desktop-first. |

## Build order (milestones)

1. ✅ Vite + React + R3F app with a 3D scene, placeholder plant and empty panel sections; Pages deploy workflow.
2. ✅ Stem + petals + center driven by the slider panel (zustand store → `src/plant/*` builders → `Plant.tsx`).
3. ✅ Leaves, sepals, buds, the 4 architecture modes and stem branching; instanced rendering.
4. ✅ Drawing pad → width profile → 3D shape, for petals, leaves, sepals and buds.
5. Polish the slider panel UI (sections, presets, randomize button).
6. Save/load flower as JSON.
