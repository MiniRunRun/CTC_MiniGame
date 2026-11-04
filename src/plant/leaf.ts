// Leaves (叶): preset outlines. Placement on the stem is in layout.ts.
import * as THREE from "three";
import type { LeafShape, LeafSpec } from "./spec";
import { buildBlade, DRAWN_ROWS } from "./blade";
import { profileAt } from "./profile";

/** Half-width of the leaf at v (0 = base, 1 = tip), as a fraction of leaf length. */
export function leafWidth(shape: LeafShape, v: number, drawn: number[]): number {
  const ellipse = Math.pow(4 * v * (1 - v), 0.6); // rounded both ends
  switch (shape) {
    case "heart":
      // Widest near the base, pointed tip. The lobes are pulled back past the base by lengthShift below.
      return 0.4 * Math.pow(Math.sin(Math.PI * (0.25 + 0.75 * v)), 0.7);
    case "oval":
      return 0.22 * ellipse;
    case "slender":
      return 0.07 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.8)), 0.8);
    case "serrated": {
      const tooth = (v * 11) % 1; // sawtooth: each tooth widens then snaps back
      return 0.21 * ellipse * (0.86 + 0.2 * tooth);
    }
    case "drawn":
      return profileAt(drawn, v);
  }
}

export function buildLeafGeometry(spec: LeafSpec): THREE.BufferGeometry {
  const color = new THREE.Color(spec.color);
  return buildBlade({
    length: spec.size,
    halfWidth: (v) => leafWidth(spec.shape, v, spec.drawn),
    // enough rows to show each serration / drawn detail
    rows: spec.shape === "serrated" ? 88 : spec.shape === "drawn" ? DRAWN_ROWS : 36,
    curvature: -0.3, // leaf tips droop a little
    cup: 0.08,
    lengthShift: spec.shape === "heart" ? (u, v) => -0.18 * u * u * Math.pow(1 - v, 3) : undefined,
    baseColor: color.clone().multiplyScalar(0.8),
    tipColor: color,
  });
}
