import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { validatePreset, type EditablePresetId, type PresetOverride, type PresetOverrides } from '../converters/presets';
interface PresetState {
  overrides: PresetOverrides;
  save: (id: EditablePresetId, value: PresetOverride) => void;
  reset: (id: EditablePresetId) => void;
}
export const usePresetStore = create<PresetState>()(persist(set => ({
  overrides: {},
  save: (id, value) => {
    const clean = validatePreset(id, value);
    set(s => ({ overrides: { ...s.overrides, [id]: clean } }));
  },
  reset: id => set(s => {
    const overrides = { ...s.overrides };
    delete overrides[id];
    return { overrides };
  }),
}), {
  name: 'vert-enhanced-presets', version: 1,
  partialize: s => ({ overrides: s.overrides }),
  merge: (persisted, current) => {
    const raw = (persisted as {overrides?: unknown})?.overrides;
    const overrides: PresetOverrides = {};
    if (raw && typeof raw === 'object') {
      for (const [id, value] of Object.entries(raw)) {
        try { overrides[id as EditablePresetId] = validatePreset(id, value); }
        catch { /* Ignore invalid saved data; built-in definitions remain usable. */ }
      }
    }
    return { ...current, overrides };
  },
}));
