// Turns one part's MaterialSpec (natural / pearl / dream / glitch) into three.js materials.
// Used by Plant.tsx for every part: stem, leaves, petals, center, sepals & buds.
import * as THREE from "three";
import type { AnimationSpec, MaterialPart, MaterialSpec } from "../plant/spec";
import { applyAnimation, type AnimKind, type PlantMotion } from "./animation";
import { makeMatcapTexture } from "./matcap";
import { geometryCenter, makeDreamMaterial } from "./dreamMaterial";
import { makeGlitchMaterial } from "./glitchMaterial";

export interface PartInfo {
  /** The part's colors are in the geometry (vertex colors), e.g. blades and buds. */
  vertexColors?: boolean;
  /** Otherwise one color for the whole part. */
  color?: string;
  doubleSide?: boolean;
  roughness: number;
  /** Part length along +X (blades) for the dream "length" input; 0 = no length axis. */
  axisLen?: number;
  /** Measure dream "length" outward from the axis instead (fused flowers). */
  radial?: boolean;
  /** Geometry to grow the dream halo shell around; omit for no halo (e.g. the stem). */
  haloGeometry?: THREE.BufferGeometry;
}

/** The part's animation (see animation.ts): settings, how the part bends, and its length. */
export interface PartAnim {
  spec: AnimationSpec;
  kind: AnimKind;
  size: number;
  part: MaterialPart;
  /** Whole-plant motion: stem sway (followed unless this is the stem itself) and whole-plant glitch. */
  plant: PlantMotion;
  follow: boolean;
}

export interface PartMaterials {
  material: THREE.Material;
  /** Dream halo shell material, drawn as a second copy of the part (null when off). */
  halo: THREE.Material | null;
  /** Everything to dispose when this is replaced. */
  disposables: { dispose: () => void }[];
}

/** Material + animation for one part. Animation is added on top of whatever material was picked. */
export function buildPartMaterials(m: MaterialSpec, o: PartInfo, anim: PartAnim): PartMaterials {
  const pm = buildMaterial(m, o);
  for (const mat of [pm.material, pm.halo]) {
    if (!mat) continue;
    applyAnimation(mat, anim.spec, anim.part, anim.kind, anim.size, anim.plant, anim.follow);
    mat.userData.animSpec = anim.spec; // Plant.tsx reads speed / pattern from here every frame
  }
  return pm;
}

function buildMaterial(m: MaterialSpec, o: PartInfo): PartMaterials {
  const side = o.doubleSide ? THREE.DoubleSide : THREE.FrontSide;

  if (m.type === "pearl") {
    const matcap = makeMatcapTexture(m.pearl);
    const material = new THREE.MeshMatcapMaterial({
      matcap,
      side,
      vertexColors: m.pearl.tint && !!o.vertexColors,
      color: m.pearl.tint && o.color ? o.color : "#ffffff",
    });
    return { material, halo: null, disposables: [material, matcap] };
  }

  if (m.type === "dream") {
    const info = { axisLen: o.axisLen ?? 0, radial: o.radial, doubleSide: o.doubleSide };
    const material = makeDreamMaterial(m.dream, info);
    let halo: THREE.ShaderMaterial | null = null;
    if (m.dream.halo > 0 && o.haloGeometry) {
      halo = makeDreamMaterial(m.dream, { ...info, halo: true, center: geometryCenter(o.haloGeometry) });
    }
    return { material, halo, disposables: halo ? [material, halo] : [material] };
  }

  if (m.type === "glitch") {
    const material = makeGlitchMaterial(m.glitch, o.doubleSide);
    return { material, halo: null, disposables: [material] };
  }

  const material = new THREE.MeshStandardMaterial({
    vertexColors: !!o.vertexColors,
    color: o.color ?? "#ffffff",
    side,
    roughness: o.roughness,
  });
  return { material, halo: null, disposables: [material] };
}
