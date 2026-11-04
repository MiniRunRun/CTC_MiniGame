// Slider panel: one collapsible section per flower part (see docs/GAME_DESIGN.md).
// Every section has working controls (milestones 2–3). Free drawing of shapes comes in milestone 4.
import type { ReactNode } from "react";
import { usePlant } from "../state/store";
import { Choice, ColorPicker, Slider, cm, deg, mm, pct } from "./controls";

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
        ]}
      />
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
        ]}
      />
      <Choice
        label="Bud Shape 花蕾形状"
        value={sp.budShape}
        onChange={(budShape) => set({ budShape })}
        options={[
          { value: "round", label: "Round 圆形" },
          { value: "oval", label: "Oval 椭圆" },
          { value: "pointed", label: "Pointed 尖形" },
        ]}
      />
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
  return (
    <>
      <Choice
        label="Shape 形状"
        value={p.shape}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "round", label: "Round 圆形" },
          { value: "pointed", label: "Pointed 尖形" },
          { value: "wavy", label: "Wavy 波浪形" },
        ]}
      />
      <Slider label="Number 数量" value={p.count} min={3} max={24} step={1} onChange={(count) => set({ count })} />
      <Slider label="Layers 层数" value={p.layers} min={1} max={4} step={1} format={(n) => (n === 1 ? "1 · single 单层" : `${n} · multi 多层`)} onChange={(layers) => set({ layers })} />
      <Slider label="Size 大小" value={p.size} min={0.05} max={0.4} step={0.005} format={cm} onChange={(size) => set({ size })} />
      <Slider label="Curvature 弯曲程度" value={p.curvature} min={-1} max={1} step={0.01} format={pct} onChange={(curvature) => set({ curvature })} />
      <Slider label="Spread 张开角度" value={p.spread} min={10} max={120} step={1} format={deg} onChange={(spread) => set({ spread })} />
      <ColorPicker label="Color 颜色" value={p.color} onChange={(color) => set({ color })} />
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

export default function Panel() {
  const reset = usePlant((st) => st.reset);
  return (
    <aside className="panel">
      <div className="panel-head">
        <h1>Flower Builder</h1>
        <button type="button" className="ghost" onClick={reset}>Reset 重置</button>
      </div>
      <Section num="01" en="Stem" zh="茎" open>
        <StemControls />
      </Section>
      <Section num="02" en="Leaves" zh="叶">
        <LeafControls />
      </Section>
      <Section num="03" en="Petals" zh="花瓣" open>
        <PetalControls />
      </Section>
      <Section num="04" en="Flower Center" zh="花心" open>
        <CenterControls />
      </Section>
      <Section num="05" en="Sepals & Buds" zh="萼片与花蕾">
        <SepalControls />
      </Section>
      <Section num="06" en="Architecture" zh="整体结构" open>
        <ArchitectureControls />
      </Section>
    </aside>
  );
}
