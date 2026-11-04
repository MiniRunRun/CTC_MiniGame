# Architecture: Flower Building Tool

How the 3D flower builder works technically. **Status: milestones 1–3 done (see Build order).**
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
  Drawn outlines (milestone 4) will be smoothed, mirrored to be symmetric, and converted to the same `w(v)` profile.
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
4. Drawing pad → outline → 3D shape.
5. Polish the slider panel UI (sections, presets, randomize button).
6. Save/load flower as JSON.
