// Slider panel: one collapsible section per flower part (see docs/GAME_DESIGN.md).
// Every section has working controls. Shape groups have a "Drawn 手绘" option that opens a drawing pad.
import { useMemo, type ReactNode } from "react";
import { usePlant } from "../state/store";
import { Choice, ColorPicker, Slider, cm, deg, mm, pct } from "./controls";
import DrawPad from "./DrawPad";
import { petalWidth } from "../plant/petal";
import { leafWidth } from "../plant/leaf";
import { budWidth, sepalWidth } from "../plant/sepal";
import { paintMatcap } from "../scene/matcap";
import type { AnimationSpec, CubeSpec, DreamSpec, GlitchSpec, MaterialPart, MaterialType, PearlSpec } from "../plant/spec";

const DRAWN = { value: "drawn" as const, label: "Drawn 手绘 ✎" };

function Section(props: { num: string; en: string; zh: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={props.open}>
      <summary>
        <span className="num">{props.num}</span> {props.en} <span className="zh">{props.zh}</span>
      </summary>
      <div className="section-body">{props.children}</div>
    </details>
  );
}

/**
 * One category inside a part section. Every part has the same four:
 * Form 形态 (shape, size, count, color) · Material 材质 · Animation 动画 · Growing State 生长状态.
 */
function Category(props: { en: string; zh: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="category" open={props.open}>
      <summary>
        {props.en} <span className="zh">{props.zh}</span>
      </summary>
      <div className="category-body">{props.children}</div>
    </details>
  );
}

/**
 * Form → Build 构造: smooth surface, Blocks 积木 (small cubes) or Cubes 立方体 (big gradient boxes), plant/cubes.ts.
 */
function CubeControls({ part }: { part: MaterialPart }) {
  const c = usePlant((st) => st.spec.cubes[part]);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<CubeSpec>) => update("cubes", { [part]: { ...usePlant.getState().spec.cubes[part], ...patch } });
  const also = part === "stem" ? " (also receptacles 花托)" : part === "sepals" ? " (also buds 花蕾)" : "";
  return (
    <div className="subgroup">
      <Choice
        label={`Build 构造${also}`}
        value={c.build}
        onChange={(build) => set({ build })}
        options={[
          { value: "smooth", label: "Smooth 平滑" },
          { value: "blocks", label: "Blocks 积木" },
          { value: "cubes", label: "Cubes 立方体" },
        ]}
      />
      {c.build === "blocks" && (
        <>
          <Slider label="Cube Size 立方体大小" value={c.size} min={0.003} max={0.05} step={0.001} format={mm} onChange={(size) => set({ size })} />
          <Choice
            label="Align 排列"
            value={c.align}
            onChange={(align) => set({ align })}
            options={[
              { value: "follow", label: "Follow 顺着走势" },
              { value: "grid", label: "Grid 网格" },
            ]}
          />
          <Slider label="Gap 间隙" value={c.gap} min={0} max={0.6} step={0.01} format={pct} onChange={(gap) => set({ gap })} />
          <ColorPicker label="Gradient End 渐变终点色" value={c.color2} onChange={(color2) => set({ color2 })} />
          <p className="hint">Gradient runs from the part's Color (base) to this color (tip).</p>
        </>
      )}
      {c.build === "cubes" && (
        <>
          <Slider label="Count 数量" value={c.count} min={1} max={24} step={1} onChange={(count) => set({ count })} />
          <Slider label="Variation 大小变化" value={c.variation} min={0} max={1} step={0.01} format={pct} onChange={(variation) => set({ variation })} />
          <Slider label="Tilt 倾斜" value={c.tilt} min={0} max={1} step={0.01} format={pct} onChange={(tilt) => set({ tilt })} />
          <Slider label="Gradient 渐变" value={c.gradient} min={0} max={1} step={0.01} format={pct} onChange={(gradient) => set({ gradient })} />
          <div className="ramp-preview" style={{ background: `linear-gradient(90deg, ${c.palette.join(", ")})` }} />
          {c.palette.map((col, i) => (
            <ColorPicker
              key={i}
              label={`Palette ${i + 1} 色板`}
              value={col}
              onChange={(v) => set({ palette: usePlant.getState().spec.cubes[part].palette.map((x, k) => (k === i ? v : x)) })}
            />
          ))}
          <p className="hint">Each cube has its own gradient from this palette. Gradient 0 = one flat color per cube.</p>
        </>
      )}
    </div>
  );
}

/** A flower-part section with its four categories. */
function PartSection(props: {
  num: string;
  en: string;
  zh: string;
  open?: boolean;
  part: MaterialPart;
  hasLength?: boolean;
  form: ReactNode;
}) {
  return (
    <Section num={props.num} en={props.en} zh={props.zh} open={props.open}>
      <Category en="Form" zh="形态" open>
        {props.form}
        <CubeControls part={props.part} />
      </Category>
      <Category en="Material" zh="材质">
        <MaterialControls part={props.part} hasLength={props.hasLength} />
      </Category>
      <Category en="Animation" zh="动画">
        <AnimationControls part={props.part} />
      </Category>
      <Category en="Growing State" zh="生长状态">
        <p className="hint">Coming later 之后再设计.</p>
      </Category>
    </Section>
  );
}

function StemControls() {
  const s = usePlant((st) => st.spec.stem);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof s>) => update("stem", patch);
  const mode = usePlant((st) => st.spec.architecture.mode);
  return (
    <>
      <Choice
        label="Shape 形状"
        value={s.shape}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "straight", label: "Straight 直线" },
          { value: "curved", label: "Curved 弯曲" },
          { value: "spiral", label: "Spiral 螺旋" },
        ]}
      />
      {s.shape !== "straight" && (
        <Slider label="Bend 弯曲度" value={s.bend} min={0} max={1} step={0.01} format={pct} onChange={(bend) => set({ bend })} />
      )}
      <Slider label="Length 长度" value={s.length} min={0.3} max={2} step={0.01} format={cm} onChange={(length) => set({ length })} />
      <Slider label="Thickness 粗细" value={s.thickness} min={0.005} max={0.05} step={0.001} format={mm} onChange={(thickness) => set({ thickness })} />
      <Slider label="Lean 倾斜" value={s.lean} min={0} max={60} step={1} format={deg} onChange={(lean) => set({ lean })} />
      <Slider label="Direction 生长方向" value={s.leanDirection} min={0} max={360} step={1} format={deg} onChange={(leanDirection) => set({ leanDirection })} />
      <ColorPicker label="Color 颜色" value={s.color} onChange={(color) => set({ color })} />
      <Slider label="Branching 分枝数量" value={s.branches} min={1} max={6} step={1} onChange={(branches) => set({ branches })} />
      {mode !== "branched" && <p className="hint">Branching is used by the Branched Flower architecture (06).</p>}
    </>
  );
}

function LeafControls() {
  const l = usePlant((st) => st.spec.leaves);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof l>) => update("leaves", patch);
  return (
    <>
      <Choice
        label="Shape 形状"
        value={l.shape}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "heart", label: "Heart 心形" },
          { value: "oval", label: "Oval 椭圆" },
          { value: "slender", label: "Slender 细长" },
          { value: "serrated", label: "Serrated 锯齿" },
          DRAWN,
        ]}
      />
      {l.shape === "drawn" && (
        <DrawPad width={(v) => leafWidth("drawn", v, l.drawn)} color={l.color} onDraw={(drawn) => set({ drawn })} />
      )}
      <Slider label="Number 叶片数量" value={l.count} min={0} max={16} step={1} onChange={(count) => set({ count })} />
      <Slider label="Size 大小" value={l.size} min={0.04} max={0.3} step={0.005} format={cm} onChange={(size) => set({ size })} />
      <Choice
        label="Arrangement 排列"
        value={l.arrangement}
        onChange={(arrangement) => set({ arrangement })}
        options={[
          { value: "alternate", label: "Alternate 互生" },
          { value: "opposite", label: "Opposite 对生" },
          { value: "whorled", label: "Whorled 轮生" },
        ]}
      />
      <Slider label="Angle 生长角度" value={l.angle} min={15} max={90} step={1} format={deg} onChange={(angle) => set({ angle })} />
      <ColorPicker label="Color 颜色" value={l.color} onChange={(color) => set({ color })} />
    </>
  );
}

function SepalControls() {
  const sp = usePlant((st) => st.spec.sepals);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof sp>) => update("sepals", patch);
  const petalColor = usePlant((st) => st.spec.petals.color);
  return (
    <>
      <Slider label="Sepal Count 萼片数量" value={sp.count} min={0} max={10} step={1} onChange={(count) => set({ count })} />
      <Choice
        label="Sepal Shape 萼片形状"
        value={sp.shape}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "pointed", label: "Pointed 尖形" },
          { value: "round", label: "Round 圆形" },
          { value: "narrow", label: "Narrow 细长" },
          DRAWN,
        ]}
      />
      {sp.shape === "drawn" && (
        <DrawPad width={(v) => sepalWidth("drawn", v, sp.drawnSepal)} color={sp.color} onDraw={(drawnSepal) => set({ drawnSepal })} />
      )}
      <Choice
        label="Bud Shape 花蕾形状"
        value={sp.budShape}
        onChange={(budShape) => set({ budShape })}
        options={[
          { value: "round", label: "Round 圆形" },
          { value: "oval", label: "Oval 椭圆" },
          { value: "pointed", label: "Pointed 尖形" },
          DRAWN,
        ]}
      />
      {sp.budShape === "drawn" && (
        <DrawPad width={(v) => budWidth("drawn", v, sp.drawnBud)} color={petalColor} onDraw={(drawnBud) => set({ drawnBud })} />
      )}
      <Slider label="Bud Count 花蕾数量" value={sp.budCount} min={0} max={8} step={1} onChange={(budCount) => set({ budCount })} />
      <ColorPicker label="Color 颜色" value={sp.color} onChange={(color) => set({ color })} />
    </>
  );
}

function ArchitectureControls() {
  const a = usePlant((st) => st.spec.architecture);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof a>) => update("architecture", patch);
  return (
    <>
      <Choice
        label="Structure 结构"
        value={a.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "single", label: "Single 单茎单花" },
          { value: "branched", label: "Branched 分枝多花" },
          { value: "spike", label: "Spike 穗状花序" },
          { value: "cluster", label: "Cluster 聚集式花序" },
        ]}
      />
      {(a.mode === "spike" || a.mode === "cluster") && (
        <Slider label="Flowers 花朵数量" value={a.flowers} min={3} max={30} step={1} onChange={(flowers) => set({ flowers })} />
      )}
      {a.mode === "branched" && <p className="hint">Set the number of branches in 01 Stem → Branching.</p>}
    </>
  );
}

function PetalControls() {
  const p = usePlant((st) => st.spec.petals);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof p>) => update("petals", patch);
  const abstract = p.style === "abstract";
  return (
    <>
      <Choice
        label="Style 风格"
        value={p.style}
        onChange={(style) => set({ style })}
        options={[
          { value: "natural", label: "Natural 自然" },
          { value: "abstract", label: "Abstract 抽象几何" },
        ]}
      />
      {abstract ? (
        <>
          <Choice
            label="Join 连接"
            value={p.join}
            onChange={(join) => set({ join })}
            options={[
              { value: "separate", label: "Separate 分开" },
              { value: "fused", label: "Fused 融合" },
            ]}
          />
          {p.join === "fused" ? (
            <>
              <p className="hint">Fused melts rounded petals and stalks into one smooth shape.</p>
              <Slider label="Stalk Length 花梗长度" value={p.stalk} min={0} max={0.3} step={0.005} format={cm} onChange={(stalk) => set({ stalk })} />
              <Slider label="Stalk Width 花梗粗细" value={p.stalkWidth} min={0.002} max={0.04} step={0.001} format={mm} onChange={(stalkWidth) => set({ stalkWidth })} />
              <Slider label="Blend 融合度" value={p.blend} min={0} max={1} step={0.01} format={pct} onChange={(blend) => set({ blend })} />
              <Slider label="Detail 精度" value={p.detail} min={32} max={96} step={8} onChange={(detail) => set({ detail })} />
            </>
          ) : (
          <Choice
            label="Primitive 几何体"
            value={p.primitive}
            onChange={(primitive) => set({ primitive })}
            options={[
              { value: "sphere", label: "Sphere 球" },
              { value: "gem", label: "Gem 多面体" },
              { value: "cube", label: "Cube 方块" },
              { value: "cone", label: "Cone 圆锥" },
              { value: "torus", label: "Torus 圆环" },
              { value: "capsule", label: "Capsule 胶囊" },
            ]}
          />
          )}
          <Slider label="Width 宽度" value={p.width} min={0.1} max={1.5} step={0.01} format={pct} onChange={(width) => set({ width })} />
          <Slider label="Thickness 厚度" value={p.thickness} min={0.05} max={1.5} step={0.01} format={pct} onChange={(thickness) => set({ thickness })} />
        </>
      ) : (
      <Choice
        label="Shape 形状"
        value={p.shape}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "round", label: "Round 圆形" },
          { value: "pointed", label: "Pointed 尖形" },
          { value: "wavy", label: "Wavy 波浪形" },
          DRAWN,
        ]}
      />
      )}
      {!abstract && p.shape === "drawn" && (
        <DrawPad width={(v) => petalWidth("drawn", v, p.drawn)} color={p.color} onDraw={(drawn) => set({ drawn })} />
      )}
      <Slider label="Number 数量" value={p.count} min={3} max={24} step={1} onChange={(count) => set({ count })} />
      <Slider label="Layers 层数" value={p.layers} min={1} max={4} step={1} format={(n) => (n === 1 ? "1 · single 单层" : `${n} · multi 多层`)} onChange={(layers) => set({ layers })} />
      <Slider label="Size 大小" value={p.size} min={0.05} max={0.4} step={0.005} format={cm} onChange={(size) => set({ size })} />
      <Slider label="Curvature 弯曲程度" value={p.curvature} min={-1} max={1} step={0.01} format={pct} onChange={(curvature) => set({ curvature })} />
      <Slider label="Spread 张开角度" value={p.spread} min={10} max={120} step={1} format={deg} onChange={(spread) => set({ spread })} />
      {abstract && p.layers > 1 && (
        <Slider label="Layer Gap 层间距" value={p.layerGap} min={-0.15} max={0.15} step={0.005} format={cm} onChange={(layerGap) => set({ layerGap })} />
      )}
      <ColorPicker label={abstract ? "Color 1 颜色一" : "Color 颜色"} value={p.color} onChange={(color) => set({ color })} />
      {abstract && (
        <>
          <ColorPicker label="Color 2 颜色二" value={p.color2} onChange={(color2) => set({ color2 })} />
          <Choice
            label="Gradient 渐变"
            value={p.gradient}
            onChange={(gradient) => set({ gradient })}
            options={[
              { value: "facing", label: "Top ↔ Under 朝向" },
              { value: "length", label: "Base → Tip 沿长度" },
            ]}
          />
          <Slider label="Bands 色带" value={p.bands} min={1} max={6} step={1} onChange={(bands) => set({ bands })} />
        </>
      )}
    </>
  );
}

function CenterControls() {
  const c = usePlant((st) => st.spec.center);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof c>) => update("center", patch);
  return (
    <>
      <Choice
        label="Type 类型"
        value={c.type}
        onChange={(type) => set({ type })}
        options={[
          { value: "disc", label: "Disc 圆盘形" },
          { value: "column", label: "Column 柱状" },
          { value: "stamens", label: "Stamens 花蕊群" },
        ]}
      />
      <Slider label="Size 直径" value={c.size} min={0.02} max={0.25} step={0.005} format={cm} onChange={(size) => set({ size })} />
      <Slider label="Height 突出程度" value={c.height} min={0} max={0.15} step={0.002} format={cm} onChange={(height) => set({ height })} />
      <Slider label="Density 密度" value={c.density} min={0} max={400} step={1} onChange={(density) => set({ density })} />
      <ColorPicker label="Color 中心颜色" value={c.color} onChange={(color) => set({ color })} />
    </>
  );
}

/**
 * Material category (材质) of every part section. Materials are still images; motion is in Animation.
 * Natural / Pearl 珍珠 / Dream 梦境 / Glitch 故障, each with its own settings, stored in spec.materials[part].
 */
function MaterialControls({ part, hasLength = false }: { part: MaterialPart; hasLength?: boolean }) {
  const m = usePlant((st) => st.spec.materials[part]);
  const update = usePlant((st) => st.update);
  // Always start from the latest store state so quick successive changes don't undo each other.
  const latest = () => usePlant.getState().spec.materials[part];
  const setType = (type: MaterialType) => update("materials", { [part]: { ...latest(), type } });
  const setPearl = (patch: Partial<PearlSpec>) => update("materials", { [part]: { ...latest(), pearl: { ...latest().pearl, ...patch } } });
  const setDream = (patch: Partial<DreamSpec>) => update("materials", { [part]: { ...latest(), dream: { ...latest().dream, ...patch } } });
  const setGlitch = (patch: Partial<GlitchSpec>) => update("materials", { [part]: { ...latest(), glitch: { ...latest().glitch, ...patch } } });
  return (
    <>
      <Choice
        label="Type 类型"
        value={m.type}
        onChange={setType}
        options={[
          { value: "natural", label: "Natural 自然" },
          { value: "pearl", label: "Pearl 珍珠" },
          { value: "dream", label: "Dream 梦境" },
          { value: "glitch", label: "Glitch 故障" },
        ]}
      />
      {m.type === "pearl" && <PearlControls p={m.pearl} set={setPearl} />}
      {m.type === "dream" && <DreamControls d={m.dream} set={setDream} hasLength={hasLength} halo={part !== "stem"} />}
      {m.type === "glitch" && <GlitchControls g={m.glitch} set={setGlitch} />}
    </>
  );
}

/**
 * Animation category (动画): the part picks ONE motion, which moves only this part.
 * Pattern motion is only offered for materials that have a pattern (Dream, Glitch).
 */
function AnimationControls({ part }: { part: MaterialPart }) {
  const a = usePlant((st) => st.spec.animations[part]);
  const material = usePlant((st) => st.spec.materials[part].type);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<AnimationSpec>) =>
    update("animations", { [part]: { ...usePlant.getState().spec.animations[part], ...patch } });
  const hasPattern = material === "dream" || material === "glitch";
  const type = a.type === "pattern" && !hasPattern ? "none" : a.type;
  return (
    <>
      <Choice
        label="Motion 动态"
        value={type}
        onChange={(t) => set({ type: t })}
        options={[
          { value: "none", label: "None 静止" },
          { value: "sway", label: "Sway 摇摆" },
          { value: "pulse", label: "Pulse 呼吸" },
          { value: "glitch", label: "Glitch 故障" },
          ...(hasPattern ? [{ value: "pattern" as const, label: "Pattern 图案流动" }] : []),
        ]}
      />
      {part === "stem" && type === "sway" && <p className="hint">The whole plant sways with the stem, so parts stay attached.</p>}
      {type !== "none" && (
        <>
          <Slider label="Amount 强度" value={a.amount} min={0} max={1} step={0.01} format={pct} onChange={(amount) => set({ amount })} />
          {type === "glitch" && (
            <Slider label="Glitch Bands 撕裂条高度" value={a.glitchBlock} min={0} max={1} step={0.01} format={pct} onChange={(glitchBlock) => set({ glitchBlock })} />
          )}
          <Slider label="Speed 速度" value={a.speed} min={0} max={1} step={0.01} format={pct} onChange={(speed) => set({ speed })} />
        </>
      )}
    </>
  );
}

/** Whole-plant animation (整体动画): glitch tearing shared by every part, on top of each part's own motion. */
function PlantAnimationControls() {
  const p = usePlant((st) => st.spec.plantAnimation);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof p>) => update("plantAnimation", patch);
  return (
    <>
      <Slider label="Glitch 整体故障" value={p.glitch} min={0} max={1} step={0.01} format={pct} onChange={(glitch) => set({ glitch })} />
      {p.glitch > 0 && (
        <>
          <Slider label="Glitch Bands 撕裂条高度" value={p.glitchBlock} min={0} max={1} step={0.01} format={pct} onChange={(glitchBlock) => set({ glitchBlock })} />
          <Slider label="Speed 速度" value={p.speed} min={0} max={1} step={0.01} format={pct} onChange={(speed) => set({ speed })} />
        </>
      )}
      <p className="hint">Tears every part together, on top of each part's own Animation.</p>
    </>
  );
}

function PearlControls({ p, set }: { p: PearlSpec; set: (patch: Partial<PearlSpec>) => void }) {
  // Small picture of the painted light ball, so the player sees what the colors do.
  const preview = useMemo(() => paintMatcap(p, 96).toDataURL(), [p]);
  return (
    <>
      <img className="matcap-preview" src={preview} alt="Pearl light preview" />
      <ColorPicker label="Highlight 高光" value={p.highlight} onChange={(highlight) => set({ highlight })} />
      <ColorPicker label="Glow 光晕/边缘" value={p.glow} onChange={(glow) => set({ glow })} />
      <ColorPicker label="Body 主体" value={p.body} onChange={(body) => set({ body })} />
      <ColorPicker label="Shadow 暗部" value={p.shadow} onChange={(shadow) => set({ shadow })} />
      <Slider label="Highlight Size 高光大小" value={p.highlightSize} min={0.05} max={0.7} step={0.01} format={pct} onChange={(highlightSize) => set({ highlightSize })} />
      <Slider label="Softness 柔和度" value={p.softness} min={0} max={1} step={0.01} format={pct} onChange={(softness) => set({ softness })} />
      <Slider label="Rim 边缘光" value={p.rim} min={0} max={1} step={0.01} format={pct} onChange={(rim) => set({ rim })} />
      <Slider label="Light Angle 光源方向" value={p.lightAngle} min={0} max={360} step={1} format={deg} onChange={(lightAngle) => set({ lightAngle })} />
      <Choice
        label="Part Colors 部件颜色"
        value={p.tint ? "on" : "off"}
        onChange={(v) => set({ tint: v === "on" })}
        options={[
          { value: "off", label: "Off 纯珍珠色" },
          { value: "on", label: "On 叠加部件颜色" },
        ]}
      />
    </>
  );
}

/** Dream material (inside the part). The blurred whole-screen version is 08 Effect. */
function DreamControls({ d, set, hasLength, halo }: {
  d: DreamSpec;
  set: (patch: Partial<DreamSpec>) => void;
  hasLength: boolean; // part has a base→tip direction (blades); otherwise "Length" isn't offered
  halo: boolean; // part can have a halo shell (not the stem)
}) {
  const setRamp = (i: number, color: string) => set({ ramp: d.ramp.map((c, k) => (k === i ? color : c)) });
  const input = !hasLength && d.input === "length" ? "facing" : d.input;
  const ends: Record<typeof d.input, [string, string]> = {
    facing: ["center 中心", "edge 边缘"],
    length: ["base 根部", "tip 尖端"],
    noise: ["low 低", "high 高"],
  };
  const names = [`1 ${ends[input][0]}`, "2", "3", "4", `5 ${ends[input][1]}`];
  return (
    <>
      <Choice
        label="Color By 颜色依据"
        value={input}
        onChange={(v) => set({ input: v })}
        options={[
          { value: "facing", label: "Facing 朝向" },
          ...(hasLength ? [{ value: "length" as const, label: "Length 沿长度" }] : []),
          { value: "noise", label: "Noise 噪声" },
        ]}
      />
      <div className="ramp-preview" style={{ background: `linear-gradient(90deg, ${d.ramp.join(", ")})` }} />
      {d.ramp.map((c, i) => (
        <ColorPicker key={i} label={`Ramp ${names[i]}`} value={c} onChange={(v) => setRamp(i, v)} />
      ))}
      <Slider label="Repeat 色带重复" value={d.repeat} min={1} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(repeat) => set({ repeat })} />
      <Slider label="Fringe 色散" value={d.fringe} min={0} max={1} step={0.01} format={pct} onChange={(fringe) => set({ fringe })} />
      <Slider label="Flow 流动" value={d.flow} min={0} max={1} step={0.01} format={pct} onChange={(flow) => set({ flow })} />
      <Slider label="Edge Fade 边缘淡出" value={d.edge} min={0} max={1} step={0.01} format={pct} onChange={(edge) => set({ edge })} />
      {halo && (
        <Slider label="Halo 光晕大小" value={d.halo} min={0} max={0.6} step={0.01} format={pct} onChange={(h) => set({ halo: h })} />
      )}
      {halo && d.halo > 0 && (
        <>
          <ColorPicker label="Halo Color 光晕颜色" value={d.haloColor} onChange={(haloColor) => set({ haloColor })} />
          <Slider label="Halo Opacity 光晕强度" value={d.haloOpacity} min={0} max={1} step={0.01} format={pct} onChange={(haloOpacity) => set({ haloOpacity })} />
        </>
      )}
    </>
  );
}

/** Glitch material (still image): grey levels, stripes, neon accents, grain. Tearing is in Animation. */
function GlitchControls({ g, set }: { g: GlitchSpec; set: (patch: Partial<GlitchSpec>) => void }) {
  return (
    <>
      <div
        className="ramp-preview"
        style={{ background: `linear-gradient(90deg, ${g.dark} 0 30%, ${g.mid} 30% 60%, ${g.light} 60% 80%, ${g.accent} 80% 90%, ${g.accent2} 90%)` }}
      />
      <ColorPicker label="Dark 暗灰" value={g.dark} onChange={(dark) => set({ dark })} />
      <ColorPicker label="Mid 中灰" value={g.mid} onChange={(mid) => set({ mid })} />
      <ColorPicker label="Light 亮色" value={g.light} onChange={(light) => set({ light })} />
      <ColorPicker label="Accent 1 强调色" value={g.accent} onChange={(accent) => set({ accent })} />
      <ColorPicker label="Accent 2 强调色" value={g.accent2} onChange={(accent2) => set({ accent2 })} />
      <Slider label="Levels 灰阶层数" value={g.levels} min={2} max={6} step={1} format={(v) => String(v)} onChange={(levels) => set({ levels })} />
      <Slider label="Stripes 竖条纹" value={g.stripes} min={0} max={1} step={0.01} format={pct} onChange={(stripes) => set({ stripes })} />
      <Slider label="Stripe Width 条纹宽度" value={g.stripeWidth} min={2} max={12} step={0.5} format={(v) => `${v}px`} onChange={(stripeWidth) => set({ stripeWidth })} />
      <Slider label="Block Height 色块高度" value={g.block} min={0} max={1} step={0.01} format={pct} onChange={(block) => set({ block })} />
      <Slider label="Accents 强调色量" value={g.accents} min={0} max={1} step={0.01} format={pct} onChange={(accents) => set({ accents })} />
      <Slider label="Grain 颗粒" value={g.grain} min={0} max={1} step={0.01} format={pct} onChange={(grain) => set({ grain })} />
    </>
  );
}

/** Scene 场景: background and ground (not part of the plant). */
function SceneControls() {
  const sc = usePlant((st) => st.spec.scene);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof sc>) => update("scene", patch);
  return (
    <>
      <ColorPicker label="Background 背景" value={sc.background} onChange={(background) => set({ background })} />
      <Choice
        label="Ground 地面"
        value={sc.ground ? "on" : "off"}
        onChange={(v) => set({ ground: v === "on" })}
        options={[
          { value: "on", label: "Show 显示" },
          { value: "off", label: "Hide 隐藏" },
        ]}
      />
    </>
  );
}

function EffectControls() {
  const e = usePlant((st) => st.spec.effect);
  const update = usePlant((st) => st.update);
  const set = (patch: Partial<typeof e>) => update("effect", patch);
  const setRamp = (i: number, color: string) => set({ ramp: e.ramp.map((c, k) => (k === i ? color : c)) });
  const rampNames = ["1 暗部 dark", "2", "3", "4", "5 亮部 bright"];
  return (
    <>
      <Choice
        label="Effect 后期效果"
        value={e.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "none", label: "None 无" },
          { value: "dream", label: "Dream 梦境" },
        ]}
      />
      {e.mode === "dream" && (
        <>
          <p className="hint">Blurs the picture, then recolors it by brightness with the ramp below.</p>
          <div className="ramp-preview" style={{ background: `linear-gradient(90deg, ${e.ramp.join(", ")})` }} />
          {e.ramp.map((c, i) => (
            <ColorPicker key={i} label={`Ramp ${rampNames[i]}`} value={c} onChange={(v) => setRamp(i, v)} />
          ))}
          <Slider label="Blur 模糊" value={e.blur} min={0} max={1} step={0.01} format={pct} onChange={(blur) => set({ blur })} />
          <Slider label="Contrast 对比度" value={e.contrast} min={0.5} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(contrast) => set({ contrast })} />
          <Slider label="Offset 偏移" value={e.offset} min={-0.5} max={0.5} step={0.01} format={(v) => v.toFixed(2)} onChange={(offset) => set({ offset })} />
          <Slider label="Repeat 色带重复" value={e.repeat} min={1} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(repeat) => set({ repeat })} />
          <Slider label="Fringe 色散" value={e.aberration} min={0} max={1} step={0.01} format={pct} onChange={(aberration) => set({ aberration })} />
          <Slider label="Grain 颗粒" value={e.grain} min={0} max={1} step={0.01} format={pct} onChange={(grain) => set({ grain })} />
        </>
      )}
    </>
  );
}

export default function Panel() {
  const reset = usePlant((st) => st.reset);
  return (
    <aside className="panel">
      <div className="panel-head">
        <h1>Flower Builder</h1>
        <button type="button" className="ghost" onClick={reset}>Reset 重置</button>
      </div>
      <PartSection num="01" en="Stem" zh="茎" open part="stem" form={<StemControls />} />
      <PartSection num="02" en="Leaves" zh="叶" part="leaves" hasLength form={<LeafControls />} />
      <PartSection num="03" en="Petals" zh="花瓣" open part="petals" hasLength form={<PetalControls />} />
      <PartSection num="04" en="Flower Center" zh="花心" open part="center" form={<CenterControls />} />
      <PartSection num="05" en="Sepals & Buds" zh="萼片与花蕾" part="sepals" hasLength form={<SepalControls />} />
      <Section num="06" en="Architecture" zh="整体结构" open>
        <ArchitectureControls />
      </Section>
      <Section num="07" en="Whole Plant Animation" zh="整体动画">
        <PlantAnimationControls />
      </Section>
      <Section num="08" en="Scene" zh="场景">
        <SceneControls />
      </Section>
      <Section num="09" en="Effect" zh="后期效果" open>
        <EffectControls />
      </Section>
    </aside>
  );
}
