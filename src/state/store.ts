// Global flower state (zustand). The slider panel writes here; the 3D scene reads from here.
import { create } from "zustand";
import { DEFAULT_SPEC, type PartLayer, type PartName, type PartsSpec, type PlantSpec } from "../plant/spec";

/** Plant-level settings (everything that isn't a part). */
type PlantKey = Exclude<keyof PlantSpec, "parts">;

interface PlantState {
  spec: PlantSpec;
  /** Change some fields of a plant-level setting, e.g. update("scene", { ground: false }). */
  update: <K extends PlantKey>(key: K, patch: Partial<PlantSpec[K]>) => void;
  /** Change some fields of one layer of one part, e.g. setPart("stem", "shape", { length: 1.2 }). */
  setPart: <P extends PartName, L extends PartLayer>(part: P, layer: L, patch: Partial<PartsSpec[P][L]>) => void;
  reset: () => void;
}

export const usePlant = create<PlantState>((set) => ({
  spec: DEFAULT_SPEC,
  update: (key, patch) => set((s) => ({ spec: { ...s.spec, [key]: { ...s.spec[key], ...patch } } })),
  setPart: (part, layer, patch) =>
    set((s) => {
      const p = s.spec.parts[part];
      return { spec: { ...s.spec, parts: { ...s.spec.parts, [part]: { ...p, [layer]: { ...p[layer], ...patch } } } } };
    }),
  reset: () => set({ spec: DEFAULT_SPEC }),
}));
