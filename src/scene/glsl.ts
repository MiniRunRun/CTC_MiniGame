// Shared GLSL snippets, so every shader uses the same hash / noise / ramp / ping-pong code.
// Paste them into a shader string with ${...}. Each snippet only defines functions (no uniforms), except
// `ramp5(name)`, which reads the 5-color uniform array you name.

/** Random 0–1 from a 2D / 3D point. */
export const HASH = /* glsl */ `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;

/** Smooth 3D value noise, 0–1. Needs HASH. */
export const NOISE = /* glsl */ `
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
`;

/** t repeated `repeat` times as 0→1→0→1… (neighbouring rings blend instead of jumping). */
export const PINGPONG = /* glsl */ `
float pingpong(float t, float repeat) {
  float x = t * repeat;
  float f = fract(x);
  return mod(floor(x), 2.0) == 0.0 ? f : 1.0 - f;
}
`;

/** `vec3 rampColor(float t)`: smooth blend through the 5-color uniform array `name` (t clamped to 0–1). */
export const ramp5 = (name: string) => /* glsl */ `
vec3 rampColor(float t) {
  float x = clamp(t, 0.0, 1.0) * 4.0;
  int i = int(min(floor(x), 3.0));
  float f = smoothstep(0.0, 1.0, x - float(i));
  if (i == 0) return mix(${name}[0], ${name}[1], f);
  if (i == 1) return mix(${name}[1], ${name}[2], f);
  if (i == 2) return mix(${name}[2], ${name}[3], f);
  return mix(${name}[3], ${name}[4], f);
}
`;
