// Slider panel: one collapsible section per flower part (see docs/GAME_DESIGN.md).
// Milestone 1 only shows the empty sections; sliders are added from milestone 2.

const SECTIONS = [
  { id: "stem", num: "01", en: "Stem", zh: "茎" },
  { id: "leaves", num: "02", en: "Leaves", zh: "叶" },
  { id: "petals", num: "03", en: "Petals", zh: "花瓣" },
  { id: "center", num: "04", en: "Flower Center", zh: "花心" },
  { id: "sepals", num: "05", en: "Sepals & Buds", zh: "萼片与花蕾" },
  { id: "architecture", num: "06", en: "Architecture", zh: "整体结构" },
];

export default function Panel() {
  return (
    <aside className="panel">
      <h1>Flower Builder</h1>
      {SECTIONS.map((s) => (
        <details key={s.id} className="section">
          <summary>
            <span className="num">{s.num}</span> {s.en} <span className="zh">{s.zh}</span>
          </summary>
          <p className="todo">Controls coming soon.</p>
        </details>
      ))}
    </aside>
  );
}
