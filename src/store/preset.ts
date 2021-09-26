import { StoreOptions } from "vuex";
import { State } from "@/store/type";
import { Preset } from "@/type/preload";

export const SET_PRESETS = "SET_PRESETS";
export const GET_PRESETS = "GET_PRESETS";
export const SAVE_PRESETS = "SAVE_PRESETS";

export const presetStore = {
  getters: {},
  mutations: {
    [SET_PRESETS]: (
      state,
      { newPresets }: { newPresets: Record<number, Preset[]> }
    ) => {
      state.presets = newPresets;
    },
  },
  actions: {
    [GET_PRESETS]: async (context) => {
      const newPresets = await window.electron.savingPresets();
      if (newPresets === undefined) return;
      context.commit(SET_PRESETS, { newPresets });
    },

    [SAVE_PRESETS]: (
      context,
      {
        characterIndex,
        presetsData,
      }: { characterIndex: number; presetsData: Preset[] }
    ) => {
      console.log(characterIndex, presetsData);
      window.electron
        .savingPresets({ characterIndex, presetsData })
        .then((e) => context.commit(SET_PRESETS, { newPresets: e }));
    },
  },
} as StoreOptions<State>;
