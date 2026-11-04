// Builds the stem: a 3D center-line curve from the stem settings, wrapped in a tube that tapers to the tip.
import * as THREE from "three";
import type { StemSpec } from "./spec";

const DEG = Math.PI / 180;
const CURVE_POINTS = 40;
const TUBE_SEGMENTS = 64;
const RADIAL_SEGMENTS = 10;
const TIP_TAPER = 0.55; // tip radius = base radius × (1 − TIP_TAPER)

export interface StemResult {
  geometry: THREE.BufferGeometry;
  tip: THREE.Vector3; // where the flower head sits
  tipDirection: THREE.Vector3; // unit vector the stem is pointing at the tip
}

/** Center-line points, base at the origin, growing up +Y. */
function centerLine(spec: StemSpec): THREE.Vector3[] {
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
  return pts;
}

export function buildStem(spec: StemSpec): StemResult {
  const curve = new THREE.CatmullRomCurve3(centerLine(spec));
  const geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 1, RADIAL_SEGMENTS, false);

  // TubeGeometry has one radius. Rescale each ring around its center-line point to taper the stem.
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const ring = RADIAL_SEGMENTS + 1;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= TUBE_SEGMENTS; i++) {
    const t = i / TUBE_SEGMENTS;
    curve.getPointAt(t, center);
    const r = spec.thickness * (1 - TIP_TAPER * t);
    for (let j = 0; j < ring; j++) {
      const k = i * ring + j;
      v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;

  return {
    geometry,
    tip: curve.getPointAt(1),
    tipDirection: curve.getTangentAt(1).normalize(),
  };
}
