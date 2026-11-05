// Glitch material (故障材质): a part drawn like a broken digital video frame.
// Built from the parts of the user's reference image (a grey glitch frame with green/cyan accents):
//   1. grey levels   → light is posterized into a few flat greys (dark / mid / light)
//   2. stripes       → thin vertical lines in screen pixels, on bright areas and on random bands
//   3. bands         → the screen is cut into horizontal bands; some get stripes or accents
//   4. accents       → neon green / cyan on the edges between grey levels and in random blocks
//   5. grain         → fine noise
// The material is a still image. Tearing and the jumping of blocks/grain are in Animation (scene/animation.ts,
// and "pattern" motion drives uTime from Plant.tsx).
// Works with InstancedMesh for the same reason as dreamMaterial.ts (three.js chunks handle instanceMatrix).
import * as THREE from "three";
import type { GlitchSpec } from "../plant/spec";
import { HASH } from "./glsl";

const vertexShader = /* glsl */ `
#include <common>
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vNormalV = normalize(transformedNormal);
  vViewPos = -mvPosition.xyz;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uDark, uMid, uLight, uAccent, uAccent2;
uniform float uLevels, uStripes, uStripePx, uAccents, uGrain, uTime, uBandPx;
varying vec3 vNormalV;
varying vec3 vViewPos;
${HASH}

void main() {
  vec3 n = normalize(vNormalV);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vViewPos);
  // Simple light from the upper left, plus a little "faces the camera" so nothing goes fully black.
  float l = 0.15 + 0.65 * max(dot(n, normalize(vec3(-0.4, 0.8, 0.5))), 0.0) + 0.25 * abs(dot(n, v));
  vec2 px = gl_FragCoord.xy;
  float step_ = floor(uTime * 10.0);
  float band = floor(px.y / uBandPx);
  l += (hash21(px + fract(uTime) * 91.0) - 0.5) * uGrain * 0.25; // grain before posterizing → speckled edges
  l = clamp(l, 0.0, 0.999);

  // 1. grey levels
  float k = floor(l * uLevels) / max(uLevels - 1.0, 1.0);
  vec3 col = k < 0.5 ? mix(uDark, uMid, k * 2.0) : mix(uMid, uLight, k * 2.0 - 1.0);

  // 2. stripes: on the brightest level, and on whole random bands
  if (uStripes > 0.0) {
    bool bandOn = hash21(vec2(band + 3.0, step_)) < uStripes * 0.5;
    if (bandOn || k > 0.99) {
      float s = step(0.5, fract(px.x / uStripePx));
      col = mix(col, s > 0.5 ? uLight : uMid, bandOn ? 1.0 : uStripes);
    }
  }

  // 4. accents: on the edges between grey levels (in some bands) and in random blocks
  vec3 acc = mix(uAccent, uAccent2, step(0.5, hash21(vec2(floor(px.x / (uBandPx * 2.0)), band))));
  float e = fract(l * uLevels);
  if ((e < 0.12 || e > 0.88) && hash21(vec2(band, step_ + 5.0)) < uAccents) col = acc;
  vec2 cell = floor(px / vec2(uBandPx * 3.0, uBandPx));
  if (hash21(cell + step_ * 0.37) < uAccents * 0.12) col = mix(col, acc, 0.85);

  // 5. grain on top
  col += (hash21(px * 1.7 + step_) - 0.5) * uGrain * 0.08;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function makeGlitchMaterial(g: GlitchSpec, doubleSide = false): THREE.ShaderMaterial {
  const c = (hex: string) => new THREE.Color(hex); // linear; colorspace_fragment converts back to sRGB
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: false,
    uniforms: {
      uDark: { value: c(g.dark) },
      uMid: { value: c(g.mid) },
      uLight: { value: c(g.light) },
      uAccent: { value: c(g.accent) },
      uAccent2: { value: c(g.accent2) },
      uLevels: { value: g.levels },
      uStripes: { value: g.stripes },
      uStripePx: { value: g.stripeWidth * dpr },
      uAccents: { value: g.accents },
      uGrain: { value: g.grain },
      uBandPx: { value: (6 + g.block * 90) * dpr },
      uTime: { value: 0 }, // pattern motion (Animation → Pattern), set by Plant.tsx
    },
  });
  return material;
}
