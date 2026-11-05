// Flower settings ("specs"): plain data the sliders edit and the 3D builders read.
// Units: meters and degrees. Keep this file free of three.js so specs stay small, saveable JSON.
// "drawn" shapes use a width profile (see profile.ts) the player drew on a drawing pad.
import { sampleProfile } from "./profile";

export type StemShape = "straight" | "curved" | "spiral";

export interface StemSpec {
  shape: StemShape;
  length: number; // 0.3 – 2
  thickness: number; // radius at the base, 0.005 – 0.05
  bend: number; // how strong the curve/spiral is, 0 – 1 (ignored for straight)
  lean: number; // growth direction: tilt away from vertical, 0 – 60°
  leanDirection: number; // compass direction of the tilt, 0 – 360°
  branches: number; // side branches, 1 – 6 (used by the "branched" architecture)
  color: string;
}

export type LeafShape = "heart" | "oval" | "slender" | "serrated" | "drawn";
export type LeafArrangement = "alternate" | "opposite" | "whorled";

export interface LeafSpec {
  shape: LeafShape;
  count: number; // total leaves on the main stem, 0 – 16
  size: number; // leaf length, 0.04 – 0.3
  arrangement: LeafArrangement; // 互生 1 per node / 对生 2 per node / 轮生 3 per node
  angle: number; // angle between leaf and stem, 15 – 90°
  color: string;
  drawn: number[]; // width profile used when shape = "drawn"
}

export type PetalShape = "round" | "pointed" | "wavy" | "drawn";
export interface PetalSpec {
  shape: PetalShape;
  count: number; // per layer, 3 – 24
  layers: number; // 1 = single, 2+ = multi-layer
  size: number; // petal length, 0.05 – 0.4
  curvature: number; // -1 (curls down/out) – 1 (curls up/in)
  spread: number; // opening angle from the stem axis: 10° closed – 120° drooping
  color: string;
  drawn: number[]; // width profile used when shape = "drawn"
  // Layering. stacked = every layer an identical ring moved up/down by layerGap (the user's Blender reference);
  // natural = inner layers smaller, more closed and turned.
  stack: boolean;
  layerGap: number; // vertical distance between stacked layers (negative stacks downward), -0.15 – 0.15
}

export type CenterType = "disc" | "column" | "stamens";

export interface CenterSpec {
  type: CenterType;
  size: number; // diameter, 0.02 – 0.25
  height: number; // how far it sticks out, 0 – 0.15
  density: number; // number of florets / stamens, 0 – 400
  color: string;
}

export type SepalShape = "pointed" | "round" | "narrow" | "drawn";
export type BudShape = "round" | "oval" | "pointed" | "drawn";

export interface SepalSpec {
  count: number; // sepals under each flower, 0 – 10
  shape: SepalShape;
  budShape: BudShape;
  budCount: number; // unopened buds on the plant, 0 – 8
  color: string;
  drawnSepal: number[]; // width profile used when shape = "drawn"
  drawnBud: number[]; // radius profile (base → top) used when budShape = "drawn"
}

export type ArchitectureMode = "single" | "branched" | "spike" | "cluster";

export interface ArchitectureSpec {
  mode: ArchitectureMode; // 单茎单花 / 分枝多花 / 穗状花序 / 聚集式花序
  flowers: number; // flowers in a spike or cluster, 3 – 30
}

/**
 * Build per part (构成, part of Form 形态), see build.ts. Same parts as materials.
 *   smooth = the normal surface
 *   pieces 拼块 = the part rebuilt from primitives scattered along its surface (copy-to-points). One system for
 *                 what used to be three: abstract petals (1 piece fitted to the part), Blocks 积木 (many small
 *                 cubes) and Cubes 立方体 (few big tilted gradient boxes) — those are now presets.
 *   fused 融合  = the same pieces as ellipsoids, melted together into one smooth blob (fused.ts). For petals,
 *                 `flower` melts the whole flower instead (all petals + stalks + a center ball).
 */
export type Primitive = "cube" | "sphere" | "gem" | "cone" | "torus" | "capsule";
/** How pieces are colored: part = the part's own colors, along = color → color2 base → tip, facing = color → color2
 * by which way the surface faces, piece = each piece gets its own gradient from the palette. */
export type PieceColor = "part" | "along" | "facing" | "piece";

export interface BuildSpec {
  mode: "smooth" | "pieces" | "fused";
  primitive: Primitive; // pieces only (fused always uses ellipsoids)
  count: number; // 1 – 120, pieces along the part's length (1 = one piece fitted to the whole part)
  scale: number; // 0.3 – 1.6, piece size vs its slot (< 1 leaves gaps, > 1 overlaps)
  width: number; // 0.1 – 2, piece width vs its length
  thickness: number; // 0.05 – 2, piece thickness vs its length
  variation: number; // 0 – 1, random size differences
  tilt: number; // 0 – 1, random turn away from the surface
  align: "follow" | "grid"; // 顺着走势: on the surface along the part / 网格: axis-aligned grid (pieces only)
  colorBy: PieceColor;
  color2: string; // along / facing: second color (first = the part's Color)
  bands: number; // along / facing: 1 – 6, the two colors repeat as stripes
  gradient: number; // piece: 0 (flat color per piece) – 1 (full gradient across each piece)
  palette: string[]; // piece: 5 colors; each piece starts somewhere different in it
  blend: number; // fused: 0 (sharp joins) – 1 (very melted)
  detail: number; // fused: mesh resolution 32 – 96
  flower: boolean; // fused petals: melt the whole flower (petals + stalks + center ball) into one shape
  stalk: number; // flower fusion: stalk length from the center to each petal, 0 – 0.3 m
  stalkWidth: number; // flower fusion: stalk radius at the center, 0.002 – 0.04 m
}

export type BuildPreset = "abstract" | "blocks" | "cubes";

/** Presets for pieces (the three former separate features). `count` depends on the part's size. */
export function buildPreset(preset: BuildPreset, part: MaterialPart): Partial<BuildSpec> {
  switch (preset) {
    case "abstract": // one squashed primitive per part, two-color top/underside stripes (Blender reference)
      return { primitive: "sphere", count: 1, scale: 1, width: 0.6, thickness: 0.35, variation: 0, tilt: 0, align: "follow", colorBy: "facing", bands: 2 };
    case "blocks": // many small equal cubes, one gradient along the part
      return { primitive: "cube", count: part === "stem" ? 80 : part === "sepals" ? 6 : 14, scale: 0.9, width: 1, thickness: 1, variation: 0, tilt: 0, align: "follow", colorBy: "along", bands: 1 };
    case "cubes": // few big tilted boxes, each with its own palette gradient
      return { primitive: "cube", count: part === "stem" ? 14 : 2, scale: 1.15, width: 0.87, thickness: 0.65, variation: 0.6, tilt: 0.3, align: "follow", colorBy: "piece", gradient: 0.8 };
  }
}

/**
 * Material per part (材质). Every part (stem, leaves, petals, center, sepals & buds) has its own:
 *   natural = lit by the scene lights (MeshStandardMaterial)
 *   pearl   = stylized "painted light" from a generated matcap (scene/matcap.ts)
 *   dream   = gradient-map shader with optional halo shell (scene/dreamMaterial.ts)
 *   glitch  = broken-video look: grey levels, stripes, neon accents, grain (scene/glitchMaterial.ts)
 * Materials are still images; all motion lives in AnimationSpec.
 * Materials live in `PlantSpec.materials`, not inside each part's settings, so changing a material never
 * rebuilds the plant's geometry.
 */
export type MaterialType = "natural" | "pearl" | "dream" | "glitch";

/** Pearl (珍珠): ramp from the dark side of a ball to its highlight. */
export interface PearlSpec {
  shadow: string; // side away from the light
  body: string; // main body
  glow: string; // band around the highlight and the rim
  highlight: string; // the highlight spot (its center fades to white)
  highlightSize: number; // 0.05 – 0.7
  softness: number; // 0 (hard, toon-like edges) – 1 (smooth)
  rim: number; // how much the glow color shows on the edges, 0 – 1
  lightAngle: number; // where the highlight sits, 0 – 360° (90 = top)
  tint: boolean; // multiply by the part's own colors
}

/** Dream (梦境): the part colors itself from a 5-color ramp — unlike the screen effect (EffectSpec). */
export interface DreamSpec {
  input: "facing" | "length" | "noise"; // what picks the ramp color: center→edge, base→tip, or a noise pattern
  ramp: string[]; // 5 colors, ramp start → end (for facing: center → edge)
  repeat: number; // 1 – 4, ramp repeats → contour rings
  fringe: number; // 0 – 1, rainbow edges (r/g/b read the ramp slightly apart)
  flow: number; // 0 – 1, noise wobble of the color bands (melted look)
  edge: number; // 0 – 1, edges fade out (makes the part transparent)
  halo: number; // 0 – 0.6, size of a soft glow shell around each copy of the part (0 = off; not on the stem)
  haloColor: string;
  haloOpacity: number; // 0 – 1
}

/** Glitch (故障): broken digital frame, from the user's grey/green glitch reference image. */
export interface GlitchSpec {
  dark: string; // grey levels, dark → light
  mid: string;
  light: string;
  accent: string; // neon accents on level edges and in random blocks
  accent2: string;
  levels: number; // 2 – 6 flat grey steps
  stripes: number; // 0 – 1, vertical line pattern on bright areas and random bands
  stripeWidth: number; // 2 – 12 screen pixels per stripe pair
  block: number; // 0 – 1, height of the horizontal glitch bands
  accents: number; // 0 – 1, how much green/cyan shows
  grain: number; // 0 – 1
}

export interface MaterialSpec {
  type: MaterialType;
  pearl: PearlSpec; // used when type = "pearl"
  dream: DreamSpec; // used when type = "dream"
  glitch: GlitchSpec; // used when type = "glitch"
}

/**
 * Animation per part (动画). Each part picks ONE motion; it moves only that part (see scene/animation.ts).
 * Works with every material.
 */
export type AnimationType = "none" | "sway" | "pulse" | "glitch" | "pattern";

export interface AnimationSpec {
  type: AnimationType; // none / 摇摆 sway / 呼吸 pulse / 故障 glitch tearing / 图案流动 pattern (Dream, Glitch only)
  amount: number; // 0 – 1, how strong
  glitchBlock: number; // 0 – 1, height of the tearing bands (glitch only)
  speed: number; // 0 – 1
}

/** Whole-plant animation (整体动画): glitch tearing shared by every part, so the plant tears as one picture. */
export interface PlantAnimationSpec {
  glitch: number; // 0 – 1 (0 = off)
  glitchBlock: number; // 0 – 1, band height
  speed: number; // 0 – 1
}

/** Which part a material belongs to. Sepals & buds share one; the stem's material is also used for receptacles. */
export type MaterialPart = "stem" | "leaves" | "petals" | "center" | "sepals";

/** Scene (场景): things that aren't part of the plant. */
export interface SceneSpec {
  background: string;
  ground: boolean; // show the ground disc and soft shadow
}

/** Screen effect applied after the 3D is drawn (see scene/Effects.tsx). */
export type EffectMode = "none" | "dream";

export interface EffectSpec {
  mode: EffectMode; // none / dream 梦境: blur + gradient map, like a blurred thermal photo
  blur: number; // 0 – 1, how soft/melted the image gets
  ramp: string[]; // 5 colors, dark → bright input brightness
  contrast: number; // 0.5 – 3, stretches the brightness before the ramp
  offset: number; // -0.5 – 0.5, slides the brightness along the ramp
  repeat: number; // 1 – 4, the ramp repeats → contour rings
  aberration: number; // 0 – 1, colored fringes at edges
  grain: number; // 0 – 1, film noise
}

export interface PlantSpec {
  stem: StemSpec;
  leaves: LeafSpec;
  petals: PetalSpec;
  center: CenterSpec;
  sepals: SepalSpec;
  architecture: ArchitectureSpec;
  materials: Record<MaterialPart, MaterialSpec>;
  animations: Record<MaterialPart, AnimationSpec>; // same parts as materials
  builds: Record<MaterialPart, BuildSpec>; // Form → Build (smooth / pieces / fused) per part
  plantAnimation: PlantAnimationSpec;
  scene: SceneSpec;
  effect: EffectSpec;
}

/** Default material: natural, with pearl and dream settings ready for when the player switches. */
function material(halo: number): MaterialSpec {
  return {
    type: "natural",
    // Pearl defaults are picked from the user's reference image (lavender-pink highlight, olive glow, off-white body).
    pearl: {
      shadow: "#8f88a6",
      body: "#ece6dd",
      glow: "#b5a630",
      highlight: "#e3b6f2",
      highlightSize: 0.35,
      softness: 0.55,
      rim: 0.45,
      lightAngle: 100,
      tint: false,
    },
    // Dream defaults follow the user's blurred reference: lavender-grey center, olive, pink, white edge.
    dream: {
      input: "facing",
      ramp: ["#a9adc2", "#c9bfe6", "#b3a547", "#f0b3bd", "#f6f2f4"],
      repeat: 1,
      fringe: 0.4,
      flow: 0.3,
      edge: 0,
      halo,
      haloColor: "#f0b3bd",
      haloOpacity: 0.55,
    },
    // Glitch defaults are measured from the user's reference image (pixel colors, ~4–7 px stripes).
    glitch: {
      dark: "#3e3e3e",
      mid: "#a4a4a4",
      light: "#f0f0f0",
      accent: "#07fe15",
      accent2: "#31ceb4",
      levels: 3,
      stripes: 0.5,
      stripeWidth: 5,
      block: 0.4,
      accents: 0.35,
      grain: 0.4,
    },
  };
}

/** Default build: smooth, with cube settings ready for when the player switches. */
// Default pieces settings = the Cubes preset; palette from the user's big-gradient-cube reference
// (orange → pink → lavender → olive → dark green). Petals' color2 is the blue from the Blender reference.
function build(part: MaterialPart, color2: string): BuildSpec {
  return {
    mode: "smooth",
    primitive: "cube",
    count: 2,
    scale: 1,
    width: 1,
    thickness: 1,
    variation: 0,
    tilt: 0,
    align: "follow",
    colorBy: "piece",
    color2,
    bands: 1,
    gradient: 0.8,
    palette: ["#ff9a1f", "#f283c0", "#9fa3d6", "#8a7a2a", "#1f3a2a"],
    blend: 0.5,
    detail: 64,
    flower: part === "petals",
    stalk: 0.12,
    stalkWidth: 0.012,
    ...buildPreset("cubes", part),
  };
}

/** Default animation: everything still. */
function animation(): AnimationSpec {
  return { type: "none", amount: 0.5, glitchBlock: 0.4, speed: 0.5 };
}

export const DEFAULT_SPEC: PlantSpec = {
  stem: {
    shape: "curved",
    length: 1,
    thickness: 0.018,
    bend: 0.35,
    lean: 10,
    leanDirection: 30,
    branches: 3,
    color: "#4f8a3c",
  },
  leaves: {
    shape: "oval",
    count: 6,
    size: 0.16,
    arrangement: "alternate",
    angle: 50,
    color: "#4a8a3a",
    // Starter drawing: a lobed leaf (like oak), so "Drawn" looks different from the presets before the player draws.
    drawn: sampleProfile((v) => 0.2 * Math.pow(4 * v * (1 - v), 0.6) * (0.75 + 0.25 * Math.sin(v * Math.PI * 8))),
  },
  petals: {
    shape: "round",
    count: 8,
    layers: 2,
    size: 0.17,
    curvature: 0.25,
    spread: 70,
    color: "#e98bb0",
    // Starter drawing: a spoon-shaped petal, narrow at the base and wide near the tip.
    drawn: sampleProfile((v) => 0.34 * Math.pow(Math.sin(Math.PI * v), 0.5) * (0.4 + 0.6 * v)),
    stack: false,
    layerGap: 0.05,
  },
  center: {
    type: "disc",
    size: 0.07,
    height: 0.02,
    density: 120,
    color: "#e8b923",
  },
  sepals: {
    count: 5,
    shape: "pointed",
    budShape: "oval",
    budCount: 1,
    color: "#5d9a45",
    drawnSepal: sampleProfile((v) => 0.16 * Math.pow(1 - v, 0.8) * Math.pow(Math.min(1, v * 6), 0.5)),
    drawnBud: sampleProfile((v) => 0.35 * Math.sin(Math.PI * Math.pow(v, 0.6))),
  },
  architecture: {
    mode: "single",
    flowers: 12,
  },
  materials: {
    stem: material(0),
    leaves: material(0),
    petals: material(0.25), // petals get a halo by default when switched to Dream
    center: material(0),
    sepals: material(0),
  },
  animations: {
    stem: animation(),
    leaves: animation(),
    petals: animation(),
    center: animation(),
    sepals: animation(),
  },
  plantAnimation: { glitch: 0, glitchBlock: 0.4, speed: 0.5 },
  builds: {
    stem: build("stem", "#b8e07a"),
    leaves: build("leaves", "#d9f2a6"),
    petals: build("petals", "#5468e0"),
    center: build("center", "#ff8a3d"),
    sepals: build("sepals", "#d9f2a6"),
  },
  scene: {
    background: "#1d1f24",
    ground: true,
  },
  // Dream defaults are picked from the user's reference image: white background, pink halos, olive, lavender-grey shapes.
  effect: {
    mode: "none",
    blur: 0.5,
    ramp: ["#f1f3f6", "#f0b3bd", "#b3a547", "#c9bfe6", "#a9adc2"],
    contrast: 1.4,
    offset: 0,
    repeat: 1,
    aberration: 0.35,
    grain: 0.15,
  },
};
