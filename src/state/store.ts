// Global flower state (zustand). The slider panel writes here; the 3D scene reads from here.
import { create } from "zustand";
import { DEFAULT_SPEC, type PlantSpec } from "../plant/spec";

interface PlantState {
  spec: PlantSpec;
  /** Change some fields of one part, e.g. update("stem", { length: 1.2 }). */
  update: <K extends keyof PlantSpec>(part: K, patch: Partial<PlantSpec[K]>) => void;
  reset: () => void;
}

export const usePlant = create<PlantState>((set) => ({
  spec: DEFAULT_SPEC,
  update: (part, patch) =>
    set((s) => ({ spec: { ...s.spec, [part]: { ...s.spec[part], ...patch } } })),
  reset: () => set({ spec: DEFAULT_SPEC }),
}));
