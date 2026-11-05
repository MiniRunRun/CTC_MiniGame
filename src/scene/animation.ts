// Animation (动画): motion added on top of ANY material (natural, pearl, dream, glitch).
// Each part has its own AnimationSpec; every kind of motion is a 0–1 amount, so they can be mixed:
//   sway    摇摆 → the part bends back and forth from where it's attached (blades flutter from the base,
//                  the stem bends from the ground)
//   pulse   呼吸 → the part grows and shrinks a little around where it's attached
//   glitch  故障 → the screen is cut into horizontal bands; some bands jump sideways (tearing), in steps
//   pattern 图案流动 → the material's own pattern moves (dream bands flow, glitch blocks/grain re-roll);
//                  handled in Plant.tsx by driving the material's uTime, not here
// How: material.onBeforeCompile injects a few lines into three.js' shader chunks (`#include <common>`,
// `<begin_vertex>`, `<project_vertex>`), which exist in MeshStandardMaterial, MeshMatcapMaterial and our own
// ShaderMaterials alike. Each copy (instance) gets its own phase from its position, so petals don't move in sync.
// Stem sway moves the whole plant: every other part gets the same bend at its height ("plant sway"),
// so leaves and flowers stay attached to a swaying stem.
// Shadows don't follow the motion (the shadow pass uses three's own depth material).
import * as THREE from "three";
import type { AnimationSpec } from "../plant/spec";

/** How the part is shaped, which decides how sway bends it. */
export type AnimKind = "stem" | "blade" | "blob";
const KIND = { stem: 0, blade: 1, blob: 2 } as const;

export interface AnimUniforms {
  uAnTime: { value: number };
  uAnSway: { value: number };
  uAnPulse: { value: number };
  uAnGlitch: { value: number };
  uAnBand: { value: number };
  uAnSize: { value: number };
  uAnRes: { value: THREE.Vector2 };
  uAnPlantTime: { value: number };
  uAnStemSway: { value: number };
  uAnStemLen: { value: number };
}

/** The stem's sway, which every part follows (see top of file). */
export interface PlantSway {
  sway: number;
  speed: number;
  stemLength: number;
}

const HEADER = /* glsl */ `
uniform float uAnTime, uAnSway, uAnPulse, uAnGlitch, uAnBand, uAnSize, uAnPlantTime, uAnStemSway, uAnStemLen;
uniform vec2 uAnRes;
float anHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
`;

// After <begin_vertex>: `transformed` is the vertex in the part's own space (attach point = origin).
const MOVE = /* glsl */ `
{
  vec3 anIp = vec3(0.0);
  #ifdef USE_INSTANCING
    anIp = instanceMatrix[3].xyz;
  #endif
  float anPh = dot(anIp, vec3(17.1, 31.7, 11.3));
  #if ANIM_KIND != 0
    transformed *= 1.0 + uAnPulse * 0.15 * sin(uAnTime * 2.0 + anPh);
  #else
    // stem: a bulge travels up the tube (pushed out along the surface normal, so curved stems stay in place)
    transformed += objectNormal * uAnPulse * 0.01 * max(sin(uAnTime * 2.0 - position.y * 6.0), 0.0);
  #endif
  float anW;
  #if ANIM_KIND == 0
    anW = clamp(position.y / uAnSize, 0.0, 1.0); anW *= anW;
    transformed.x += uAnSway * 0.12 * uAnSize * anW * sin(uAnTime * 1.3);
    transformed.z += uAnSway * 0.08 * uAnSize * anW * sin(uAnTime * 1.7 + 1.0);
  #elif ANIM_KIND == 1
    anW = clamp(position.x / uAnSize, 0.0, 1.0); anW *= anW;
    transformed.y += uAnSway * 0.35 * uAnSize * anW * sin(uAnTime * 3.0 + anPh);
  #else
    anW = clamp(length(position) / uAnSize, 0.0, 1.0);
    transformed.x += uAnSway * 0.15 * uAnSize * anW * sin(uAnTime * 3.0 + anPh);
    transformed.z += uAnSway * 0.10 * uAnSize * anW * sin(uAnTime * 2.3 + anPh * 1.3);
  #endif
}
`;

// After <project_vertex>: follow the stem's sway, using the vertex height in plant space (same formula as the
// stem itself in MOVE, ANIM_KIND 0).
const PLANT = /* glsl */ `
{
  vec4 anP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    anP = instanceMatrix * anP;
  #endif
  float anH = clamp(anP.y / uAnStemLen, 0.0, 1.0); anH *= anH;
  vec3 anO = vec3(uAnStemSway * 0.12 * uAnStemLen * anH * sin(uAnPlantTime * 1.3), 0.0,
                  uAnStemSway * 0.08 * uAnStemLen * anH * sin(uAnPlantTime * 1.7 + 1.0));
  mvPosition.xyz += (modelViewMatrix * vec4(anO, 0.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

// After <project_vertex> (and PLANT): glitch tearing in screen space.
const TEAR = /* glsl */ `
{
  float anSt = floor(uAnTime * 10.0);
  float anY = (gl_Position.y / gl_Position.w * 0.5 + 0.5) * uAnRes.y;
  float anB = floor(anY / uAnBand);
  if (anHash(vec2(anB, anSt)) < uAnGlitch * 0.5) {
    gl_Position.x += (anHash(vec2(anB + 7.0, anSt)) - 0.5) * uAnGlitch * 0.6 * gl_Position.w;
  }
}
`;

/** True when the spec moves vertices (pattern motion alone doesn't need shader changes). */
function movesVertices(a: AnimationSpec): boolean {
  return a.sway > 0 || a.pulse > 0 || a.glitch > 0;
}

/**
 * Adds the motion to `material` (if any). `size` = the part's length (blade length, stem length…), so the
 * motion scales with the part. `plant` = the stem's sway, followed by every part except the stem itself.
 * The uniforms go into material.userData.anim; Plant.tsx updates time/resolution.
 */
export function applyAnimation(material: THREE.Material, a: AnimationSpec, kind: AnimKind, size: number, plant: PlantSway | null) {
  const follow = !!plant && plant.sway > 0;
  if (!movesVertices(a) && !follow) return;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const u: AnimUniforms = {
    uAnTime: { value: 0 },
    uAnSway: { value: a.sway },
    uAnPulse: { value: a.pulse },
    uAnGlitch: { value: a.glitch },
    uAnBand: { value: (6 + a.glitchBlock * 90) * dpr },
    uAnSize: { value: Math.max(size, 1e-3) },
    uAnRes: { value: new THREE.Vector2(1, 1) },
    uAnPlantTime: { value: 0 },
    uAnStemSway: { value: follow ? plant!.sway : 0 },
    uAnStemLen: { value: plant ? Math.max(plant.stemLength, 1e-3) : 1 },
  };
  material.userData.plantSpeed = plant?.speed ?? 0;
  material.userData.anim = u;
  const prev = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n#define ANIM_KIND ${KIND[kind]}\n${HEADER}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${MOVE}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${follow ? PLANT : ""}\n${a.glitch > 0 ? TEAR : ""}`);
  };
  // Different code per kind / plant sway / glitch on-off → different compiled program.
  material.customProgramCacheKey = () => `anim-${kind}-${follow ? 1 : 0}-${a.glitch > 0 ? 1 : 0}`;
  material.needsUpdate = true;
}
