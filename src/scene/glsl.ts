// Shared GLSL snippets, so every shader uses the same hash / noise / ramp / ping-pong / part-color code.
// Paste them into a shader string with ${...}. Each snippet has an include guard, so two layers (e.g. animation and
// part color, both injected into one material) can paste the same snippet without "redefinition" errors.

/** Random 0–1 from a 2D / 3D point. */
export const HASH = /* glsl */ `
#ifndef GLSL_HASH
#define GLSL_HASH
float hash21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
#endif
`;

/** Smooth 3D value noise, 0–1. Needs HASH. */
export const NOISE = /* glsl */ `
#ifndef GLSL_NOISE
#define GLSL_NOISE
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
#endif
`;

/** pingpong: t repeated `repeat` times as 0→1→0→1… ; wrap01: any number folded into 0–1 the same way. */
export const PINGPONG = /* glsl */ `
#ifndef GLSL_PINGPONG
#define GLSL_PINGPONG
float pingpong(float t, float repeat) {
  float x = t * repeat;
  float f = fract(x);
  return mod(floor(x), 2.0) == 0.0 ? f : 1.0 - f;
}
float wrap01(float t) { float x = mod(t, 2.0); return x > 1.0 ? 2.0 - x : x; }
#endif
`;

/**
 * `vec3 rampColor(float t)`: smooth blend through the first `count` colors (2–5) of the vec3[5] uniform `name`.
 * `count` is a GLSL float expression (a uniform name or a literal like "5.0").
 */
export const rampN = (name: string, count: string) => /* glsl */ `
vec3 rampColor(float t) {
  float n = ${count};
  float x = clamp(t, 0.0, 1.0) * (n - 1.0);
  float i = min(floor(x), n - 2.0);
  float f = smoothstep(0.0, 1.0, x - i);
  if (i < 0.5) return mix(${name}[0], ${name}[1], f);
  if (i < 1.5) return mix(${name}[1], ${name}[2], f);
  if (i < 2.5) return mix(${name}[2], ${name}[3], f);
  return mix(${name}[3], ${name}[4], f);
}
`;

/**
 * Part color (Material → Color, see scene/partColor.ts): uniforms + `partRaw()` (spot on the ramp before repeat)
 * and `partColor()`. Inputs: along (geometry attribute aAlong, base → tip 0–1), piece (aPiece: x = piece's random
 * start, y = position across the piece), object-space normal and position, and facing (1 = faces the camera).
 * by: 0 part (callers fall back to facing), 1 along, 2 up, 3 facing, 4 noise, 5 piece.
 */
export const PART_COLOR = /* glsl */ `
${HASH}
${NOISE}
${PINGPONG}
#ifndef GLSL_PART_COLOR
#define GLSL_PART_COLOR
uniform vec3 uPcRamp[5];
uniform float uPcN, uPcRepeat, uPcSpread, uPcScale;
uniform int uPcBy;
${rampN("uPcRamp", "uPcN")}
float partRaw(float along, vec2 piece, vec3 objN, vec3 objP, float facing) {
  if (uPcBy == 1) return along;
  if (uPcBy == 2) return objN.y * 0.5 + 0.5;
  if (uPcBy == 4) return noise3(objP * uPcScale);
  if (uPcBy == 5) return wrap01(piece.x + uPcSpread * piece.y);
  return 1.0 - facing;
}
vec3 partColor(float raw) { return rampColor(pingpong(clamp(raw, 0.0, 1.0), uPcRepeat)); }
#endif
`;
