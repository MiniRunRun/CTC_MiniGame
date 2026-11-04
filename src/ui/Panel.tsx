// Slider panel: one collapsible section per flower part (see docs/GAME_DESIGN.md).
// Stem, Petals and Center work (milestone 2). Leaves, Sepals & Buds and Architecture come in milestone 3.
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
      <p className="hint">Branching 分枝 arrives with Architecture (milestone 3).</p>
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
        <p className="hint">Coming in milestone 3.</p>
      </Section>
      <Section num="03" en="Petals" zh="花瓣" open>
        <PetalControls />
      </Section>
      <Section num="04" en="Flower Center" zh="花心" open>
        <CenterControls />
      </Section>
      <Section num="05" en="Sepals & Buds" zh="萼片与花蕾">
        <p className="hint">Coming in milestone 3.</p>
      </Section>
      <Section num="06" en="Architecture" zh="整体结构">
        <p className="hint">Coming in milestone 3.</p>
      </Section>
    </aside>
  );
}
