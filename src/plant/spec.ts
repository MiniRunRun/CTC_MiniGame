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

export interface PlantSpec {
  stem: StemSpec;
  petals: PetalSpec;
  center: CenterSpec;
}

export const DEFAULT_SPEC: PlantSpec = {
  stem: {
    shape: "curved",
    length: 1,
    thickness: 0.018,
    bend: 0.35,
    lean: 10,
    leanDirection: 30,
    color: "#4f8a3c",
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
};
