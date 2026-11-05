// Fused (融合): shapes melted into one smooth "blobby" surface, like Blender metaballs.
// Every piece is a signed distance function (SDF: negative inside, positive outside); pieces are combined with a
// *smooth* minimum so joins get rounded fillets, and the result is turned into a mesh with three.js MarchingCubes.
//
// Used two ways:
//   - melt() for any part's pieces (Build = Fused, see build.ts): one ellipsoid per piece
//   - buildFusedFlower() for petals with "whole flower": a center ball, one ellipsoid per petal (same ring
//     placement as petals, pushed out by `stalk`) and a tapered stalk to each petal, instanced on flower heads.
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import type { BuildSpec, PetalSpec } from "./spec";
import { petalPlacements } from "./petal";
import { ringMatrix } from "./assemble";

/** Polynomial smooth minimum (k = blend radius in meters). k = 0 → plain min. */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export interface SdfPiece {
  min: THREE.Vector3; // bounding box (grown by the blend radius)
  max: THREE.Vector3;
  sdf: (x: number, y: number, z: number) => number;
}

export function ballPiece(c: THREE.Vector3, r: number, k: number): SdfPiece {
  return {
    sdf: (x, y, z) => Math.hypot(x - c.x, y - c.y, z - c.z) - r,
    min: c.clone().subScalar(r + k),
    max: c.clone().addScalar(r + k),
  };
}

/** Ellipsoid at `center`, turned by `quat`, with half-sizes `r` (approximate distance, fine for blending). */
export function ellipsoidPiece(center: THREE.Vector3, quat: THREE.Quaternion, r: THREE.Vector3, k: number): SdfPiece {
  const inv = new THREE.Matrix4().compose(center, quat, new THREE.Vector3(1, 1, 1)).invert();
  const e = inv.elements;
  const ext = Math.max(r.x, r.y, r.z) + k;
  return {
    sdf: (x, y, z) => {
      const lx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const ly = e[1] * x + e[5] * y + e[9] * z + e[13];
      const lz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const k0 = Math.hypot(lx / r.x, ly / r.y, lz / r.z);
      const k1 = Math.hypot(lx / (r.x * r.x), ly / (r.y * r.y), lz / (r.z * r.z));
      return k1 === 0 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
    },
    min: center.clone().subScalar(ext),
    max: center.clone().addScalar(ext),
  };
}

/** Stalk from a (radius ra) to b (radius rb), tapering. */
export function stalkPiece(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, k: number): SdfPiece {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const len2 = bax * bax + bay * bay + baz * baz || 1;
  const box = new THREE.Box3().setFromPoints([a, b]).expandByScalar(Math.max(ra, rb) + k);
  return {
    sdf: (x, y, z) => {
      const px = x - a.x, py = y - a.y, pz = z - a.z;
      const t = Math.min(1, Math.max(0, (px * bax + py * bay + pz * baz) / len2));
      return Math.hypot(px - bax * t, py - bay * t, pz - baz * t) - (ra + (rb - ra) * t);
    },
    min: box.min,
    max: box.max,
  };
}

// MarchingCubes keeps big buffers; reuse one per resolution instead of reallocating on every slider move.
const MAX_POLYS = 150000;
const cubes = new Map<number, MarchingCubes>();
function getCubes(res: number): MarchingCubes {
  let mc = cubes.get(res);
  if (!mc) {
    mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, MAX_POLYS);
    mc.isolation = 0;
    cubes.set(res, mc);
  }
  return mc;
}

/**
 * Smooth-unions `pieces` (blend radius k) on a detail³ grid and returns the surface as a plain geometry
 * (positions + normals, in the pieces' own space). Each piece is only evaluated inside its bounding box.
 */
export function melt(pieces: SdfPiece[], k: number, detail: number): THREE.BufferGeometry {
  // Grid covering every piece (a cube, since MarchingCubes works on a cube).
  const bounds = new THREE.Box3();
  for (const p of pieces) bounds.expandByPoint(p.min).expandByPoint(p.max);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const res = Math.round(detail);
  const mc = getCubes(res);
  // Cells 1 … res-2 are polygonized; leave a margin so the shape never touches the grid edge.
  const half = (Math.max(size.x, size.y, size.z) / 2) * (res / (res - 4)) || 1e-3;
  const toWorld = (i: number, c: number) => c + ((i - res / 2) / (res / 2)) * half;
  const toCell = (w: number, c: number) => ((w - c) / half) * (res / 2) + res / 2;

  // Signed distance per grid point: start "far outside", then smooth-union every piece inside its box.
  const FAR = 10 * half;
  const dist = new Float32Array(res * res * res).fill(FAR);
  for (const p of pieces) {
    const x0 = Math.max(0, Math.floor(toCell(p.min.x, center.x))), x1 = Math.min(res - 1, Math.ceil(toCell(p.max.x, center.x)));
    const y0 = Math.max(0, Math.floor(toCell(p.min.y, center.y))), y1 = Math.min(res - 1, Math.ceil(toCell(p.max.y, center.y)));
    const z0 = Math.max(0, Math.floor(toCell(p.min.z, center.z))), z1 = Math.min(res - 1, Math.ceil(toCell(p.max.z, center.z)));
    for (let z = z0; z <= z1; z++) {
      const wz = toWorld(z, center.z);
      for (let y = y0; y <= y1; y++) {
        const wy = toWorld(y, center.y);
        const row = z * res * res + y * res;
        for (let x = x0; x <= x1; x++) {
          const q = row + x;
          dist[q] = smin(dist[q], p.sdf(toWorld(x, center.x), wy, wz), k);
        }
      }
    }
  }

  // MarchingCubes: field > isolation (0) = inside, so field = −distance. Normals come from the field.
  for (let q = 0; q < dist.length; q++) mc.field[q] = -dist[q];
  mc.normal_cache.fill(0);
  mc.update();

  // Copy the triangles out (MarchingCubes works in −1…1).
  const n = mc.count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = center.x + mc.positionArray[i * 3] * half;
    pos[i * 3 + 1] = center.y + mc.positionArray[i * 3 + 1] * half;
    pos[i * 3 + 2] = center.z + mc.positionArray[i * 3 + 2] * half;
    v.set(mc.normalArray[i * 3], mc.normalArray[i * 3 + 1], mc.normalArray[i * 3 + 2]).normalize();
    v.toArray(nrm, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * Whole fused flower in flower-local space (+Y = flower axis), with vertex colors from the petal color and aAlong
 * from the center outward. Petal ellipsoids use the build's width / thickness (fractions of petal length).
 */
export function buildFusedFlower(petals: PetalSpec, b: BuildSpec, innerRadius: number, centerRadius: number): THREE.BufferGeometry {
  const L = petals.size;
  const k = b.blend * L * 0.35; // blend radius
  const pieces: SdfPiece[] = [ballPiece(new THREE.Vector3(), centerRadius, k)];
  const r = new THREE.Vector3(L / 2, (L * b.thickness) / 2, (L * b.width) / 2);
  const local = new THREE.Vector3(L / 2, 0, 0); // ellipsoid center in petal space (petal grows along +X)
  const tips: THREE.Vector3[] = [];
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  for (const p of petalPlacements(petals, innerRadius + b.stalk)) {
    const m = ringMatrix(p);
    m.decompose(pos, quat, scl);
    const c = local.clone().applyMatrix4(m);
    tips.push(c);
    pieces.push(ellipsoidPiece(c, quat, r.clone().multiply(scl), k));
    // Stalk: from the center (at this layer's height) to the petal center.
    pieces.push(stalkPiece(new THREE.Vector3(0, p.height, 0), c, b.stalkWidth, b.stalkWidth * 0.6, k));
  }

  const g = melt(pieces, k, b.detail);
  // "Part" colors: the petal color, a little darker toward the center. aAlong = distance from the axis (center →
  // petal tips), so Material → Color "Along" colors the flower from the middle outward.
  const P = g.getAttribute("position");
  const col = new Float32Array(P.count * 3), al = new Float32Array(P.count);
  const c1 = new THREE.Color(petals.color).multiplyScalar(0.7), c2 = new THREE.Color(petals.color), c = new THREE.Color();
  const reach = tips.reduce((m, t) => Math.max(m, Math.hypot(t.x, t.z)), 0) || 1;
  for (let i = 0; i < P.count; i++) {
    const t = Math.min(1, Math.hypot(P.getX(i), P.getZ(i)) / reach);
    c.copy(c1).lerp(c2, THREE.MathUtils.smoothstep(t, 0.3, 0.8));
    c.toArray(col, i * 3);
    al[i] = t;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aAlong", new THREE.BufferAttribute(al, 1));
  return g;
}
