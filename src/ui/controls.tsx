// Reusable panel controls: slider, option buttons, color picker.

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** How to show the value, e.g. meters → "45 cm". Defaults to the plain number. */
  format?: (v: number) => string;
}

export function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <label className="ctl">
      <span className="ctl-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ctl-value">{format ? format(value) : value}</span>
    </label>
  );
}

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <div className="ctl">
      <span className="ctl-label">{label}</span>
      <div className="choice" role="radiogroup" aria-label={label} data-n={options.length}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? "on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ctl">
      <span className="ctl-label">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="ctl-value">{value}</span>
    </label>
  );
}

// Value formatters
export const cm = (m: number) => `${Math.round(m * 100)} cm`;
export const mm = (m: number) => `${(m * 1000).toFixed(m < 0.01 ? 1 : 0)} mm`;
export const deg = (d: number) => `${Math.round(d)}°`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
