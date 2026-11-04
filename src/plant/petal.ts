// Builds one petal as a bendable surface.
// The petal outline is a half-width profile w(v): v runs base (0) → tip (1); the surface is a grid
// across that width, so it can be bent along its length (curvature) and across it (cupping).
// Later, a player-drawn outline will be converted to the same w(v) profile (milestone 4).
import * as THREE from "three";
import type { PetalShape, PetalSpec } from "./spec";

const ROWS = 28; // along the length
const COLS = 12; // across the width
const CUP = 0.12; // fixed slight cupping so petals don't look like flat paper

/** Half-width of the petal at v (0 = base, 1 = tip), as a fraction of petal length. */
export function petalWidth(shape: PetalShape, v: number): number {
  const s = Math.sin(Math.PI * v);
  switch (shape) {
    case "round":
      return 0.36 * Math.pow(s, 0.55); // steep at the tip → rounded end
    case "pointed":
      return 0.24 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.4)), 0.9); // finite slope at the tip → point
    case "wavy":
      return 0.33 * Math.pow(s, 0.55) * (1 + 0.1 * Math.sin(v * Math.PI * 6));
  }
}

/**
 * Petal in local space: grows along +X from the origin, width along Z, front face toward +Y.
 * Vertex colors fade from a pale base to the petal color at the tip.
 */
export function buildPetalGeometry(spec: PetalSpec): THREE.BufferGeometry {
  const L = spec.size;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tipColor = new THREE.Color(spec.color);
  const baseColor = tipColor.clone().lerp(new THREE.Color("#ffffff"), 0.5);
  const c = new THREE.Color();

  for (let r = 0; r <= ROWS; r++) {
    const v = r / ROWS;
    const hw = petalWidth(spec.shape, v);
    for (let k = 0; k <= COLS; k++) {
      const u = (k / COLS) * 2 - 1; // −1 … 1 across the width
      const x = v * L;
      const z = u * hw * L;
      let y = spec.curvature * 0.6 * L * v * v; // bend along the length
      y += CUP * L * u * u * (hw / 0.36); // edges lift a little
      if (spec.shape === "wavy") y += 0.06 * L * u * u * Math.sin(v * Math.PI * 7); // ruffled edge
      positions.push(x, y, z);

      c.copy(baseColor).lerp(tipColor, THREE.MathUtils.smoothstep(v, 0, 0.7));
      colors.push(c.r, c.g, c.b);
    }
  }

  const row = COLS + 1;
  for (let r = 0; r < ROWS; r++) {
    for (let k = 0; k < COLS; k++) {
      const a = r * row + k;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface PetalPlacement {
  angle: number; // around the stem axis, radians
  tilt: number; // rotation lifting the petal up from horizontal, radians
  radius: number; // distance from the center where the petal attaches
  height: number; // small vertical offset so layers don't overlap exactly
  scale: number;
}

/** Where each petal goes. Layer 0 is the outer, largest ring; inner layers are smaller, more closed and rotated. */
export function petalPlacements(spec: PetalSpec, innerRadius: number): PetalPlacement[] {
  const out: PetalPlacement[] = [];
  for (let layer = 0; layer < spec.layers; layer++) {
    const spread = Math.max(5, spec.spread - 18 * layer);
    for (let i = 0; i < spec.count; i++) {
      out.push({
        angle: ((i + layer * 0.5) / spec.count) * Math.PI * 2,
        tilt: THREE.MathUtils.degToRad(90 - spread),
        radius: innerRadius * (1 - 0.15 * layer),
        height: 0.003 * layer,
        scale: 1 - 0.2 * layer,
      });
    }
  }
  return out;
}
