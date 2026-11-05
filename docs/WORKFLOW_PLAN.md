# Restructure plan: one pipeline per part (proposal, 2026-11-05)

Status: **phases 1 and 2 done (2026-11-05)**; phases 3–4 not started. When a phase is done, move its notes into
ARCHITECTURE.md / DECISIONS.md and mark it here.

## Problem (found by reading the code)

Features were added one by one, so the same idea now exists several times:

| Idea | Where it lives today |
|---|---|
| "Build a part out of pieces" | `abstract.ts` (1 primitive per petal, petals only), `cubes.ts` Blocks (many small cubes), `cubes.ts` Cubes (few big boxes), `fused.ts` (ellipsoids melted together, petals only) |
| Gradient / ramp | blade base→tip, bud green→petal, center `shade()`, abstract `color2`+`bands`, fused radial, Blocks `color2`, Cubes 5-color `palette`, Dream `ramp`, Effect `ramp` |
| Ping-pong repeat | `abstract.ts banded`, `cubes.ts palette`, Dream `pingpong`, Effect `level` |
| Hash / noise in GLSL | `animation.ts anHash`, `glitchMaterial h21`, `dreamMaterial hash3`, `Effects hash` |
| Per-part settings | split over `spec.petals` (etc.), `spec.materials[part]`, `spec.animations[part]`, `spec.cubes[part]` |
| Per-part render code | 7 near-identical `buildPartMaterials` memos + 7 geometry memos in `Plant.tsx` |
| Ramp editor UI | Dream ramp, Effect ramp, Cubes palette — three copies in `Panel.tsx` |

## Target: the same 6 stages for every part (like Blender Geometry Nodes / Houdini SOPs)

1. **Shape 外形** — outline profile + size + bend (blade, lathe for buds, tube for stem, center types).
2. **Build 构成** — how the shape is filled:
   - `sheet` (today's smooth surface),
   - `pieces` = scatter points on the shape → place a primitive at each (copy-to-points). Settings: primitive
     (cube, sphere, gem, cone, torus, capsule), count / size, size variation, tilt, align (follow / grid), gap.
     Abstract petals = pieces with count 1 fitted to the petal; Blocks = many small cubes; Cubes = few big boxes.
     Bonus: every primitive works on every part ("pearls along a leaf", "gems on the stem").
   - `fused` = the pieces melted together with smooth-min (today's fused.ts, for any part).
3. **Attributes 属性** — builders write data, not colors: `along` (base→tip 0–1), `across`, `pieceId`,
   `pieceRandom`, (facing is computed in the shader).
4. **Color 颜色** — ONE ramp type (2–5 stops) + **driven by**: along / radial / facing / noise / per piece
   (each piece starts at its own random point) + repeat (ping-pong) + mode (smooth / bands). Replaces color+color2,
   bands, palette and Dream's own ramp.
5. **Material 材质** — lighting style only: natural / pearl / dream (halo, fringe, flow) / glitch (levels,
   stripes). Reads the color from stage 4.
6. **Animation 动画** — unchanged (already a layer). Growing State later = another layer.

## Code shape

- `PlantSpec.parts[part] = { shape, build, color, material, animation }` (+ shared plant-level settings).
- `src/plant/parts.ts` registry: one entry per part (stem, leaves, petals, center, sepals, buds, receptacles) with
  its shape builder, length axis, anim kind, which matrix/anchor list it uses, which settings it shares.
- `Plant.tsx` loops over the registry with one hook instead of hand-written memos.
- `src/scene/glsl/common.ts`: hash, noise, ramp, pingpong — shared by all shaders.
- `Panel.tsx`: one `RampEditor`, one `BuildControls`; part sections generated from the registry.

## Phases (each one is shippable on its own)

1. ✅ **Shared helpers, no visible change:** GLSL common chunk, one JS ramp/pingpong, one `RampEditor`. Low risk.
2. ✅ **Merge builds:** `Build = sheet | pieces | fused` for every part; abstract petals and Blocks/Cubes become
   presets of `pieces`. Visible: new combos (any primitive × any part).
3. **Unify color:** attributes + one ramp per part, materials read it. Visible: same color controls everywhere.
4. **Registry + spec regroup:** `spec.parts[part]`, generic `Plant.tsx` / `Panel.tsx`. Makes every later feature
   (Growing State, presets, save/load) a one-place change.
