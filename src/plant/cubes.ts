// Cube build (立方体构造): rebuilds any part's surface out of small gradient-colored cubes.
// Works on the finished geometry of every part (petal, leaf, sepal, stem, bud, center…), so the cubes always
// follow that part's own shape and curve:
//   1. scatter points evenly over the surface (per triangle, by area)
//   2. bucket them into a 3D grid with cells of the cube size → at most one cube per cell, so cubes tile the
//      surface without piling up (both faces of a thin petal fall into the same cell → one layer of cubes)
//   3. one cube per cell:
//        follow 顺着走势 → at the surface point, turned to lie on the surface and point along the part's length
//        grid   网格     → at the cell center, axis-aligned (blocky, voxel look)
//   4. every cube corner is colored by where it sits along the part (color → color2), so the gradient runs
//      continuously across the cubes and each cube carries its own little piece of it
// The result stays in the part's own space, so materials ("length" input) and animation work unchanged.
import * as THREE from "three";
import type { CubeSpec } from "./spec";

/** Which way the part's length runs: blades along +X, stems/buds/centers along +Y, fused flowers outward. */
export type CubeAxis = "x" | "y" | "radial";

export interface CubifyInput {
  spec: CubeSpec;
  color: string; // gradient start (the part's own color)
  axis: CubeAxis;
}

/** Small deterministic random numbers, so the same settings always give the same cubes. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const CUBE = new THREE.BoxGeometry(1, 1, 1); // template: 24 corners (flat faces), 36 indices

export function cubify(source: THREE.BufferGeometry, input: CubifyInput): THREE.BufferGeometry {
  const { spec, axis } = input;
  const size = spec.size;
  const g = source.index ? source.toNonIndexed() : source;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");

  // Where the gradient starts and ends along the part.
  const along = (p: THREE.Vector3) => (axis === "x" ? p.x : axis === "y" ? p.y : Math.hypot(p.x, p.z));
  let lo = Infinity, hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = along(v.fromBufferAttribute(pos, i));
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  const span = hi - lo || 1;

  // 1–2. Scatter points over every triangle and sum them per grid cell.
  type Cell = { p: THREE.Vector3; n: THREE.Vector3; count: number; key: string };
  const cells = new Map<string, Cell>();
  const rand = rng(12345);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const spacing = size * 0.5; // a few samples per cell so no cell along the surface is missed
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    if (nrm) {
      na.fromBufferAttribute(nrm, i);
      nb.fromBufferAttribute(nrm, i + 1);
      nc.fromBufferAttribute(nrm, i + 2);
    }
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
    const samples = Math.min(400, Math.ceil(area / (spacing * spacing)) + 1);
    for (let k = 0; k < samples; k++) {
      // Random point in the triangle (k = 0 is its center, so even tiny triangles count).
      let u = k === 0 ? 1 / 3 : rand(), w = k === 0 ? 1 / 3 : rand();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      p.copy(a).multiplyScalar(1 - u - w).addScaledVector(b, u).addScaledVector(c, w);
      if (nrm) n.copy(na).multiplyScalar(1 - u - w).addScaledVector(nb, u).addScaledVector(nc, w);
      else n.copy(e1).cross(e2);
      const key = `${Math.floor(p.x / size)},${Math.floor(p.y / size)},${Math.floor(p.z / size)}`;
      let cell = cells.get(key);
      if (!cell) cells.set(key, (cell = { p: new THREE.Vector3(), n: new THREE.Vector3(), count: 0, key }));
      cell.p.add(p);
      // Both faces of a thin blade land in one cell with opposite normals; align them before summing.
      if (cell.count > 0 && n.dot(cell.n) < 0) n.negate();
      cell.n.add(n);
      cell.count++;
    }
  }
  if (g !== source) g.dispose();

  // 3–4. One cube per cell.
  const list = [...cells.values()];
  const tPos = CUBE.getAttribute("position"), tNrm = CUBE.getAttribute("normal"), tIdx = CUBE.index!;
  const vPer = tPos.count, iPer = tIdx.count;
  const outPos = new Float32Array(list.length * vPer * 3);
  const outNrm = new Float32Array(list.length * vPer * 3);
  const outCol = new Float32Array(list.length * vPer * 3);
  const outIdx = new Uint32Array(list.length * iPer);
  const c1 = new THREE.Color(input.color), c2 = new THREE.Color(spec.color2), col = new THREE.Color();
  const lengthDir = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const tx = new THREE.Vector3(), ty = new THREE.Vector3(), tz = new THREE.Vector3();
  const side = size * (1 - spec.gap);
  const scale = new THREE.Vector3(side, side, side);
  const center = new THREE.Vector3(), q = new THREE.Quaternion();

  list.forEach((cell, ci) => {
    if (spec.align === "grid") {
      const [ix, iy, iz] = cell.key.split(",").map(Number);
      center.set((ix + 0.5) * size, (iy + 0.5) * size, (iz + 0.5) * size);
      q.identity();
    } else {
      center.copy(cell.p).divideScalar(cell.count);
      // Lie on the surface (local Y = surface normal) and point along the part's length (local X).
      ty.copy(cell.n).normalize();
      if (ty.lengthSq() < 0.5) ty.set(0, 1, 0);
      const dir = axis === "radial" ? tx.set(center.x, 0, center.z) : tx.copy(lengthDir);
      if (dir.lengthSq() < 1e-12) dir.set(1, 0, 0);
      tx.addScaledVector(ty, -tx.dot(ty));
      if (tx.lengthSq() < 1e-8) tx.set(0, 0, 1).addScaledVector(ty, -ty.z);
      tx.normalize();
      tz.crossVectors(tx, ty);
      rot.makeBasis(tx, ty, tz);
      q.setFromRotationMatrix(rot);
    }
    m.compose(center, q, scale);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let k = 0; k < vPer; k++) {
      v.fromBufferAttribute(tPos, k).applyMatrix4(m);
      v.toArray(outPos, (ci * vPer + k) * 3);
      const t = THREE.MathUtils.clamp((along(v) - lo) / span, 0, 1);
      col.copy(c1).lerp(c2, t);
      col.toArray(outCol, (ci * vPer + k) * 3);
      n.fromBufferAttribute(tNrm, k).applyMatrix3(nm).normalize();
      n.toArray(outNrm, (ci * vPer + k) * 3);
    }
    for (let k = 0; k < iPer; k++) outIdx[ci * iPer + k] = tIdx.getX(k) + ci * vPer;
  });

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(outNrm, 3));
  out.setAttribute("color", new THREE.BufferAttribute(outCol, 3));
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));
  out.computeBoundingSphere();
  return out;
}
