// Builds the flower center (花心): disc, column, or a cluster of stamens around a pistil.
// Small repeated parts (florets, stamens) are merged into one geometry per color, so even
// hundreds of them cost only a few draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CenterSpec } from "./spec";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈137.5°, the sunflower spiral angle
const UP = new THREE.Vector3(0, 1, 0);

export interface CenterPart {
  geometry: THREE.BufferGeometry;
  color: string;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  return "#" + (amount < 0 ? c.multiplyScalar(1 + amount) : c.lerp(new THREE.Color("#ffffff"), amount)).getHexString();
}

/** Small sphere placed at a point. */
function bead(at: THREE.Vector3, radius: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, 8, 6).translate(at.x, at.y, at.z);
}

/** Thin cylinder from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(radius, radius, len, 6, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  return g.translate(a.x, a.y, a.z);
}

function merged(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (list.length === 0) return null;
  const g = mergeGeometries(list);
  list.forEach((x) => x.dispose());
  return g;
}

export function buildCenter(spec: CenterSpec): CenterPart[] {
  const r = spec.size / 2;
  const n = Math.round(spec.density);
  const parts: CenterPart[] = [];
  const p = new THREE.Vector3();

  if (spec.type === "disc") {
    // Dome; height = how much it bulges. Florets cover it in a sunflower spiral.
    const h = Math.max(spec.height, 0.004);
    const dome = new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1);
    parts.push({ geometry: dome, color: shade(spec.color, -0.45) });

    const fr = (r / Math.sqrt(Math.max(n, 1))) * 0.75;
    const florets: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const rr = r * 0.95 * Math.sqrt((i + 0.5) / n);
      const a = i * GOLDEN_ANGLE;
      p.set(rr * Math.cos(a), h * Math.sqrt(Math.max(0, 1 - (rr / r) ** 2)), rr * Math.sin(a));
      florets.push(bead(p, fr));
    }
    const g = merged(florets);
    if (g) parts.push({ geometry: g, color: spec.color });
  } else if (spec.type === "column") {
    // Upright cone-like column (e.g. coneflower, calla); florets spiral up its side.
    const h = Math.max(spec.height, 0.015);
    const rBottom = r * 0.5;
    const rTop = r * 0.3;
    const column = new THREE.CylinderGeometry(rTop, rBottom, h, 24).translate(0, h / 2, 0);
    const cap = new THREE.SphereGeometry(rTop, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h, 0);
    parts.push({ geometry: merged([column, cap])!, color: shade(spec.color, -0.45) });

    const florets: THREE.BufferGeometry[] = [];
    const fr = Math.sqrt((2 * Math.PI * rBottom * h) / Math.max(n, 1)) * 0.4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const rr = THREE.MathUtils.lerp(rBottom, rTop, t);
      const a = i * GOLDEN_ANGLE;
      p.set(rr * Math.cos(a), t * h, rr * Math.sin(a));
      florets.push(bead(p, fr));
    }
    const g = merged(florets);
    if (g) parts.push({ geometry: g, color: spec.color });
  } else {
    // Stamens (雄蕊): thin filaments with anthers at the tips, fanning out around a central pistil (雌蕊).
    const h = Math.max(spec.height, 0.02);
    const base = new THREE.SphereGeometry(r * 0.35, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1);
    parts.push({ geometry: base, color: shade(spec.color, -0.3) });

    const w = Math.max(0.0007, r * 0.025);
    const filaments: THREE.BufferGeometry[] = [];
    const anthers: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const s = Math.sqrt((i + 0.5) / n);
      const a = i * GOLDEN_ANGLE;
      const from = new THREE.Vector3(r * 0.3 * s * Math.cos(a), 0, r * 0.3 * s * Math.sin(a));
      const reach = r * (0.3 + 0.7 * s); // outer stamens lean further out
      const tip = new THREE.Vector3(reach * Math.cos(a), h * (1 - 0.25 * s), reach * Math.sin(a));
      filaments.push(rod(from, tip, w));
      anthers.push(bead(tip, w * 2.6));
    }
    // Pistil: a slightly thicker, taller stalk in the middle with a stigma on top.
    const pistilTop = new THREE.Vector3(0, h * 1.15, 0);
    const pistil = [rod(new THREE.Vector3(), pistilTop, w * 2), bead(pistilTop, w * 4)];

    const f = merged(filaments);
    const an = merged(anthers);
    if (f) parts.push({ geometry: f, color: shade(spec.color, 0.65) });
    if (an) parts.push({ geometry: an, color: spec.color });
    parts.push({ geometry: merged(pistil)!, color: "#9cc46a" });
  }
  return parts;
}
