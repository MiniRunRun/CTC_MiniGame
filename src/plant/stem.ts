// Stem geometry helpers: the main stem's center-line curve, and tapered tubes along any curve
// (used for the main stem, side branches and the short flower stalks / pedicels).
import * as THREE from "three";
import type { StemSpec } from "./spec";

const DEG = Math.PI / 180;
const CURVE_POINTS = 40;
const TIP_TAPER = 0.55; // main stem tip radius = base radius × (1 − TIP_TAPER)

/** Main stem center-line, base at the origin, growing up +Y. */
export function stemCurve(spec: StemSpec): THREE.CatmullRomCurve3 {
  const { length: L, bend, shape } = spec;
  const lean = spec.lean * DEG;
  const az = spec.leanDirection * DEG;
  const leanDir = new THREE.Vector2(Math.cos(az), Math.sin(az));
  // The bow of a "curved" stem goes sideways to the lean, so the two read as different controls.
  const bowDir = new THREE.Vector2(-leanDir.y, leanDir.x);

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= CURVE_POINTS; i++) {
    const t = i / CURVE_POINTS;
    let x = 0;
    let z = 0;
    // Lean grows toward the tip (like a plant bending to the light). Height drops a little to keep length similar.
    const y = L * t * (1 - (1 - Math.cos(lean)) * t);
    const side = L * Math.sin(lean) * t * t;
    x += leanDir.x * side;
    z += leanDir.y * side;

    if (shape === "curved") {
      const bow = bend * 0.25 * L * Math.sin(Math.PI * t);
      x += bowDir.x * bow;
      z += bowDir.y * bow;
    } else if (shape === "spiral") {
      const turns = 2.5;
      const r = bend * 0.12 * L * (1 - 0.5 * t); // spiral tightens toward the top
      const a = turns * 2 * Math.PI * t;
      x += r * Math.sin(a);
      z += r * (1 - Math.cos(a));
    }
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Main stem radius at t (0 = base, 1 = tip). */
export function stemRadius(spec: StemSpec, t: number): number {
  return spec.thickness * (1 - TIP_TAPER * t);
}

/** Tube along a curve whose radius goes linearly from r0 (start) to r1 (end). */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  r0: number,
  r1: number,
  segments = 64,
  radial = 10,
): THREE.BufferGeometry {
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  // TubeGeometry has one radius. Rescale each ring around its center-line point to taper it.
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const ringSize = radial + 1;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, center);
    const r = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j < ringSize; j++) {
      const k = i * ringSize + j;
      v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  return geometry;
}
