// Part color (Material → Color 颜色): ONE ramp per part + what picks the spot on it (spec ColorSpec).
// Geometry only stores where each point is — `aAlong` (base → tip, 0–1) and `aPiece` (piece start, spot across the
// piece), written by blade.ts / build.ts / fused.ts or filled in by ensureAlong() — and this file turns that into a
// color for every material:
//   natural / pearl (tint): injected into three's own shader (onBeforeCompile), sets the vertex color per corner
//   dream: reads the same uniforms in its own shader (dreamMaterial.ts), per pixel
//   glitch: keeps its own grey levels (that's its look)
// by = "part" means "no ramp, the part's own Form colors as built" → nothing is injected.
import * as THREE from "three";
import type { ColorSpec } from "../plant/spec";
import { PART_COLOR } from "./glsl";
import { patchShader } from "./shaderPatch";

const BY = { part: 0, along: 1, up: 2, facing: 3, noise: 4, piece: 5 } as const;

export interface PartColorUniforms {
  uPcRamp: { value: THREE.Color[] };
  uPcN: { value: number };
  uPcRepeat: { value: number };
  uPcSpread: { value: number };
  uPcScale: { value: number };
  uPcBy: { value: number };
}

/** Uniforms for a part's color. `size` = the part's length, so noise has a few blobs per part. */
export function partColorUniforms(c: ColorSpec, size: number): PartColorUniforms {
  const ramp = c.ramp.slice(0, 5).map((h) => new THREE.Color(h)); // THREE.Color is linear; shaders convert back
  while (ramp.length < 5) ramp.push(ramp[ramp.length - 1].clone());
  return {
    uPcRamp: { value: ramp },
    uPcN: { value: Math.max(2, Math.min(5, c.ramp.length)) },
    uPcRepeat: { value: c.repeat },
    uPcSpread: { value: c.spread },
    uPcScale: { value: 2.5 / Math.max(size, 0.02) },
    uPcBy: { value: BY[c.by] },
  };
}

/** Vertex attributes and the ramp code, pasted after `#include <common>` in the vertex shader. */
const HEADER = /* glsl */ `
attribute float aAlong;
attribute vec2 aPiece;
${PART_COLOR}
`;

// After <project_vertex>: objectNormal / transformedNormal / mvPosition are ready (instancing included).
const SET_COLOR = /* glsl */ `
#ifdef USE_COLOR
{
  float pcFacing = abs(dot(normalize(transformedNormal), normalize(-mvPosition.xyz)));
  vColor.rgb = partColor(partRaw(aAlong, aPiece, normalize(objectNormal), position, pcFacing));
}
#endif
`;

/**
 * Makes a three.js built-in material (MeshStandardMaterial, MeshMatcapMaterial) take its colors from the part's
 * ramp. Turns vertex colors on, since the ramp result travels in vColor. Does nothing for by = "part".
 */
export function applyPartColor(material: THREE.Material, c: ColorSpec, size: number) {
  if (c.by === "part") return;
  const u = partColorUniforms(c, size);
  (material as THREE.MeshStandardMaterial).vertexColors = true;
  // A ramp is the whole color: don't multiply by the part's single Form color.
  const m = material as THREE.MeshStandardMaterial;
  if (m.color) m.color.set("#ffffff");
  patchShader(material, "partcolor", (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${HEADER}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${SET_COLOR}`);
  });
}
