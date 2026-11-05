// Shared color-ramp helpers for geometry builders (the GLSL twins are in scene/glsl.ts).
import * as THREE from "three";

/** t repeated `repeat` times as 0→1→0→1… ; repeat ≤ 1 returns t unchanged. */
export function pingpong(t: number, repeat: number): number {
  if (repeat <= 1) return t;
  const x = t * repeat;
  const f = x - Math.floor(x);
  return Math.floor(x) % 2 === 0 ? f : 1 - f;
}

/** Smooth color through `colors` at t (0–1, clamped). Writes into `out`. */
export function sampleRamp(colors: THREE.Color[], t: number, out: THREE.Color): THREE.Color {
  if (colors.length === 1) return out.copy(colors[0]);
  const f = THREE.MathUtils.clamp(t, 0, 1) * (colors.length - 1);
  const i = Math.min(Math.floor(f), colors.length - 2);
  return out.copy(colors[i]).lerp(colors[i + 1], THREE.MathUtils.smoothstep(f - i, 0, 1));
}

/** Wraps any number into 0–1 as a back-and-forth (0→1→0…), so a ramp can start anywhere and loop smoothly. */
export function wrap01(t: number): number {
  const x = ((t % 2) + 2) % 2;
  return x > 1 ? 2 - x : x;
}
