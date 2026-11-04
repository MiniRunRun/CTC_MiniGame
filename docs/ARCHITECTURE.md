# Architecture: Flower Building Tool

How the 3D flower builder works technically. **Status: proposed plan, not built yet.**
When code is written, keep this file matching the code.

## Tech stack

| Job | Library | Why |
|-----|---------|-----|
| Build tool | **Vite** + TypeScript | Fast dev server; outputs static files for GitHub Pages. |
| UI | **React** | Needed by the node editor and 3D libraries below. |
| Node editor (Blender-like) | **React Flow** (`@xyflow/react` v12) | Actively maintained; nodes are normal React components, so sliders, dropdowns, color pickers and a drawing pad fit inside a node easily. Can be styled dark like Blender. |
| 3D | **three.js** via **React Three Fiber** + **drei** | Standard WebGL engine for the web; runs on GitHub Pages; drei gives camera controls and lighting. |
| State | **zustand** | One store holds the node graph; both the node editor and the 3D view read it. |

Versions checked 2026-11-04: three 0.187, @react-three/fiber 9.8, drei 10.7, @xyflow/react 12.12, zustand 5.0, vite 8.3.

Alternatives considered: Rete.js v2 (also good, more setup), litegraph.js (ComfyUI-style look, but the npm
package is old/unmaintained), Babylon.js (fine, but R3F + React Flow share one React app more simply).

## Screen layout

```
┌──────────────────────────────┬──────────────────────┐
│  Node editor (React Flow)    │  3D preview (R3F)    │
│  [Stem]──┐                   │  orbit / zoom        │
│  [Leaf Shape]→[Leaves]──┤    │                      │
│  [Petal Shape]→[Petals]─┼→[Flower Head]→[Architecture]→[Plant Output]
│  [Center]───────────────┤    │                      │
│  [Sepals & Buds]────────┘    │                      │
└──────────────────────────────┴──────────────────────┘
```
On phones, the panels stack (3D on top, nodes below).

## Node types

Like Blender Geometry Nodes, wires carry data of a type. Socket colors show the type.

| Node | Inputs | Output |
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

The node graph only holds **numbers and outlines** (small JSON). A separate pure function
`buildPlant(plantSpec) → three.js Group` makes the meshes. This keeps it fast and lets a saved flower be one
small JSON file, which the garden can reuse later.

## How each part becomes 3D

- **Stem:** a 3D curve (`CatmullRomCurve3`) made from the shape: straight line, bent arc, or helix (spiral).
  Direction tilts it. `TubeGeometry` wraps it with the thickness, tapering toward the tip. Branches are child curves
  that start at points along the parent.
- **Leaves, petals, sepals (preset or drawn):** the 2D outline is filled into a flat mesh (`ShapeGeometry`, which
  uses earcut triangulation), then the vertices are bent:
  - *curvature* bends it along its length,
  - *cupping* bends it across its width,
  - *spread* rotates it open from the center.
  Drawn outlines are smoothed and resampled to a fixed number of points first, so messy drawings still work.
  Material is double-sided.
- **Placement on the stem (phyllotaxis):** alternate = 180° turns, opposite = pairs, whorled = N per node.
  Petals sit in rings; extra layers are smaller, rotated rings.
- **Flower center:** disc = flattened sphere; column = cylinder/cone; stamen cluster = many small stalks with
  tips spread in a sunflower spiral (golden angle 137.5°). Density = how many. Uses `InstancedMesh` so hundreds
  of stamens stay fast.
- **Buds:** a lathe (`LatheGeometry`) of the bud profile (egg / pointed / round), wrapped in small sepals.
- **Architecture:**
  - Single: one stem → one flower head.
  - Branched: stem forks N times (recursive); each tip gets a flower.
  - Spike: flowers spaced along the upper stem, smaller and more closed toward the tip, buds at the top.
  - Cluster: many short stalks from one point on a dome, each with a small flower.

## Feasibility

| Requirement | Doable? | Notes |
|-------------|---------|-------|
| All parts with sliders | ✅ Yes | Standard procedural geometry. |
| Live 3D update | ✅ Yes | Rebuild only the part that changed; use instancing for repeated parts. |
| Blender-style node UI | ✅ Yes | React Flow + custom node components and dark theme. |
| Free drawing of shapes | ✅ Yes, as 2D outline → bent 3D | Full 3D sculpting by players is not recommended. |
| 4 architecture types | ✅ Yes | Same flower-head builder reused in different layouts. |
| Host on GitHub Pages | ✅ Yes | Vite build + GitHub Actions deploy workflow. |
| Mobile | ⚠️ Limited | Node editor is cramped on phones; plan desktop-first. |

## Build order (milestones)

1. Vite + React + R3F app with an empty 3D scene, deployed to GitHub Pages.
2. Stem + petals + center as a **plain slider panel** (no nodes yet) to get the 3D look right.
3. Leaves, sepals, buds, and the 4 architecture modes.
4. Drawing pad → outline → 3D shape.
5. Swap the slider panel for the React Flow node editor.
6. Save/load flower as JSON.
