// Build (构成, Form → Build): rebuilds any part's finished geometry out of pieces — the "copy to points" step of
// Blender Geometry Nodes / Houdini. One system for every part (petal, leaf, sepal, stem, bud, center, receptacle):
//
//   1. scatter points evenly over the part's surface (per triangle, by area)
//   2. bucket them into slots: a 3D grid with cells of (part length ÷ count); count 1 = one slot for the whole part
//   3. one piece per slot — at the slot's average surface point, lying on the surface and pointing along the
//      part ("follow"), or axis-aligned at the cell center ("grid"); size = slot × scale × (1, thickness, width),
//      with random variation and tilt
//   4. then either
//        pieces 拼块 → draw a primitive (cube, sphere, gem, cone, torus, capsule) per piece, or
//        fused 融合  → turn each piece into an ellipsoid and melt them together (fused.ts)
//   5. color every corner: the part's own colors / color → color2 along the part / by facing / each piece its own
//      palette gradient (see PieceColor in spec.ts)
//
// The old features are presets of this (spec.ts buildPreset): Abstract = count 1 fitted primitive,
// Blocks = many small cubes colored along the part, Cubes = few big tilted boxes with palette gradients.
// The result stays in the part's own space, so materials ("length" input) and animation work unchanged.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildSpec, Primitive } from "./spec";
import { ellipsoidPiece, melt } from "./fused";
import { pingpong, sampleRamp, wrap01 } from "./ramp";

/** Which way the part's length runs: blades along +X, stems/buds/centers along +Y, fused flowers outward. */
export type BuildAxis = "x" | "y" | "radial";

export interface BuildInput {
  spec: BuildSpec;
  color: string; // the part's own color (fallback when the geometry has no vertex colors; along/facing start)
  axis: BuildAxis;
}

/** Small deterministic random numbers, so the same settings always give the same pieces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const alongFn = (axis: BuildAxis) => (p: THREE.Vector3) =>
  axis === "x" ? p.x : axis === "y" ? p.y : Math.hypot(p.x, p.z);

// ---------------------------------------------------------------------------------------------------------------
// Steps 1–3: where the pieces go

interface Slot {
  p: THREE.Vector3; // sum of sample points
  n: THREE.Vector3; // sum of normals (aligned so both faces of a thin blade add up)
  c: THREE.Color; // sum of the part's colors there
  count: number;
  key: string; // grid cell "ix,iy,iz"
}

interface Piece {
  center: THREE.Vector3;
  quat: THREE.Quaternion;
  dims: THREE.Vector3; // full size along the piece's own X (length), Y (thickness), Z (width)
  color: THREE.Color; // the part's own color at this piece
  start: number; // piece palette: where in the palette this piece starts
  dir: THREE.Vector3; // piece palette: gradient direction in the piece's own space
}

function sampleSlots(source: THREE.BufferGeometry, cell: number, single: boolean, fallback: THREE.Color): Slot[] {
  const g = source.index ? source.toNonIndexed() : source;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const colA = g.getAttribute("color");
  const slots = new Map<string, Slot>();
  const rand = rng(12345);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const col = new THREE.Color();
  const spacing = Math.min(cell, 1) * 0.5; // a few samples per slot so none along the surface is missed
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    if (nrm) {
      na.fromBufferAttribute(nrm, i);
      nb.fromBufferAttribute(nrm, i + 1);
      nc.fromBufferAttribute(nrm, i + 2);
    }
    if (colA) col.fromBufferAttribute(colA, i);
    else col.copy(fallback);
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
    const samples = single ? 1 : Math.min(400, Math.ceil(area / (spacing * spacing)) + 1);
    for (let k = 0; k < samples; k++) {
      // Random point in the triangle (k = 0 is its center, so even tiny triangles count).
      let u = k === 0 ? 1 / 3 : rand(), w = k === 0 ? 1 / 3 : rand();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      p.copy(a).multiplyScalar(1 - u - w).addScaledVector(b, u).addScaledVector(c, w);
      if (nrm) n.copy(na).multiplyScalar(1 - u - w).addScaledVector(nb, u).addScaledVector(nc, w);
      else n.copy(e1).cross(e2);
      const key = single ? "0,0,0" : `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
      let s = slots.get(key);
      if (!s) slots.set(key, (s = { p: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Color(0, 0, 0), count: 0, key }));
      // Weight by area when there's one sample per triangle (single slot), so the center is the surface's center.
      const wgt = single ? area : 1;
      s.p.addScaledVector(p, wgt);
      if (s.count > 0 && n.dot(s.n) < 0) n.negate(); // both faces of a thin blade: align before summing
      s.n.addScaledVector(n, wgt);
      s.c.r += col.r * wgt; s.c.g += col.g * wgt; s.c.b += col.b * wgt;
      s.count += wgt;
    }
  }
  if (g !== source) g.dispose();
  return [...slots.values()].filter((s) => s.count > 0);
}

/** Rotation that lies on the surface (Y = normal) and points along the part's length (X). */
function surfaceQuaternion(normal: THREE.Vector3, center: THREE.Vector3, axis: BuildAxis): THREE.Quaternion {
  const ty = normal.clone().normalize();
  if (ty.lengthSq() < 0.5) ty.set(0, 1, 0);
  const tx = axis === "radial" ? new THREE.Vector3(center.x, 0, center.z) : axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  if (tx.lengthSq() < 1e-12) tx.set(1, 0, 0);
  tx.addScaledVector(ty, -tx.dot(ty));
  if (tx.lengthSq() < 1e-8) tx.set(0, 0, 1).addScaledVector(ty, -ty.z);
  tx.normalize();
  const tz = new THREE.Vector3().crossVectors(tx, ty);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, tz));
}

function placePieces(source: THREE.BufferGeometry, input: BuildInput, span: number): Piece[] {
  const { spec, axis } = input;
  const single = spec.count <= 1;
  const cell = single ? span : span / spec.count;
  const slots = sampleSlots(source, cell, single, new THREE.Color(input.color));
  const rand = rng(777 + spec.count * 31);
  const tilt = spec.tilt * 0.7; // up to ~40° each way
  const grid = spec.align === "grid" && spec.mode === "pieces" && !single;
  return slots.map((s) => {
    let center: THREE.Vector3, quat: THREE.Quaternion;
    if (grid) {
      const [ix, iy, iz] = s.key.split(",").map(Number);
      center = new THREE.Vector3((ix + 0.5) * cell, (iy + 0.5) * cell, (iz + 0.5) * cell);
      quat = new THREE.Quaternion();
    } else {
      center = s.p.clone().divideScalar(s.count);
      quat = surfaceQuaternion(s.n, center, axis);
    }
    if (tilt > 0) {
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 2 * tilt, (rand() - 0.5) * 2 * tilt, (rand() - 0.5) * 2 * tilt)));
    }
    const r = () => 1 + spec.variation * (rand() * 1.4 - 0.6);
    const base = cell * spec.scale;
    const dims = new THREE.Vector3(base * r(), base * spec.thickness * r(), base * spec.width * r());
    const color = new THREE.Color(s.c.r / s.count, s.c.g / s.count, s.c.b / s.count);
    const start = rand() * 2;
    const dir = new THREE.Vector3(1, (rand() - 0.5) * 1.2, (rand() - 0.5) * 0.8).normalize();
    return { center, quat, dims, color, start, dir };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Step 4a: primitives

/** Unit primitive (fits −0.5…0.5, length along X), normals ready; cached per primitive and detail. */
const templates = new Map<string, THREE.BufferGeometry>();
function template(p: Primitive, fine: boolean): THREE.BufferGeometry {
  const key = `${p}-${fine}`;
  let g = templates.get(key);
  if (g) return g;
  switch (p) {
    case "cube": g = new THREE.BoxGeometry(1, 1, 1, fine ? 8 : 1, fine ? 8 : 1, fine ? 8 : 1); break;
    case "sphere": g = new THREE.SphereGeometry(1, 20, 14); break;
    case "gem": g = new THREE.IcosahedronGeometry(1, 0); break; // faceted, low-poly look
    case "cone": g = new THREE.ConeGeometry(1, 2, 20).rotateZ(-Math.PI / 2); break; // tip points outward (+X)
    case "torus": g = new THREE.TorusGeometry(1, 0.35, 12, 28).rotateX(Math.PI / 2); break; // lies flat
    case "capsule": g = new THREE.CapsuleGeometry(0.5, 1, 6, 14).rotateZ(-Math.PI / 2); break; // long axis outward
  }
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  const mid = b.getCenter(new THREE.Vector3());
  g.translate(-mid.x, -mid.y, -mid.z).scale(1 / size.x, 1 / size.y, 1 / size.z);
  g.deleteAttribute("uv");
  if (p === "cube") {
    // Box normals are already per-face and correct.
  } else if (p === "gem") {
    g.deleteAttribute("normal");
    g = g.toNonIndexed();
    g.computeVertexNormals(); // faceted
  } else {
    g.deleteAttribute("normal");
    g = mergeVertices(g); // weld seams so smooth shapes have no visible seam line
    g.computeVertexNormals();
  }
  templates.set(key, g);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Step 5: colors

interface Colorer {
  /** Color for a corner: its spot in the piece's own space (−0.5…0.5), in part space, its normal, and the piece. */
  (local: THREE.Vector3, world: THREE.Vector3, normal: THREE.Vector3, piece: Piece, out: THREE.Color): void;
}

function colorer(input: BuildInput, along: (p: THREE.Vector3) => number, lo: number, span: number): Colorer {
  const s = input.spec;
  const c1 = new THREE.Color(input.color), c2 = new THREE.Color(s.color2);
  const pal = s.palette.map((h) => new THREE.Color(h));
  const two = (t: number, out: THREE.Color) =>
    out.copy(c1).lerp(c2, THREE.MathUtils.smoothstep(pingpong(THREE.MathUtils.clamp(t, 0, 1), s.bands), 0, 1));
  switch (s.colorBy) {
    case "part":
      return (_l, _w, _n, piece, out) => out.copy(piece.color);
    case "along":
      return (_l, w, _n, _p, out) => two((along(w) - lo) / span, out);
    case "facing":
      return (_l, _w, n, _p, out) => two(n.y * 0.5 + 0.5, out);
    case "piece":
      return (l, _w, _n, piece, out) => sampleRamp(pal, wrap01(piece.start + s.gradient * l.dot(piece.dir) * 1.6), out);
  }
}

function writePieces(pieces: Piece[], tpl: THREE.BufferGeometry, color: Colorer): THREE.BufferGeometry {
  const tPos = tpl.getAttribute("position"), tNrm = tpl.getAttribute("normal"), tIdx = tpl.index;
  const vPer = tPos.count, iPer = tIdx ? tIdx.count : vPer;
  const outPos = new Float32Array(pieces.length * vPer * 3);
  const outNrm = new Float32Array(pieces.length * vPer * 3);
  const outCol = new Float32Array(pieces.length * vPer * 3);
  const outIdx = new Uint32Array(pieces.length * iPer);
  const local = new THREE.Vector3(), world = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  pieces.forEach((pc, pi) => {
    m.compose(pc.center, pc.quat, pc.dims);
    nm.getNormalMatrix(m);
    for (let k = 0; k < vPer; k++) {
      const o = (pi * vPer + k) * 3;
      local.fromBufferAttribute(tPos, k);
      world.copy(local).applyMatrix4(m);
      world.toArray(outPos, o);
      n.fromBufferAttribute(tNrm, k).applyMatrix3(nm).normalize();
      n.toArray(outNrm, o);
      color(local, world, n, pc, col);
      col.toArray(outCol, o);
    }
    for (let k = 0; k < iPer; k++) outIdx[pi * iPer + k] = (tIdx ? tIdx.getX(k) : k) + pi * vPer;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(outNrm, 3));
  out.setAttribute("color", new THREE.BufferAttribute(outCol, 3));
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Step 4b: fused — the pieces as ellipsoids, melted

function fusePieces(pieces: Piece[], spec: BuildSpec, color: Colorer): THREE.BufferGeometry {
  const avg = pieces.reduce((m, p) => m + (p.dims.x + p.dims.y + p.dims.z) / 3, 0) / Math.max(1, pieces.length);
  const k = spec.blend * avg * 0.8;
  const g = melt(pieces.map((p) => ellipsoidPiece(p.center, p.quat, p.dims.clone().multiplyScalar(0.5), k)), k, spec.detail);
  // Each surface point takes its color from the nearby pieces (closer = stronger), so colors blend at the joins.
  const P = g.getAttribute("position"), N = g.getAttribute("normal");
  const col = new Float32Array(P.count * 3);
  const w = new THREE.Vector3(), n = new THREE.Vector3(), local = new THREE.Vector3(), c = new THREE.Color(), sum = new THREE.Color();
  const inv = pieces.map((p) => new THREE.Matrix4().compose(p.center, p.quat, p.dims).invert());
  const reach2 = (avg * 2) ** 2;
  for (let i = 0; i < P.count; i++) {
    w.fromBufferAttribute(P, i);
    n.fromBufferAttribute(N, i);
    sum.setRGB(0, 0, 0);
    let total = 0;
    pieces.forEach((p, pi) => {
      const d2 = w.distanceToSquared(p.center) + 1e-9;
      if (d2 > reach2 && total > 0) return; // far pieces barely count; skip them (big speed-up with many pieces)
      const wt = 1 / (d2 * d2);
      local.copy(w).applyMatrix4(inv[pi]);
      color(local, w, n, p, c);
      sum.r += c.r * wt; sum.g += c.g * wt; sum.b += c.b * wt;
      total += wt;
    });
    col[i * 3] = sum.r / total;
    col[i * 3 + 1] = sum.g / total;
    col[i * 3 + 2] = sum.b / total;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Rebuilds `source` as pieces or a fused blob (only call when spec.mode isn't "smooth"). */
export function buildPart(source: THREE.BufferGeometry, input: BuildInput): THREE.BufferGeometry {
  const along = alongFn(input.axis);
  const pos = source.getAttribute("position");
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const t = along(v.fromBufferAttribute(pos, i));
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  const span = hi - lo || 1e-3;
  const pieces = placePieces(source, input, span);
  const color = colorer(input, along, lo, span);
  if (input.spec.mode === "fused") return fusePieces(pieces, input.spec, color);
  // A palette gradient inside one piece needs finer faces (cube corners alone can't show 5 colors).
  const fine = input.spec.colorBy === "piece" && input.spec.gradient > 0;
  return writePieces(pieces, template(input.spec.primitive, fine), color);
}
