import {
  PresetGetters,
  PresetActions,
  PresetMutations,
  PresetStoreState,
  VoiceVoxStoreOptions,
} from "@/store/type";
import { Preset } from "@/type/preload";

import { v4 as uuidv4 } from "uuid";

export const presetStoreState: PresetStoreState = {
  presetItems: {},
  presetKeys: [],
};

export const presetStore: VoiceVoxStoreOptions<
  PresetGetters,
  PresetActions,
  PresetMutations
> = {
  getters: {},
  mutations: {
    SET_PRESET_ITEMS(
      state,
      { presetItems }: { presetItems: Record<string, Preset> }
    ) {
      state.presetItems = presetItems;
    },

    SET_PRESET_KEYS(state, { presetKeys }: { presetKeys: string[] }) {
      state.presetKeys = presetKeys;
    },
  },
  actions: {
    HYDRATE_PRESET_STORE: async ({ commit }) => {
      const presetConfig = await window.electron.getSetting("presets");
      if (
        presetConfig === undefined ||
        presetConfig.items === undefined ||
        presetConfig.keys === undefined
      )
        return;
      commit("SET_PRESET_ITEMS", {
        presetItems: presetConfig.items,
      });
      commit("SET_PRESET_KEYS", {
        presetKeys: presetConfig.keys,
      });
    },

    SAVE_PRESET_ORDER(
      { state, dispatch },
      { presetKeys }: { presetKeys: string[] }
    ) {
      return dispatch("SAVE_PRESET_CONFIG", {
        presetItems: state.presetItems,
        presetKeys,
      });
    },
    SAVE_PRESET_CONFIG: async (
      context,
      {
        presetItems,
        presetKeys,
      }: {
        presetItems: Record<string, Preset>;
        presetKeys: string[];
      }
    ) => {
      const result = await window.electron.setSetting("presets", {
        items: JSON.parse(JSON.stringify(presetItems)),
        keys: JSON.parse(JSON.stringify(presetKeys)),
      });
      context.commit("SET_PRESET_ITEMS", { presetItems: result.items });
      context.commit("SET_PRESET_KEYS", { presetKeys: result.keys });
    },

    async ADD_PRESET(context, { presetData }: { presetData: Preset }) {
      const newKey = uuidv4();
      const newPresetItems = {
        ...context.state.presetItems,
        [newKey]: presetData,
      };
      const newPresetKeys = [newKey, ...context.state.presetKeys];

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems: newPresetItems,
        presetKeys: newPresetKeys,
      });

      return newKey;
    },
    async UPDATE_PRESET(
      context,
      { presetKey, presetData }: { presetData: Preset; presetKey: string }
    ) {
      const newPresetItems = {
        ...context.state.presetItems,
        [presetKey]: presetData,
      };
      const newPresetKeys = context.state.presetKeys.includes(presetKey)
        ? [...context.state.presetKeys]
        : [presetKey, ...context.state.presetKeys];

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems: newPresetItems,
        presetKeys: newPresetKeys,
      });
    },
    async DELETE_PRESET(context, { presetKey }: { presetKey: string }) {
      const newPresetKeys = context.state.presetKeys.filter(
        (key) => key != presetKey
      );
      // Filter the `presetKey` properties from presetItems.
      const { [presetKey]: _, ...newPresetItems } = context.state.presetItems;

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems: newPresetItems,
        presetKeys: newPresetKeys,
      });
    },
  },
};
