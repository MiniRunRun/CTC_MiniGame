// Sepals (萼片) and buds (花蕾).
// Sepals are small green blades under the petals. A bud is a closed teardrop (lathe) wrapped by small sepals.
import * as THREE from "three";
import type { BudShape, PetalSpec, SepalShape, SepalSpec } from "./spec";
import { buildBlade } from "./blade";

/** Sepal length relative to petal size. */
export const SEPAL_RATIO = 0.45;

function sepalWidth(shape: SepalShape, v: number): number {
  switch (shape) {
    case "pointed":
      return 0.18 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.5)), 0.9);
    case "round":
      return 0.3 * Math.pow(Math.sin(Math.PI * v), 0.55);
    case "narrow":
      return 0.07 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.8)), 0.8);
  }
}

export function buildSepalGeometry(spec: SepalSpec, petalSize: number): THREE.BufferGeometry {
  const color = new THREE.Color(spec.color);
  return buildBlade({
    length: petalSize * SEPAL_RATIO,
    halfWidth: (v) => sepalWidth(spec.shape, v),
    rows: 16,
    cols: 8,
    curvature: -0.15,
    cup: 0.1,
    baseColor: color.clone().multiplyScalar(0.85),
    tipColor: color,
  });
}

/** Bud outline: radius at height fraction y (0 = base, 1 = top), relative to the bud's max radius. */
function budRadius(shape: BudShape, y: number): number {
  switch (shape) {
    case "round":
      return Math.sin(Math.PI * y);
    case "oval":
      return Math.pow(Math.sin(Math.PI * y), 0.8);
    case "pointed":
      return Math.sin(Math.PI * Math.pow(y, 0.65)); // fat low, drawn out to a point
  }
}

const BUD_HEIGHT_RATIO: Record<BudShape, number> = { round: 2, oval: 2.6, pointed: 3 };

/** Closed bud, base at the origin, growing +Y. Green at the base, petal color showing at the top. */
export function buildBudGeometry(shape: BudShape, petals: PetalSpec, sepalColor: string): THREE.BufferGeometry {
  const R = petals.size * 0.15;
  const H = R * BUD_HEIGHT_RATIO[shape];
  const pts: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = i / steps;
    pts.push(new THREE.Vector2(Math.max(0.0001, R * budRadius(shape, y)), y * H));
  }
  const geometry = new THREE.LatheGeometry(pts, 20);

  const pos = geometry.attributes.position;
  const green = new THREE.Color(sepalColor);
  const petal = new THREE.Color(petals.color);
  const c = new THREE.Color();
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    c.copy(green).lerp(petal, THREE.MathUtils.smoothstep(pos.getY(i) / H, 0.2, 0.7));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
