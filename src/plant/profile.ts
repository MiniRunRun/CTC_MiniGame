// Width profiles: how a player's drawing becomes a 3D shape.
// A profile is a list of PROFILE_SAMPLES half-widths, evenly spaced from base (v = 0) to tip (v = 1),
// each a fraction of the shape's length. Blades (petal/leaf/sepal) use it as half-width; buds use it as radius.
// Profiles are plain number arrays so they save as JSON with the rest of the flower.

export const PROFILE_SAMPLES = 65;
const MAX_HALF_WIDTH = 0.8; // wider than this looks broken in 3D

/** Half-width at v (0–1), linearly interpolated. */
export function profileAt(profile: number[], v: number): number {
  const x = Math.min(1, Math.max(0, v)) * (profile.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const j = Math.min(i + 1, profile.length - 1);
  return profile[i] * (1 - f) + profile[j] * f;
}

/** Sample any width function into a profile (used for defaults). */
export function sampleProfile(width: (v: number) => number): number[] {
  return Array.from({ length: PROFILE_SAMPLES }, (_, i) => width(i / (PROFILE_SAMPLES - 1)));
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Converts freehand strokes (screen pixels, y down) into a symmetric profile.
 * The drawing's bottom is the base, its top is the tip. Its height becomes the shape's length.
 * Each row's half-width = the farthest point from the mirror line `axisX`, so the player can draw a full
 * outline or just one side; the result is mirrored left/right. The drawing pad passes its dashed center
 * line as `axisX`; without it, the middle of the drawing is used.
 * Returns null if the drawing is too small to use.
 */
export function strokesToProfile(strokes: Point[][], axisX?: number): number[] | null {
  // Fill in points between pointer events so fast strokes don't leave empty rows.
  const pts: Point[] = [];
  for (const s of strokes) {
    for (let k = 0; k < s.length; k++) {
      const a = s[k];
      const b = s[k + 1];
      pts.push(a);
      if (!b) continue;
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let t = 1; t < steps; t++) pts.push({ x: a.x + ((b.x - a.x) * t) / steps, y: a.y + ((b.y - a.y) * t) / steps });
    }
  }
  if (pts.length < 10) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const height = maxY - minY;
  if (height < 20) return null;
  const axis = axisX ?? (minX + maxX) / 2;

  // Widest point per row (−1 = no point fell in that row).
  const n = PROFILE_SAMPLES;
  const rows = new Array<number>(n).fill(-1);
  for (const p of pts) {
    const v = (maxY - p.y) / height; // bottom of drawing = base
    const i = Math.round(v * (n - 1));
    rows[i] = Math.max(rows[i], Math.abs(p.x - axis) / height);
  }

  // Fill empty rows by interpolating between the nearest filled rows.
  const known = rows.map((w, i) => (w >= 0 ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < n; i++) {
    if (rows[i] >= 0) continue;
    const before = [...known].reverse().find((k) => k < i);
    const after = known.find((k) => k > i);
    if (before === undefined) rows[i] = rows[after!];
    else if (after === undefined) rows[i] = rows[before];
    else rows[i] = rows[before] + ((rows[after] - rows[before]) * (i - before)) / (after - before);
  }

  // Light smoothing to hide hand wobble (ends kept as drawn).
  const smooth = rows.map((w, i) => (i === 0 || i === n - 1 ? w : (rows[i - 1] + 2 * w + rows[i + 1]) / 4));
  return smooth.map((w) => Math.min(MAX_HALF_WIDTH, Math.max(0, w)));
}
