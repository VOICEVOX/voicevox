import {
  PresetGetters,
  PresetActions,
  PresetMutations,
  VoiceVoxStoreOptions,
} from "@/store/type";
import { Preset } from "@/type/preload";

import { v4 as uuidv4 } from "uuid";

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

    SET_PRESET_KEYS(
      state,
      { presetKeys }: { presetKeys: Record<number, string[]> }
    ) {
      state.presetKeys = presetKeys;
    },
  },
  actions: {
    GET_PRESET_CONFIG: async (context) => {
      const presetConfig = await window.electron.savingPresets();
      if (
        presetConfig === undefined ||
        presetConfig.items === undefined ||
        presetConfig.keys === undefined
      )
        return;
      context.commit("SET_PRESET_ITEMS", {
        presetItems: presetConfig.items,
      });
      context.commit("SET_PRESET_KEYS", {
        presetKeys: presetConfig.keys,
      });
    },

    SAVE_PRESET_CONFIG: async (
      context,
      {
        presetItems,
        presetKeys,
      }: {
        presetItems: Record<string, Preset>;
        presetKeys: Record<number, string[]>;
      }
    ) => {
      const result = await window.electron.savingPresets({
        presetItems: JSON.parse(JSON.stringify(presetItems)),
        presetKeys: JSON.parse(JSON.stringify(presetKeys)),
      });
      context.commit("SET_PRESET_ITEMS", { presetItems: result.items });
      context.commit("SET_PRESET_KEYS", { presetKeys: result.keys });
    },

    ADD_PRESET: async (
      context,
      { presetData, audioId }: { presetData: Preset; audioId?: string }
    ) => {
      const speaker = presetData.speaker;

      const presetItems = { ...context.state.presetItems };

      const presetKeys = { ...context.state.presetKeys };

      presetKeys[speaker] =
        presetKeys[speaker] !== undefined
          ? [...context.state.presetKeys[speaker]]
          : [];

      const newKey = uuidv4();

      presetItems[newKey] = presetData;
      presetKeys[speaker].push(newKey);

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems,
        presetKeys,
      });

      if (audioId !== undefined) {
        context.dispatch("COMMAND_SET_AUDIO_PRESET", {
          audioId,
          presetId: newKey,
        });
      }
    },
  },
};
