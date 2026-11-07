// Part registry (部件表): one entry per kind of mesh the plant draws. Plant.tsx loops over this list and runs the
// same pipeline for each entry, so adding a feature to every part (e.g. Growing State) is a one-place change:
//   source geometry (smooth shape) → build (pieces / fused, plant/build.ts) → aAlong → material + color + animation
//   → drawn once per copy in the entry's assemble() list.
// Settings come from spec.parts[entry.part]. Two parts cover two meshes each:
//   stem   → the stem tubes and the receptacles (花托) under each flower
//   sepals → the sepals and the buds (花蕾)
import * as THREE from "three";
import type { PlantSpec, PartName } from "../plant/spec";
import type { PlantLayout } from "../plant/layout";
import type { AnchoredList } from "../plant/assemble";
import type { BuildAxis } from "../plant/build";
import type { AnimKind } from "./animation";
import { buildPetalGeometry } from "../plant/petal";
import { buildCenter } from "../plant/center";
import { buildLeafGeometry } from "../plant/leaf";
import { buildBudGeometry, buildSepalGeometry } from "../plant/sepal";
import { buildFusedFlower } from "../plant/fused";

/** A smooth geometry and the Form color it is built with (center types make several, one per color). */
export interface SourcePiece {
  geometry: THREE.BufferGeometry;
  color: string;
}

export interface MeshSource {
  pieces: SourcePiece[];
  /** Already final (skip the Build step), e.g. the whole fused flower. */
  built?: boolean;
  /** The geometry belongs to someone else (the layout's stem tubes): never dispose it. */
  borrowed?: boolean;
}

/** Where the copies go and how the mesh moves, which can depend on the settings. */
export interface MeshPlacement {
  /** assemble() list of copies; null = drawn once in plant space (the stem). */
  list: AnchoredList | null;
  kind: AnimKind; // how sway bends it (animation.ts)
  size: number; // length, for color noise scale and animation
  animSize?: number; // animation size when it differs from `size`
}

export interface PartMeshDef {
  id: string;
  part: PartName; // whose build / color / material / animation it uses
  axis: BuildAxis; // which way its length runs
  roughness: number;
  doubleSide?: boolean;
  halo: boolean; // can grow a Dream halo shell
  follow: boolean; // moves with the stem at its anchor (everything but the stem itself)
  /** Sits on the stem: when the stem sways or glitches, it only follows instead of doing it a second time. */
  onStem?: boolean;
  /** Settings the smooth geometry depends on (memo inputs; build and color driver are added by Plant.tsx). */
  inputs: (spec: PlantSpec, layout: PlantLayout) => unknown[];
  source: (spec: PlantSpec, layout: PlantLayout) => MeshSource;
  place: (spec: PlantSpec) => MeshPlacement;
}

/** Petals fused as a whole flower: one melted shape per flower head instead of separate petals. */
export function flowerFused(spec: PlantSpec): boolean {
  const b = spec.parts.petals.build;
  return b.mode === "fused" && b.flower;
}

export const PART_MESHES: PartMeshDef[] = [
  {
    id: "stem",
    part: "stem",
    axis: "y",
    roughness: 0.7,
    halo: false,
    follow: false,
    inputs: (s, layout) => [layout, s.parts.stem.shape.color],
    source: (s, layout) => ({ pieces: [{ geometry: layout.stemGeometry, color: s.parts.stem.shape.color }], borrowed: true }),
    place: (s) => ({ list: null, kind: "stem", size: s.parts.stem.shape.length }),
  },
  {
    id: "receptacle",
    part: "stem",
    axis: "y",
    roughness: 0.7,
    halo: true,
    follow: true,
    onStem: true,
    inputs: (s) => [s.parts.stem.shape.thickness, s.parts.stem.shape.color],
    source: (s) => ({
      pieces: [{ geometry: new THREE.SphereGeometry(s.parts.stem.shape.thickness * 0.9, 16, 10), color: s.parts.stem.shape.color }],
    }),
    place: (s) => ({ list: "receptacles", kind: "blob", size: s.parts.stem.shape.thickness }),
  },
  {
    id: "leaf",
    part: "leaves",
    axis: "x",
    roughness: 0.55,
    doubleSide: true,
    halo: true,
    follow: true,
    inputs: (s) => [s.parts.leaves.shape],
    source: (s) => ({ pieces: [{ geometry: buildLeafGeometry(s.parts.leaves.shape), color: s.parts.leaves.shape.color }] }),
    place: (s) => ({ list: "leaves", kind: "blade", size: s.parts.leaves.shape.size }),
  },
  {
    id: "petal",
    part: "petals",
    axis: "x",
    roughness: 0.55,
    doubleSide: true,
    halo: true,
    follow: true,
    inputs: (s) => {
      const fused = flowerFused(s);
      // The fused flower also depends on the build settings, the center size and the stem thickness.
      return [s.parts.petals.shape, fused, fused && s.parts.center.shape.size, fused && s.parts.stem.shape.thickness];
    },
    source: (s) => {
      const p = s.parts.petals;
      if (!flowerFused(s)) return { pieces: [{ geometry: buildPetalGeometry(p.shape), color: p.shape.color }] };
      const geometry = buildFusedFlower(p.shape, p.build, s.parts.center.shape.size * 0.35, s.parts.stem.shape.thickness * 1.6);
      return { pieces: [{ geometry, color: p.shape.color }], built: true };
    },
    place: (s) => {
      const p = s.parts.petals;
      if (!flowerFused(s)) return { list: "petals", kind: "blade", size: p.shape.size };
      // Fused flower: the reach from the axis to the petal tips.
      return { list: "heads", kind: "blob", size: s.parts.center.shape.size * 0.35 + p.build.stalk + p.shape.size };
    },
  },
  {
    id: "center",
    part: "center",
    axis: "y",
    roughness: 0.8,
    halo: true,
    follow: true,
    inputs: (s) => [s.parts.center.shape],
    source: (s) => ({ pieces: buildCenter(s.parts.center.shape) }),
    place: (s) => {
      const c = s.parts.center.shape;
      return { list: "heads", kind: "blob", size: c.size, animSize: Math.max(c.size, c.height) };
    },
  },
  {
    id: "sepal",
    part: "sepals",
    axis: "x",
    roughness: 0.55,
    doubleSide: true,
    halo: true,
    follow: true,
    inputs: (s) => [s.parts.sepals.shape, s.parts.petals.shape.size],
    source: (s) => ({
      pieces: [{ geometry: buildSepalGeometry(s.parts.sepals.shape, s.parts.petals.shape.size), color: s.parts.sepals.shape.color }],
    }),
    place: (s) => ({ list: "sepals", kind: "blade", size: s.parts.petals.shape.size * 0.45 }),
  },
  {
    id: "bud",
    part: "sepals",
    axis: "y",
    roughness: 0.6,
    halo: true,
    follow: true,
    inputs: (s) => [s.parts.sepals.shape, s.parts.petals.shape],
    // Buds show the petal color at the top, so pieces start from it.
    source: (s) => ({
      pieces: [{ geometry: buildBudGeometry(s.parts.sepals.shape, s.parts.petals.shape), color: s.parts.petals.shape.color }],
    }),
    place: (s) => ({ list: "buds", kind: "blob", size: s.parts.petals.shape.size * 0.6 }),
  },
];
