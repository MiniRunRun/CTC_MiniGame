// Petals (花瓣): preset outlines and how they are arranged in rings/layers.
import * as THREE from "three";
import type { PetalShape, PetalSpec } from "./spec";
import { buildBlade, DRAWN_ROWS, ring, type RingPlacement } from "./blade";
import { profileAt } from "./profile";

/** Half-width of the petal at v (0 = base, 1 = tip), as a fraction of petal length. */
export function petalWidth(shape: PetalShape, v: number, drawn: number[]): number {
  const s = Math.sin(Math.PI * v);
  switch (shape) {
    case "round":
      return 0.36 * Math.pow(s, 0.55); // steep at the tip → rounded end
    case "pointed":
      return 0.24 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.4)), 0.9); // finite slope at the tip → point
    case "wavy":
      return 0.33 * Math.pow(s, 0.55) * (1 + 0.1 * Math.sin(v * Math.PI * 6));
    case "drawn":
      return profileAt(drawn, v);
  }
}

export function buildPetalGeometry(spec: PetalSpec): THREE.BufferGeometry {
  const tip = new THREE.Color(spec.color);
  return buildBlade({
    length: spec.size,
    halfWidth: (v) => petalWidth(spec.shape, v, spec.drawn),
    rows: spec.shape === "drawn" ? DRAWN_ROWS : 28,
    curvature: spec.curvature,
    cup: 0.12,
    ripple: spec.shape === "wavy" ? 0.06 : 0,
    baseColor: tip.clone().lerp(new THREE.Color("#ffffff"), 0.5), // petals fade lighter toward the base
    tipColor: tip,
  });
}

/**
 * Where each petal goes. Layer 0 is the outer, largest ring; inner layers are smaller, more closed and rotated.
 * openness (0–1) closes the flower toward upright; used for younger flowers at the top of a spike.
 */
export function petalPlacements(spec: PetalSpec, innerRadius: number, openness = 1): RingPlacement[] {
  const out: RingPlacement[] = [];
  const spread = 10 + (spec.spread - 10) * openness;
  for (let layer = 0; layer < spec.layers; layer++) {
    out.push(
      ...ring(spec.count, Math.max(5, spread - 18 * layer), innerRadius * (1 - 0.15 * layer), {
        offset: layer * 0.5,
        height: 0.003 * layer,
        scale: 1 - 0.2 * layer,
      }),
    );
  }
  return out;
}
