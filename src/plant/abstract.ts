// Abstract petals (抽象几何): each petal is replaced by a 3D primitive (sphere, cube, cone…).
// Same idea as the Blender setup "Curve Circle → Instance on Points (Ico Sphere) → Rotate → Scale":
// the primitive is placed in the same ring as natural petals (petalPlacements), so Number / Layers /
// Spread / Size still work. Only the shape of one petal changes here.
//
// Local space matches buildBlade: the petal grows along +X from the origin, width along Z, top toward +Y.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PetalSpec, Primitive } from "./spec";

/** Raw primitive, any size; normalized below. Torus lies flat (ring seen from above). */
function rawPrimitive(p: Primitive): THREE.BufferGeometry {
  switch (p) {
    case "sphere":
      return new THREE.SphereGeometry(1, 28, 18);
    case "gem":
      return new THREE.IcosahedronGeometry(1, 0); // faceted, low-poly look
    case "cube":
      return new THREE.BoxGeometry(1, 1, 1);
    case "cone":
      return new THREE.ConeGeometry(1, 2, 24).rotateZ(-Math.PI / 2); // tip points outward (+X)
    case "torus":
      return new THREE.TorusGeometry(1, 0.35, 14, 32).rotateX(Math.PI / 2);
    case "capsule":
      return new THREE.CapsuleGeometry(0.5, 1, 6, 16).rotateZ(-Math.PI / 2); // long axis outward
  }
}

/** Faceted primitives keep hard edges; the rest are smoothed. */
const FLAT: Record<Primitive, boolean> = { sphere: false, gem: true, cube: true, cone: false, torus: false, capsule: false };

/** 0–1 → repeating 0→1→0 waves, so bands > 1 gives stripes of the two colors. */
function banded(t: number, bands: number): number {
  if (bands <= 1) return t;
  const x = t * bands;
  const f = x - Math.floor(x);
  return Math.floor(x) % 2 === 0 ? f : 1 - f;
}

export function buildAbstractPetalGeometry(spec: PetalSpec): THREE.BufferGeometry {
  const L = spec.size;
  let g = rawPrimitive(spec.primitive);

  // Fit into a box: length L along X (starting at the origin), width and thickness as fractions of L.
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  g.translate(-b.min.x, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  g.scale(L / size.x, (L * spec.thickness) / size.y, (L * spec.width) / size.z);

  // Normals are recomputed after bending, so clean the mesh first:
  // flat shapes → separate triangles (hard edges); smooth shapes → weld seams (no visible seam line).
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = FLAT[spec.primitive] ? g.toNonIndexed() : mergeVertices(g);

  // Same bend as natural petals: tip lifts (curvature > 0) or droops (< 0).
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getX(i) / L;
    pos.setY(i, pos.getY(i) + spec.curvature * 0.6 * L * v * v);
  }
  g.computeVertexNormals();

  // Two-color gradient, along the petal or by which way the surface faces.
  const nrm = g.attributes.normal;
  const c1 = new THREE.Color(spec.color);
  const c2 = new THREE.Color(spec.color2);
  const c = new THREE.Color();
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const t = spec.gradient === "length" ? pos.getX(i) / L : nrm.getY(i) * 0.5 + 0.5;
    c.copy(c1).lerp(c2, THREE.MathUtils.smoothstep(banded(THREE.MathUtils.clamp(t, 0, 1), spec.bands), 0, 1));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}
