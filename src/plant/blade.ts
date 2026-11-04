// Shared builder for thin, bendable sheets: petals, leaves and sepals are all "blades".
// A blade is described by a half-width profile w(v): v runs base (0) → tip (1), w is a fraction of
// the blade length. The surface is a grid (rows along the length × columns across the width), so it
// can bend smoothly. Later, a player-drawn outline will be converted to the same w(v) profile.
import * as THREE from "three";

export interface BladeOptions {
  length: number;
  /** Half-width at v, as a fraction of length. */
  halfWidth: (v: number) => number;
  rows?: number;
  cols?: number;
  /** Bend along the length: −1 curls toward the back, 1 toward the front. */
  curvature?: number;
  /** Edges lift toward the front (a shallow spoon shape). */
  cup?: number;
  /** Ruffled edge strength (wavy petals). */
  ripple?: number;
  /** Optional shift along the length (fraction of length), e.g. to pull heart-leaf lobes back past the base. */
  lengthShift?: (u: number, v: number) => number;
  baseColor: THREE.Color;
  tipColor: THREE.Color;
}

/**
 * Blade in local space: grows along +X from the origin, width along Z, front face toward +Y.
 * Has a vertex "color" attribute fading from baseColor to tipColor.
 */
export function buildBlade(o: BladeOptions): THREE.BufferGeometry {
  const rows = o.rows ?? 28;
  const cols = o.cols ?? 12;
  const L = o.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const hw = o.halfWidth(v);
    for (let k = 0; k <= cols; k++) {
      const u = (k / cols) * 2 - 1; // −1 … 1 across the width
      const x = (v + (o.lengthShift ? o.lengthShift(u, v) : 0)) * L;
      const z = u * hw * L;
      let y = (o.curvature ?? 0) * 0.6 * L * v * v;
      y += (o.cup ?? 0) * L * u * u * hw * 2.8;
      if (o.ripple) y += o.ripple * L * u * u * Math.sin(v * Math.PI * 7);
      positions.push(x, y, z);

      c.copy(o.baseColor).lerp(o.tipColor, THREE.MathUtils.smoothstep(v, 0, 0.7));
      colors.push(c.r, c.g, c.b);
    }
  }

  const row = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const a = r * row + k;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface RingPlacement {
  angle: number; // around the axis, radians
  tilt: number; // rotation lifting the blade up from horizontal, radians
  radius: number; // distance from the axis where it attaches
  height: number; // small offset along the axis
  scale: number;
}

/** Evenly spaced ring of blades. spread = angle from the axis in degrees (0 = pointing straight up). */
export function ring(count: number, spread: number, radius: number, opts: { offset?: number; height?: number; scale?: number } = {}): RingPlacement[] {
  const out: RingPlacement[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      angle: ((i + (opts.offset ?? 0)) / count) * Math.PI * 2,
      tilt: THREE.MathUtils.degToRad(90 - spread),
      radius,
      height: opts.height ?? 0,
      scale: opts.scale ?? 1,
    });
  }
  return out;
}
