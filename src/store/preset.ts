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
      { presetData, audioKey }: { presetData: Preset; audioKey?: string }
    ) => {
      const speaker = presetData.speaker;

      const presetItems = { ...context.state.presetItems };
      const presetKeys = { ...context.state.presetKeys };

      presetKeys[speaker] =
        presetKeys[speaker] !== undefined ? [...presetKeys[speaker]] : [];

      const newKey = uuidv4();

      presetItems[newKey] = presetData;
      presetKeys[speaker].push(newKey);

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems,
        presetKeys,
      });

      // プリセットを登録したときのAudioItemに登録したプリセットを紐付けたいが、uuidが取れる場所がここしかなかったため仕方なく実装
      // プリセット(管理)のロジックにAudioのロジックが入り込んでしまっているので、対象方ができ次第変更する
      if (audioKey !== undefined) {
        context.dispatch("COMMAND_SET_AUDIO_PRESET", {
          audioKey,
          presetKey: newKey,
        });
      }
      return newKey;
    },
    UPDATE_PRESET: async (
      context,
      {
        presetData,
        oldKey,
        updatesAudioItems,
        audioKey,
      }: {
        presetData: Preset;
        oldKey: string;
        updatesAudioItems: boolean;
        audioKey: string;
      }
    ) => {
      const presetItems = { ...context.state.presetItems };
      const presetKeys = { ...context.state.presetKeys };
      const speaker = presetData.speaker;

      presetKeys[speaker] = [...context.state.presetKeys[speaker]];
      presetKeys[speaker].splice(
        presetKeys[speaker].findIndex((e) => e === oldKey),
        1
      );
      delete presetItems[oldKey];

      const newKey = uuidv4();
      presetItems[newKey] = presetData;
      presetKeys[speaker].push(newKey);

      await context.dispatch("SAVE_PRESET_CONFIG", {
        presetItems,
        presetKeys,
      });

      await context.dispatch("COMMAND_SET_AUDIO_PRESET", {
        audioKey,
        presetKey: newKey,
      });

      if (!updatesAudioItems) return;
      Object.entries(context.state.audioItems).forEach((e) => {
        if (e[1].presetKey === oldKey) {
          context.dispatch("COMMAND_SET_AUDIO_PRESET", {
            presetKey: newKey,
            audioKey: e[0],
          });
        }
      });
    },
  },
};
