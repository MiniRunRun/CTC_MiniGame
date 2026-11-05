# Game Design

The single source of truth for what the game is. Update it whenever the user changes the idea.
How it is built technically lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Concept
- **Game:** a *Digital Garden* minigame. Players design their own 3D flowers and (later) plant them in a garden.
- **What "CTC" stands for:** _not yet recorded, ask the user._
- **First feature to build:** the **Flower Building Tool** (花朵建造工具), described below.

## Flower Building Tool

The player builds one flower plant. Every part has preset shapes **and** can be freely drawn by the
player (自由绘画). Every part has sliders. Everything is shown live in **3D**.

**UI style:** a **side panel of sliders**, one collapsible section per part (Stem, Leaves, Petals, Center,
Sepals & Buds, Architecture), next to a big live 3D preview the player can rotate and zoom.
**No node editor in the game.** The user likes Blender-style node diagrams only for *picturing the plan*
(how the parts feed into the plant). It is not a player-facing UI.

### Parts and controls

The user listed six botanical parts: Stem 茎, Leaves 叶, Sepals 萼片, Petals 花瓣, Stamen 雄蕊, Pistil 雌蕊.
Stamen and pistil are grouped together as "Flower Center".

| # | Part | Controls |
|---|------|----------|
| 01 | **Stem / 茎** | Shape: straight 直线 / curved 弯曲 / spiral 螺旋 · Length 长度 · Thickness 粗细 · Branching 分枝数量 · Direction 生长方向 |
| 02 | **Leaves / 叶** | Shape: heart 心形 / oval 椭圆 / slender 细长 / serrated 锯齿 / *drawn* · Number 数量 · Size 大小 · Arrangement: alternate 互生 / opposite 对生 / whorled 轮生 · Angle 生长角度 |
| 03 | **Petals / 花瓣** | Shape: round 圆形 / pointed 尖形 / wavy 波浪形 / *drawn* · Number 数量 · Layers: single 单层 / multi 多层 · Curvature 弯曲程度 · Spread 张开角度 |
| 04 | **Flower Center / 花心** (stamen 雄蕊 + pistil 雌蕊) | Type: disc 圆盘形 / column 柱状 / stamen cluster 花蕊群 · Size 直径 · Height 突出程度 · Density 花蕊密度 · Color 中心颜色 |
| 05 | **Sepals & Buds / 萼片与花蕾** | Sepal count 萼片数量 · Sepal shape 萼片形状 (*drawable*) · Bud shape 花蕾形状 · Bud count 未开放花蕾数量 |

### Flower Architecture / 整体结构

After the parts, the player picks how the whole plant is organized:

1. **Single Flower** 单茎单花: one stem, one flower on top.
2. **Branched Flower** 分枝多花: the stem forks; each branch ends in a flower.
3. **Flower Spike** 穗状花序: many flowers along one tall stem (e.g. lavender).
4. **Flower Cluster** 聚集式花序: many short stalks from one point forming a dome (e.g. hydrangea / umbel).

### Extra controls added beyond the user's list (milestone 2)

These were not in the user's list. They were added because the 3D needs them; remove if the user objects.
- Stem: **Bend 弯曲度** (how strong the curve/spiral is), **Lean 倾斜 + Direction 生长方向** (tilt and its compass
  direction; together they are "growth direction"), **Color**.
- Petals: **Size 大小**, **Color** (fades lighter toward the base). Layers is a 1–4 slider (1 = single, 2+ = multi).
- Petals: **Style 风格 Natural / Abstract 抽象几何** (user request, from a Blender Geometry Nodes reference).
  Abstract swaps each petal for a primitive (sphere, gem, cube, cone, torus, capsule) with Width, Thickness,
  Layer Gap, two colors, Gradient (top↔under / base→tip) and Bands. Shape is hidden in abstract mode.
- Petals (abstract): **Join 连接 Separate / Fused 融合** — fused melts round petals and stalks into one blobby
  shape (Stalk Length, Stalk Width, Blend, Detail). From the user's pearl reference image.
- **Material 材质 in every part section** (stem, leaves, petals, center, sepals & buds — user request): each part
  picks its own **Natural 自然 / Pearl 珍珠 / Dream 梦境** with its own settings.
  - Pearl: stylized "painted light" (Highlight, Glow, Body, Shadow colors, Highlight Size, Softness, Rim,
    Light Angle, Part Colors on/off) with a preview ball.
  - Dream: 5-color ramp inside the part, colored by facing / length (blades only) / noise, with Repeat, Fringe,
    Flow, Speed, Edge Fade and a Halo glow shell (not on the stem).
- **07 Scene 场景**: Background color, Ground show/hide.
- **08 Effect 后期效果**: None / **Dream 梦境** — blur + 5-color gradient map (Blur, Contrast, Offset, Repeat,
  Fringe, Grain). From the user's blurred, pink-haloed reference image.
- A **Reset 重置** button.
- Milestone 3: **Color** for leaves and sepals/buds; **Flowers 花朵数量** (3–30) for Spike and Cluster.
  Stem **Branching 分枝数量** (1–6) only has an effect in the Branched architecture.
- Sepal shapes chosen: pointed 尖形 / round 圆形 / narrow 细长. Bud shapes: round 圆形 / oval 椭圆 / pointed 尖形.
  (The user listed "sepal shape" and "bud shape" without options; these are our picks.)

### Free drawing / 自由绘画

Players draw flat 2D outlines (petal, leaf, sepal, bud profile) in a small drawing pad inside that part's panel section.
How it works for the player (built in milestone 4): pick **Drawn 手绘 ✎** in a shape group → a pad appears with a
starter shape → draw an outline (base at the bottom, tip at the top; one side is enough, it is mirrored) → the 3D
updates when the stroke ends. Strokes add up until **Clear 清除**. Picking a preset switches back; the drawing is kept.
The app turns the outline into a 3D shape by bending and cupping it with the sliders. Players do **not**
sculpt in full 3D; that is too hard for players and too heavy for a minigame (see `DECISIONS.md`).

## Later (not designed yet)
- Planting flowers in the garden, saving/sharing flowers, colors per part, animation (wind, blooming).
