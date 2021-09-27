import { StoreOptions } from "vuex";
import { State } from "@/store/type";
import { Preset } from "@/type/preload";
import { COMMAND_SET_AUDIO_PRESET } from "./audio";

import { v4 as uuidv4 } from "uuid";

export const SET_PRESET_ITEMS = "SET_PRESET_ITEMS";
export const SET_PRESET_KEYS = "SET_PRESET_KEYS";
export const GET_PRESET_CONFIG = "GET_PRESET_CONFIG";
export const SAVE_PRESET_CONFIG = "SAVE_PRESET_CONFIG";
export const ADD_PRESET = "ADD_PRESET";

export const presetStore = {
  getters: {},
  mutations: {
    [SET_PRESET_ITEMS]: (
      state,
      { presetItems }: { presetItems: Record<number, Record<string, Preset>> }
    ) => {
      state.presetItems = presetItems;
    },

    [SET_PRESET_KEYS]: (
      state,
      { presetKeys }: { presetKeys: Record<number, string[]> }
    ) => {
      state.presetKeys = presetKeys;
    },
  },
  actions: {
    [GET_PRESET_CONFIG]: async (context) => {
      const presetConfig = await window.electron.savingPresets();
      if (
        presetConfig === undefined ||
        presetConfig.items === undefined ||
        presetConfig.keys === undefined
      )
        return;
      context.commit(SET_PRESET_ITEMS, { presetItems: presetConfig.items });
      context.commit(SET_PRESET_KEYS, { presetKeys: presetConfig.keys });
    },

    [SAVE_PRESET_CONFIG]: async (
      context,
      {
        characterIndex,
        presetItems,
        presetKeys,
      }: {
        characterIndex: number;
        presetItems: Record<string, Preset>;
        presetKeys: string[];
      }
    ) => {
      const result = await window.electron.savingPresets({
        characterIndex,
        presetItems,
        presetKeys,
      });
      context.commit(SET_PRESET_ITEMS, { presetItems: result.items });
      context.commit(SET_PRESET_KEYS, { presetKeys: result.keys });
    },

    [ADD_PRESET]: async (
      context,
      {
        characterIndex,
        presetData,
        audioId,
      }: { characterIndex: number; presetData: Preset; audioId?: string }
    ) => {
      const items =
        context.state.presetItems[characterIndex] !== undefined
          ? (JSON.parse(
              JSON.stringify(context.state.presetItems[characterIndex])
            ) as Record<string, Preset>)
          : {};
      const keys =
        context.state.presetKeys[characterIndex] !== undefined
          ? (JSON.parse(
              JSON.stringify(context.state.presetKeys[characterIndex])
            ) as string[])
          : [];

      const newKey = uuidv4();

      items[newKey] = presetData;
      keys.push(newKey);

      await context.dispatch(SAVE_PRESET_CONFIG, {
        characterIndex,
        presetItems: items,
        presetKeys: keys,
      });

      if (audioId !== undefined) {
        context.dispatch(COMMAND_SET_AUDIO_PRESET, {
          audioId,
          presetId: newKey,
        });
      }
    },
  },
} as StoreOptions<State>;
