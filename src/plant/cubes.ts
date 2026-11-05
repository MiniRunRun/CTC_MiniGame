// Box builds (Form → Build 构造): rebuild any part's surface out of boxes. Two looks:
//
//   Blocks 积木 (`blocks`, buildBlocks): many small, equal cubes tiling the surface; ONE gradient runs along the
//     whole part (color → color2), so each cube carries a small piece of it. Lego/voxel feel.
//   Cubes 立方体 (`cubes`, buildCubes): few BIG boxes of mixed sizes and proportions, loosely following the part,
//     slightly tilted and overlapping; EACH box has its own full multi-color gradient (5-color palette, each box
//     starting at a different point in it). From the user's references: big gradient cubes (orange → pink →
//     lavender → olive → dark green), scattered pastel boxes, and flat-color overlapping rectangles (gradient 0).
//
// Both work on the finished geometry of any part (petal, leaf, sepal, stem, bud, center, fused flower):
//   1. scatter points evenly over the surface (per triangle, by area)
//   2. bucket them into a 3D grid → one box per occupied cell (both faces of a thin petal fall into one cell)
//   3. place a box per cell, turned to lie on the surface and point along the part's length ("follow"),
//      or axis-aligned at the cell center ("grid", blocks only)
// The result stays in the part's own space, so materials ("length" input) and animation work unchanged.
import * as THREE from "three";
import type { CubeSpec } from "./spec";

/** Which way the part's length runs: blades along +X, stems/buds/centers along +Y, fused flowers outward. */
export type CubeAxis = "x" | "y" | "radial";

export interface CubifyInput {
  spec: CubeSpec;
  color: string; // Blocks: gradient start (the part's own color)
  axis: CubeAxis;
}

/** Small deterministic random numbers, so the same settings always give the same boxes. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

interface Cell {
  p: THREE.Vector3; // sum of sample points (÷ count = average)
  n: THREE.Vector3; // sum of normals
  count: number;
  key: string; // "ix,iy,iz"
}

interface Surface {
  cells: Cell[];
  along: (p: THREE.Vector3) => number; // position along the part's length
  lo: number;
  span: number;
}

const alongFn = (axis: CubeAxis) => (p: THREE.Vector3) =>
  axis === "x" ? p.x : axis === "y" ? p.y : Math.hypot(p.x, p.z);

/** Length of the part along its axis (for sizing boxes relative to the part). */
function extent(source: THREE.BufferGeometry, axis: CubeAxis) {
  const pos = source.getAttribute("position");
  const along = alongFn(axis);
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const t = along(v.fromBufferAttribute(pos, i));
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  return { lo, span: hi - lo || 1 };
}

/** Steps 1–2: surface samples bucketed into cells of `cell` meters. */
function sampleSurface(source: THREE.BufferGeometry, cell: number, axis: CubeAxis): Surface {
  const g = source.index ? source.toNonIndexed() : source;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const { lo, span } = extent(g, axis);

  const cells = new Map<string, Cell>();
  const rand = rng(12345);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const spacing = cell * 0.5; // a few samples per cell so no cell along the surface is missed
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
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
      let cl = cells.get(key);
      if (!cl) cells.set(key, (cl = { p: new THREE.Vector3(), n: new THREE.Vector3(), count: 0, key }));
      cl.p.add(p);
      // Both faces of a thin blade land in one cell with opposite normals; align them before summing.
      if (cl.count > 0 && n.dot(cl.n) < 0) n.negate();
      cl.n.add(n);
      cl.count++;
    }
  }
  if (g !== source) g.dispose();
  return { cells: [...cells.values()], along: alongFn(axis), lo, span };
}

/** Rotation that lies on the surface (Y = normal) and points along the part's length (X). */
function surfaceQuaternion(cell: Cell, center: THREE.Vector3, axis: CubeAxis, out: THREE.Quaternion) {
  const ty = cell.n.clone().normalize();
  if (ty.lengthSq() < 0.5) ty.set(0, 1, 0);
  const tx = axis === "radial" ? new THREE.Vector3(center.x, 0, center.z) : axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  if (tx.lengthSq() < 1e-12) tx.set(1, 0, 0);
  tx.addScaledVector(ty, -tx.dot(ty));
  if (tx.lengthSq() < 1e-8) tx.set(0, 0, 1).addScaledVector(ty, -ty.z);
  tx.normalize();
  const tz = new THREE.Vector3().crossVectors(tx, ty);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, tz));
}

/**
 * Writes boxes into one geometry. For each box: its matrix, and a function giving the color of a template
 * corner (template corners are in −0.5…0.5, before the matrix).
 */
function writeBoxes(
  template: THREE.BufferGeometry,
  boxes: { matrix: THREE.Matrix4; color: (local: THREE.Vector3, world: THREE.Vector3, out: THREE.Color) => void }[],
): THREE.BufferGeometry {
  const tPos = template.getAttribute("position"), tNrm = template.getAttribute("normal"), tIdx = template.index!;
  const vPer = tPos.count, iPer = tIdx.count;
  const outPos = new Float32Array(boxes.length * vPer * 3);
  const outNrm = new Float32Array(boxes.length * vPer * 3);
  const outCol = new Float32Array(boxes.length * vPer * 3);
  const outIdx = new Uint32Array(boxes.length * iPer);
  const local = new THREE.Vector3(), world = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  boxes.forEach((box, bi) => {
    const nm = new THREE.Matrix3().getNormalMatrix(box.matrix);
    for (let k = 0; k < vPer; k++) {
      const o = (bi * vPer + k) * 3;
      local.fromBufferAttribute(tPos, k);
      world.copy(local).applyMatrix4(box.matrix);
      world.toArray(outPos, o);
      box.color(local, world, col);
      col.toArray(outCol, o);
      n.fromBufferAttribute(tNrm, k).applyMatrix3(nm).normalize();
      n.toArray(outNrm, o);
    }
    for (let k = 0; k < iPer; k++) outIdx[bi * iPer + k] = tIdx.getX(k) + bi * vPer;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(outNrm, 3));
  out.setAttribute("color", new THREE.BufferAttribute(outCol, 3));
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));
  out.computeBoundingSphere();
  return out;
}

const BLOCK = new THREE.BoxGeometry(1, 1, 1); // 24 corners (flat faces)
const CUBE_SMOOTH = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8); // finer faces so a 5-color gradient shows inside a box

/** Blocks 积木: small equal cubes, one gradient along the whole part. */
export function buildBlocks(source: THREE.BufferGeometry, input: CubifyInput): THREE.BufferGeometry {
  const { spec, axis } = input;
  const size = spec.size;
  const s = sampleSurface(source, size, axis);
  const c1 = new THREE.Color(input.color), c2 = new THREE.Color(spec.color2);
  const side = size * (1 - spec.gap);
  const scale = new THREE.Vector3(side, side, side);
  const boxes = s.cells.map((cell) => {
    const center = new THREE.Vector3(), q = new THREE.Quaternion();
    if (spec.align === "grid") {
      const [ix, iy, iz] = cell.key.split(",").map(Number);
      center.set((ix + 0.5) * size, (iy + 0.5) * size, (iz + 0.5) * size);
    } else {
      center.copy(cell.p).divideScalar(cell.count);
      surfaceQuaternion(cell, center, axis, q);
    }
    return {
      matrix: new THREE.Matrix4().compose(center, q, scale),
      color: (_l: THREE.Vector3, w: THREE.Vector3, out: THREE.Color) =>
        out.copy(c1).lerp(c2, THREE.MathUtils.clamp((s.along(w) - s.lo) / s.span, 0, 1)),
    };
  });
  return writeBoxes(BLOCK, boxes);
}

/** Smooth color along a 5-color palette, t wraps around (ping-pong) so every box can start anywhere. */
function palette(colors: THREE.Color[], t: number, out: THREE.Color) {
  let x = ((t % 2) + 2) % 2;
  if (x > 1) x = 2 - x;
  const f = x * (colors.length - 1);
  const i = Math.min(Math.floor(f), colors.length - 2);
  const k = THREE.MathUtils.smoothstep(f - i, 0, 1);
  return out.copy(colors[i]).lerp(colors[i + 1], k);
}

/** Cubes 立方体: few big boxes, mixed sizes, each with its own full palette gradient. */
export function buildCubes(source: THREE.BufferGeometry, input: CubifyInput): THREE.BufferGeometry {
  const { spec, axis } = input;
  const { span } = extent(source, axis);
  // Box size from how many boxes should run along the part.
  const cell = span / Math.max(1, spec.count);
  const s = sampleSurface(source, cell, axis);
  const colors = spec.palette.map((h) => new THREE.Color(h));
  const rand = rng(777 + spec.count * 31);
  const v = spec.variation, tilt = spec.tilt * 0.7; // tilt: up to ~40° each way
  const boxes = s.cells.map((cl) => {
    const center = cl.p.clone().divideScalar(cl.count);
    const q = surfaceQuaternion(cl, center, axis, new THREE.Quaternion());
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 2 * tilt, (rand() - 0.5) * 2 * tilt, (rand() - 0.5) * 2 * tilt)));
    // Chunky boxes, a bit bigger than their cell so neighbors overlap like the references.
    const r = () => 1 + v * (rand() * 1.4 - 0.6);
    const scale = new THREE.Vector3(cell * 1.15 * r(), cell * 0.75 * r(), cell * 1.0 * r());
    // Each box: its own start in the palette, its own gradient direction (mostly along its length).
    const start = rand() * 2;
    const dir = new THREE.Vector3(1, (rand() - 0.5) * 1.2, (rand() - 0.5) * 0.8).normalize();
    return {
      matrix: new THREE.Matrix4().compose(center, q, scale),
      color: (l: THREE.Vector3, _w: THREE.Vector3, out: THREE.Color) => palette(colors, start + spec.gradient * l.dot(dir) * 1.6, out),
    };
  });
  return writeBoxes(spec.gradient > 0 ? CUBE_SMOOTH : BLOCK, boxes);
}

/** Picks the build for `input.spec.build` (only call when it isn't "smooth"). */
export function cubify(source: THREE.BufferGeometry, input: CubifyInput): THREE.BufferGeometry {
  return input.spec.build === "cubes" ? buildCubes(source, input) : buildBlocks(source, input);
}
