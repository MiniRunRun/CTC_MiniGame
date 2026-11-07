// Plant layout (整体结构): decides WHERE everything goes for each architecture mode.
// Output = one merged geometry for all stem tubes + lists of placements for flowers, buds and leaves.
// The meshes for a single flower/bud/leaf are built elsewhere and reused at every placement.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlantShapes } from "./spec";
import { stemCurve, stemRadius, taperedTube } from "./stem";

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;

export interface Placement {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
  /** Flowers only: 1 = fully open, lower = more closed (younger flowers at the top of a spike). */
  openness: number;
}

export interface PlantLayout {
  stemGeometry: THREE.BufferGeometry;
  flowers: Placement[];
  buds: Placement[];
  leaves: Placement[];
}

/** Rotation that turns +Y into the stem direction `tangent`, then spins by `azimuth` around it. */
function frameAt(tangent: THREE.Vector3, azimuth: number): THREE.Quaternion {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, tangent);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, azimuth));
}

/** Direction leaving the stem at `angle` (radians) away from its tangent, on the side given by `azimuth`. */
function sideDirection(tangent: THREE.Vector3, azimuth: number, angle: number): THREE.Vector3 {
  const out = X.clone().applyQuaternion(frameAt(tangent, azimuth));
  return tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(out, Math.sin(angle)).normalize();
}

function pointing(dir: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(UP, dir);
}

export function layoutPlant(spec: PlantShapes): PlantLayout {
  const { stem, architecture: arch } = spec;
  const L = stem.length;
  const main = stemCurve(stem);
  const tubes: THREE.BufferGeometry[] = [taperedTube(main, stemRadius(stem, 0), stemRadius(stem, 1))];
  const flowers: Placement[] = [];
  const buds: Placement[] = [];
  const leaves: Placement[] = [];

  const pedicelRadius = stem.thickness * 0.3;

  /** Short stalk from `from` along `dir`; returns its end point. Slightly arched upward. */
  const pedicel = (from: THREE.Vector3, dir: THREE.Vector3, length: number): THREE.Vector3 => {
    const end = from.clone().addScaledVector(dir, length);
    const mid = from.clone().addScaledVector(dir, length * 0.5).addScaledVector(UP, length * 0.08);
    tubes.push(taperedTube(new THREE.QuadraticBezierCurve3(from.clone(), mid, end), pedicelRadius, pedicelRadius * 0.8, 8, 6));
    return end;
  };

  const tip = main.getPointAt(1);
  const tipDir = main.getTangentAt(1).normalize();

  /** Buds on stalks below the top of the main stem (single / branched). Stalks are long enough that
   *  the bud sticks out past the main flower's petals instead of hiding inside them. */
  const budsBelowTop = (count: number) => {
    const stalk = spec.petals.size * 1.2 + L * 0.05;
    for (let j = 0; j < count; j++) {
      const t = 0.75 - 0.07 * j;
      const p = main.getPointAt(t);
      const d = sideDirection(main.getTangentAt(t).normalize(), j * GOLDEN_ANGLE + 1, 40 * DEG);
      const end = pedicel(p, d, stalk);
      buds.push({ position: end, quaternion: pointing(d), scale: 1 - 0.08 * j, openness: 0 });
    }
  };

  if (arch.mode === "single") {
    flowers.push({ position: tip, quaternion: pointing(tipDir), scale: 1, openness: 1 });
    budsBelowTop(spec.sepals.budCount);
  } else if (arch.mode === "branched") {
    flowers.push({ position: tip, quaternion: pointing(tipDir), scale: 1, openness: 1 });
    const n = Math.round(stem.branches);
    for (let i = 0; i < n; i++) {
      const t = 0.45 + 0.4 * ((i + 0.5) / n);
      const p = main.getPointAt(t);
      const d = sideDirection(main.getTangentAt(t).normalize(), i * GOLDEN_ANGLE + 0.6, 40 * DEG);
      const len = L * (0.45 - 0.25 * ((t - 0.45) / 0.4)); // lower branches are longer
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) {
        const s = k / 8;
        // Branch heads outward, then curves back up toward the light.
        pts.push(p.clone().addScaledVector(d, len * s).addScaledVector(UP, len * 0.35 * s * s));
      }
      const branch = new THREE.CatmullRomCurve3(pts);
      const r0 = stemRadius(stem, t) * 0.7;
      tubes.push(taperedTube(branch, r0, r0 * 0.55, 32, 8));
      flowers.push({
        position: branch.getPointAt(1),
        quaternion: pointing(branch.getTangentAt(1).normalize()),
        scale: 0.8,
        openness: 1,
      });
    }
    budsBelowTop(spec.sepals.budCount);
  } else if (arch.mode === "spike") {
    // Many small flowers on short stalks up the top half of the stem; younger (smaller, more closed) toward the top.
    const n = Math.round(arch.flowers);
    const t0 = 0.45;
    const t1 = 0.95;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) / n;
      const t = t0 + (t1 - t0) * s;
      const p = main.getPointAt(t);
      const d = sideDirection(main.getTangentAt(t).normalize(), i * GOLDEN_ANGLE, 55 * DEG);
      const end = pedicel(p, d, L * 0.035);
      flowers.push({ position: end, quaternion: pointing(d), scale: 0.5 * (1 - 0.45 * s), openness: 1 - 0.5 * s });
    }
    // Buds finish the spike at the very top.
    const nb = spec.sepals.budCount;
    for (let j = 0; j < nb; j++) {
      const t = 0.955 + 0.04 * ((j + 0.5) / nb);
      const p = main.getPointAt(t);
      const d = sideDirection(main.getTangentAt(t).normalize(), (n + j) * GOLDEN_ANGLE, 35 * DEG);
      const end = pedicel(p, d, L * 0.02);
      buds.push({ position: end, quaternion: pointing(d), scale: 0.6, openness: 0 });
    }
  } else {
    // Cluster (umbel): equal stalks fan out from the stem tip, so the flowers form a dome.
    const n = Math.round(arch.flowers);
    const maxAngle = 75 * DEG;
    const stalk = L * 0.13;
    for (let i = 0; i < n; i++) {
      const polar = maxAngle * Math.sqrt((i + 0.5) / n);
      const d = sideDirection(tipDir, i * GOLDEN_ANGLE, polar);
      const end = pedicel(tip, d, stalk);
      flowers.push({ position: end, quaternion: pointing(d), scale: 0.4, openness: 1 });
    }
    // Buds sit on shorter stalks inside the dome.
    const nb = spec.sepals.budCount;
    for (let j = 0; j < nb; j++) {
      const d = sideDirection(tipDir, j * GOLDEN_ANGLE + 2, maxAngle * 0.5);
      const end = pedicel(tip, d, stalk * 0.7);
      buds.push({ position: end, quaternion: pointing(d), scale: 0.6, openness: 0 });
    }
  }

  // Leaves on the lower main stem. alternate = 1 per node (turning 180°), opposite = 2 (pairs turn 90°),
  // whorled = 3 per node (turning 60°). Upper leaves are a bit smaller.
  const leafSpec = spec.leaves;
  const perNode = leafSpec.arrangement === "alternate" ? 1 : leafSpec.arrangement === "opposite" ? 2 : 3;
  const nodeTurn = leafSpec.arrangement === "alternate" ? Math.PI : leafSpec.arrangement === "opposite" ? Math.PI / 2 : Math.PI / 3;
  const nodes = Math.ceil(leafSpec.count / perNode);
  const tLow = 0.08;
  const tHigh = arch.mode === "spike" ? 0.4 : 0.6;
  const tilt = (90 - leafSpec.angle) * DEG;
  let placed = 0;
  for (let k = 0; k < nodes; k++) {
    const t = nodes === 1 ? (tLow + tHigh) / 2 : tLow + (tHigh - tLow) * (k / (nodes - 1));
    const p = main.getPointAt(t);
    const tangent = main.getTangentAt(t).normalize();
    for (let j = 0; j < perNode && placed < leafSpec.count; j++, placed++) {
      const az = k * nodeTurn + (j * 2 * Math.PI) / perNode;
      // Leaf geometry grows along +X; turn it to face outward at `az`, then lift it by `tilt`.
      const q = frameAt(tangent, az).multiply(new THREE.Quaternion().setFromAxisAngle(Z, tilt));
      leaves.push({ position: p, quaternion: q, scale: 1 - 0.3 * (k / Math.max(1, nodes)), openness: 0 });
    }
  }

  const stemGeometry = mergeGeometries(tubes);
  tubes.forEach((g) => g.dispose());
  return { stemGeometry, flowers, buds, leaves };
}
