// Builds the flower center (花心): disc, column, or a cluster of stamens around a pistil.
// Small repeated parts (florets, stamens) are "stamped" from one template shape into a single
// geometry per color, so even hundreds of them cost one draw call and rebuild in a few ms.
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

// Unit templates, transformed into place by a matrix per copy.
const BEAD = new THREE.SphereGeometry(1, 8, 6); // radius 1
const ROD = new THREE.CylinderGeometry(1, 1, 1, 6, 1).translate(0, 0.5, 0); // radius 1, from y=0 to y=1

/** Matrix that places a small sphere of `radius` at `at`. */
function bead(at: THREE.Vector3, radius: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(at, new THREE.Quaternion(), new THREE.Vector3(radius, radius, radius));
}

/** Matrix that places a thin cylinder of `radius` from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.Matrix4 {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return new THREE.Matrix4().compose(a, q, new THREE.Vector3(radius, len, radius));
}

/**
 * Copies `template` once per matrix into one geometry (positions + normals + index).
 * Much faster than creating hundreds of geometries and merging them.
 */
function stamp(template: THREE.BufferGeometry, matrices: THREE.Matrix4[]): THREE.BufferGeometry | null {
  const n = matrices.length;
  if (n === 0) return null;
  const pos = template.attributes.position.array as ArrayLike<number>;
  const nor = template.attributes.normal.array as ArrayLike<number>;
  const idx = template.index!.array as ArrayLike<number>;
  const vc = template.attributes.position.count;
  const ic = idx.length;
  const P = new Float32Array(vc * 3 * n);
  const N = new Float32Array(vc * 3 * n);
  const I = new Uint32Array(ic * n);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (let k = 0; k < n; k++) {
    const m = matrices[k];
    nm.getNormalMatrix(m);
    for (let i = 0; i < vc; i++) {
      const o = (k * vc + i) * 3;
      v.fromArray(pos, i * 3).applyMatrix4(m).toArray(P, o);
      v.fromArray(nor, i * 3).applyMatrix3(nm).normalize().toArray(N, o);
    }
    for (let j = 0; j < ic; j++) I[k * ic + j] = idx[j] + k * vc;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
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
    const florets: THREE.Matrix4[] = [];
    for (let i = 0; i < n; i++) {
      const rr = r * 0.95 * Math.sqrt((i + 0.5) / n);
      const a = i * GOLDEN_ANGLE;
      p.set(rr * Math.cos(a), h * Math.sqrt(Math.max(0, 1 - (rr / r) ** 2)), rr * Math.sin(a));
      florets.push(bead(p, fr));
    }
    const g = stamp(BEAD, florets);
    if (g) parts.push({ geometry: g, color: spec.color });
  } else if (spec.type === "column") {
    // Upright cone-like column (e.g. coneflower, calla); florets spiral up its side.
    const h = Math.max(spec.height, 0.015);
    const rBottom = r * 0.5;
    const rTop = r * 0.3;
    const column = new THREE.CylinderGeometry(rTop, rBottom, h, 24).translate(0, h / 2, 0);
    const cap = new THREE.SphereGeometry(rTop, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h, 0);
    parts.push({ geometry: mergeGeometries([column, cap]), color: shade(spec.color, -0.45) });
    column.dispose();
    cap.dispose();

    const florets: THREE.Matrix4[] = [];
    const fr = Math.sqrt((2 * Math.PI * rBottom * h) / Math.max(n, 1)) * 0.4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const rr = THREE.MathUtils.lerp(rBottom, rTop, t);
      const a = i * GOLDEN_ANGLE;
      p.set(rr * Math.cos(a), t * h, rr * Math.sin(a));
      florets.push(bead(p, fr));
    }
    const g = stamp(BEAD, florets);
    if (g) parts.push({ geometry: g, color: spec.color });
  } else {
    // Stamens (雄蕊): thin filaments with anthers at the tips, fanning out around a central pistil (雌蕊).
    const h = Math.max(spec.height, 0.02);
    const base = new THREE.SphereGeometry(r * 0.35, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1);
    parts.push({ geometry: base, color: shade(spec.color, -0.3) });

    const w = Math.max(0.0007, r * 0.025);
    const filaments: THREE.Matrix4[] = [];
    const anthers: THREE.Matrix4[] = [];
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
    const pistilStalk = stamp(ROD, [rod(new THREE.Vector3(), pistilTop, w * 2)])!;
    const stigma = stamp(BEAD, [bead(pistilTop, w * 4)])!;

    const f = stamp(ROD, filaments);
    const an = stamp(BEAD, anthers);
    if (f) parts.push({ geometry: f, color: shade(spec.color, 0.65) });
    if (an) parts.push({ geometry: an, color: spec.color });
    parts.push({ geometry: mergeGeometries([pistilStalk, stigma]), color: "#9cc46a" });
    pistilStalk.dispose();
    stigma.dispose();
  }
  return parts;
}
