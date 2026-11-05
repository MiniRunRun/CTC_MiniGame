// Turns the plant layout into one list of transforms (Matrix4) per part type.
// The scene draws each part type as a single InstancedMesh, so a plant with 30 flowers × 96 petals
// is still ~10 draw calls. Pure logic: no React.
import * as THREE from "three";
import type { PlantSpec } from "./spec";
import type { PlantLayout, Placement } from "./layout";
import { petalPlacements } from "./petal";
import { ring, type RingPlacement } from "./blade";

export interface Assembly {
  petals: THREE.Matrix4[];
  sepals: THREE.Matrix4[]; // under flowers and hugging buds
  receptacles: THREE.Matrix4[];
  heads: THREE.Matrix4[]; // one per flower; used for every flower-center part
  buds: THREE.Matrix4[];
  leaves: THREE.Matrix4[];
}

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function placementMatrix(p: Placement): THREE.Matrix4 {
  return new THREE.Matrix4().compose(p.position, p.quaternion, new THREE.Vector3(p.scale, p.scale, p.scale));
}

/** Local matrix of one blade in a ring: turn around the axis, move out to the radius, tilt up, scale. */
export function ringMatrix(r: RingPlacement): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeRotationAxis(Y, r.angle)
    .multiply(new THREE.Matrix4().makeTranslation(r.radius, r.height, 0))
    .multiply(new THREE.Matrix4().makeRotationAxis(Z, r.tilt))
    .multiply(new THREE.Matrix4().makeScale(r.scale, r.scale, r.scale));
}

export function assemble(spec: PlantSpec, layout: PlantLayout): Assembly {
  const out: Assembly = { petals: [], sepals: [], receptacles: [], heads: [], buds: [], leaves: [] };
  const inner = spec.center.size * 0.35;
  const receptacle = new THREE.Matrix4().makeScale(1, 0.7, 1);

  // Flowers at the same openness share the same ring layout; cache it.
  const cache = new Map<number, { petals: THREE.Matrix4[]; sepals: THREE.Matrix4[] }>();
  const ringsFor = (openness: number) => {
    let r = cache.get(openness);
    if (!r) {
      // Sepals sit just outside/below the petals, opening a bit further than the outer petal ring.
      const sepalSpread = Math.min(150, 10 + (spec.petals.spread - 10) * openness + 25);
      r = {
        petals: petalPlacements(spec.petals, inner, openness).map(ringMatrix),
        sepals: ring(spec.sepals.count, sepalSpread, inner * 0.7, { offset: 0.5, height: -0.002 }).map(ringMatrix),
      };
      cache.set(openness, r);
    }
    return r;
  };

  for (const f of layout.flowers) {
    const m = placementMatrix(f);
    const r = ringsFor(f.openness);
    out.heads.push(m);
    out.receptacles.push(m.clone().multiply(receptacle));
    for (const p of r.petals) out.petals.push(m.clone().multiply(p));
    for (const s of r.sepals) out.sepals.push(m.clone().multiply(s));
  }

  // Bud sepals hug the bud: a nearly upright ring.
  const hug = ring(spec.sepals.count, 18, 0.002).map(ringMatrix);
  for (const b of layout.buds) {
    const m = placementMatrix(b);
    out.buds.push(m);
    for (const s of hug) out.sepals.push(m.clone().multiply(s));
  }

  for (const l of layout.leaves) out.leaves.push(placementMatrix(l));
  return out;
}
