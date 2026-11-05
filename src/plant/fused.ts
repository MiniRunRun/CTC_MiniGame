// Fused abstract flower (融合): petals and stalks melted into one smooth "blobby" shape.
// Like Blender metaballs: every piece is a signed distance function (SDF: negative inside, positive outside),
// pieces are combined with a *smooth* minimum so joins get rounded fillets, and the result is turned into a
// mesh with three.js MarchingCubes.
//
// Pieces: a small ball at the center, one ellipsoid per petal (same ring placement as abstract petals, pushed
// out by `stalk`), and one tapered stalk from the center to each petal.
// One flower is built in its own local space and then instanced on every flower head (like the center parts).
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import type { PetalSpec } from "./spec";
import { petalPlacements } from "./petal";
import { ringMatrix } from "./assemble";

/** Polynomial smooth minimum (k = blend radius in meters). k = 0 → plain min. */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

interface Piece {
  min: THREE.Vector3; // bounding box (already grown by the blend radius)
  max: THREE.Vector3;
  sdf: (x: number, y: number, z: number) => number;
}

function ball(c: THREE.Vector3, r: number): Piece["sdf"] {
  return (x, y, z) => Math.hypot(x - c.x, y - c.y, z - c.z) - r;
}

/** Ellipsoid (approximate distance, good enough for blending). `inv` maps world → ellipsoid local space. */
function ellipsoid(inv: THREE.Matrix4, center: THREE.Vector3, r: THREE.Vector3): Piece["sdf"] {
  const e = inv.elements;
  return (x, y, z) => {
    const lx = e[0] * x + e[4] * y + e[8] * z + e[12] - center.x;
    const ly = e[1] * x + e[5] * y + e[9] * z + e[13] - center.y;
    const lz = e[2] * x + e[6] * y + e[10] * z + e[14] - center.z;
    const k0 = Math.hypot(lx / r.x, ly / r.y, lz / r.z);
    const k1 = Math.hypot(lx / (r.x * r.x), ly / (r.y * r.y), lz / (r.z * r.z));
    return k1 === 0 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
  };
}

/** Stalk from a (radius ra) to b (radius rb), tapering. */
function stalk(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number): Piece["sdf"] {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const len2 = bax * bax + bay * bay + baz * baz || 1;
  return (x, y, z) => {
    const px = x - a.x, py = y - a.y, pz = z - a.z;
    const t = Math.min(1, Math.max(0, (px * bax + py * bay + pz * baz) / len2));
    return Math.hypot(px - bax * t, py - bay * t, pz - baz * t) - (ra + (rb - ra) * t);
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

/** Builds one fused flower in flower-local space (+Y = flower axis), with vertex colors color → color2. */
export function buildFusedFlower(spec: PetalSpec, innerRadius: number, centerRadius: number): THREE.BufferGeometry {
  const L = spec.size;
  const k = spec.blend * L * 0.35; // blend radius
  const pieces: Piece[] = [];
  const add = (sdf: Piece["sdf"], c: THREE.Vector3, extent: number) => {
    const g = extent + k;
    pieces.push({ sdf, min: c.clone().subScalar(g), max: c.clone().addScalar(g) });
  };

  const origin = new THREE.Vector3();
  add(ball(origin, centerRadius), origin, centerRadius);

  const r = new THREE.Vector3(L / 2, (L * spec.thickness) / 2, (L * spec.width) / 2);
  const local = new THREE.Vector3(L / 2, 0, 0); // ellipsoid center in petal space (petal grows along +X)
  const tips: THREE.Vector3[] = [];
  for (const p of petalPlacements(spec, innerRadius + spec.stalk)) {
    const m = ringMatrix(p);
    const inv = m.clone().invert();
    const c = local.clone().applyMatrix4(m);
    tips.push(c);
    add(ellipsoid(inv, local, r), c, Math.max(r.x, r.y, r.z));
    // Stalk: from the center (at this layer's height) to the petal center.
    const a = new THREE.Vector3(0, p.height, 0);
    const ra = spec.stalkWidth;
    const rb = spec.stalkWidth * 0.6;
    const box = new THREE.Box3().setFromPoints([a, c]).expandByScalar(ra + k);
    pieces.push({ sdf: stalk(a, c, ra, rb), min: box.min, max: box.max });
  }

  // Grid covering every piece (a cube, since MarchingCubes works on a cube).
  const bounds = new THREE.Box3();
  for (const p of pieces) bounds.expandByPoint(p.min).expandByPoint(p.max);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const res = Math.round(spec.detail);
  const mc = getCubes(res);
  // Cells 1 … res-2 are polygonized; leave a margin so the shape never touches the grid edge.
  const half = (Math.max(size.x, size.y, size.z) / 2) * (res / (res - 4));
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

  // Copy the triangles out (MarchingCubes works in −1…1) into a normal geometry we can instance.
  const n = mc.count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c1 = new THREE.Color(spec.color), c2 = new THREE.Color(spec.color2), c = new THREE.Color();
  const reach = tips.reduce((m, t) => Math.max(m, Math.hypot(t.x, t.z)), 0) || 1;
  for (let i = 0; i < n; i++) {
    const x = center.x + mc.positionArray[i * 3] * half;
    const y = center.y + mc.positionArray[i * 3 + 1] * half;
    const z = center.z + mc.positionArray[i * 3 + 2] * half;
    pos.set([x, y, z], i * 3);
    const v = new THREE.Vector3(mc.normalArray[i * 3], mc.normalArray[i * 3 + 1], mc.normalArray[i * 3 + 2]).normalize();
    nrm.set([v.x, v.y, v.z], i * 3);
    // Stalks/center in color, petals in color2.
    c.copy(c1).lerp(c2, THREE.MathUtils.smoothstep(Math.hypot(x, z) / reach, 0.45, 0.85));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
