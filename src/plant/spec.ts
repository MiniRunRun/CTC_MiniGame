// Flower settings ("specs"): plain data the sliders edit and the 3D builders read.
// Units: meters and degrees. Keep this file free of three.js so specs stay small, saveable JSON.

export type StemShape = "straight" | "curved" | "spiral";

export interface StemSpec {
  shape: StemShape;
  length: number; // 0.3 – 2
  thickness: number; // radius at the base, 0.005 – 0.05
  bend: number; // how strong the curve/spiral is, 0 – 1 (ignored for straight)
  lean: number; // growth direction: tilt away from vertical, 0 – 60°
  leanDirection: number; // compass direction of the tilt, 0 – 360°
  branches: number; // side branches, 1 – 6 (used by the "branched" architecture)
  color: string;
}

export type LeafShape = "heart" | "oval" | "slender" | "serrated";
export type LeafArrangement = "alternate" | "opposite" | "whorled";

export interface LeafSpec {
  shape: LeafShape;
  count: number; // total leaves on the main stem, 0 – 16
  size: number; // leaf length, 0.04 – 0.3
  arrangement: LeafArrangement; // 互生 1 per node / 对生 2 per node / 轮生 3 per node
  angle: number; // angle between leaf and stem, 15 – 90°
  color: string;
}

export type PetalShape = "round" | "pointed" | "wavy";

export interface PetalSpec {
  shape: PetalShape;
  count: number; // per layer, 3 – 24
  layers: number; // 1 = single, 2+ = multi-layer
  size: number; // petal length, 0.05 – 0.4
  curvature: number; // -1 (curls down/out) – 1 (curls up/in)
  spread: number; // opening angle from the stem axis: 10° closed – 120° drooping
  color: string;
}

export type CenterType = "disc" | "column" | "stamens";

export interface CenterSpec {
  type: CenterType;
  size: number; // diameter, 0.02 – 0.25
  height: number; // how far it sticks out, 0 – 0.15
  density: number; // number of florets / stamens, 0 – 400
  color: string;
}

export type SepalShape = "pointed" | "round" | "narrow";
export type BudShape = "round" | "oval" | "pointed";

export interface SepalSpec {
  count: number; // sepals under each flower, 0 – 10
  shape: SepalShape;
  budShape: BudShape;
  budCount: number; // unopened buds on the plant, 0 – 8
  color: string;
}

export type ArchitectureMode = "single" | "branched" | "spike" | "cluster";

export interface ArchitectureSpec {
  mode: ArchitectureMode; // 单茎单花 / 分枝多花 / 穗状花序 / 聚集式花序
  flowers: number; // flowers in a spike or cluster, 3 – 30
}

export interface PlantSpec {
  stem: StemSpec;
  leaves: LeafSpec;
  petals: PetalSpec;
  center: CenterSpec;
  sepals: SepalSpec;
  architecture: ArchitectureSpec;
}

export const DEFAULT_SPEC: PlantSpec = {
  stem: {
    shape: "curved",
    length: 1,
    thickness: 0.018,
    bend: 0.35,
    lean: 10,
    leanDirection: 30,
    branches: 3,
    color: "#4f8a3c",
  },
  leaves: {
    shape: "oval",
    count: 6,
    size: 0.16,
    arrangement: "alternate",
    angle: 50,
    color: "#4a8a3a",
  },
  petals: {
    shape: "round",
    count: 8,
    layers: 2,
    size: 0.17,
    curvature: 0.25,
    spread: 70,
    color: "#e98bb0",
  },
  center: {
    type: "disc",
    size: 0.07,
    height: 0.02,
    density: 120,
    color: "#e8b923",
  },
  sepals: {
    count: 5,
    shape: "pointed",
    budShape: "oval",
    budCount: 1,
    color: "#5d9a45",
  },
  architecture: {
    mode: "single",
    flowers: 12,
  },
};
