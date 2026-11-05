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
/** natural = thin bendable blade; abstract = each petal replaced by a 3D primitive (see abstract.ts). */
export type PetalStyle = "natural" | "abstract";
export type Primitive = "sphere" | "gem" | "cube" | "cone" | "torus" | "capsule";
/** How the two abstract colors blend: along the petal (base → tip) or by facing (top → underside). */
export type GradientMode = "length" | "facing";
/** separate = one primitive per petal; fused = petals + stalks melted into one blobby shape (see fused.ts). */
export type PetalJoin = "separate" | "fused";

export interface PetalSpec {
  shape: PetalShape;
  count: number; // per layer, 3 – 24
  layers: number; // 1 = single, 2+ = multi-layer
  size: number; // petal length, 0.05 – 0.4
  curvature: number; // -1 (curls down/out) – 1 (curls up/in)
  spread: number; // opening angle from the stem axis: 10° closed – 120° drooping
  color: string;
  drawn: number[]; // width profile used when shape = "drawn"
  // Abstract style (抽象几何). Only used when style = "abstract"; shape is ignored then.
  style: PetalStyle;
  primitive: Primitive;
  width: number; // primitive width as a fraction of petal length, 0.1 – 1.5
  thickness: number; // primitive thickness as a fraction of petal length, 0.05 – 1.5
  layerGap: number; // vertical distance between stacked layers (negative stacks downward), -0.15 – 0.15
  gradient: GradientMode;
  bands: number; // how many times the gradient repeats, 1 – 6 (more = striped)
  color2: string; // second gradient color (the first is `color`)
  // Fused (融合) — only when style = "abstract" and join = "fused".
  join: PetalJoin;
  stalk: number; // stalk length from the center to each petal, 0 – 0.3 m
  stalkWidth: number; // stalk radius at the center, 0.002 – 0.04 m (tapers toward the petal)
  blend: number; // how round the joins are, 0 (sharp) – 1 (very melted)
  detail: number; // mesh resolution, 32 – 96 (higher = smoother, slower)
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
 * Build per part (构造, part of Form 形态): smooth = the normal surface; cubes = the surface rebuilt from small
 * gradient-colored cubes that follow the part's shape (see cubes.ts). Same parts as materials.
 */
export interface CubeSpec {
  build: "smooth" | "cubes";
  size: number; // cube edge, 0.003 – 0.05 m
  align: "follow" | "grid"; // 顺着走势: cubes lie on the surface along the part / 网格: axis-aligned voxels
  gap: number; // 0 – 0.6, space between cubes (fraction of the cube size)
  color2: string; // gradient end color (start = the part's own color), base → tip
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
  cubes: Record<MaterialPart, CubeSpec>; // Form → Build (smooth / cubes) per part
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
function cubes(size: number, color2: string): CubeSpec {
  return { build: "smooth", size, align: "follow", gap: 0.1, color2 };
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
    // Abstract defaults follow the user's Blender reference: squashed spheres on a ring, layers stacked.
    style: "natural",
    primitive: "sphere",
    width: 0.6,
    thickness: 0.35,
    layerGap: 0.05,
    gradient: "facing",
    bands: 2,
    color2: "#5468e0",
    join: "separate",
    stalk: 0.12,
    stalkWidth: 0.012,
    blend: 0.5,
    detail: 64,
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
  cubes: {
    stem: cubes(0.012, "#b8e07a"),
    leaves: cubes(0.01, "#d9f2a6"),
    petals: cubes(0.012, "#fff1c9"),
    center: cubes(0.008, "#ff8a3d"),
    sepals: cubes(0.007, "#d9f2a6"),
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
