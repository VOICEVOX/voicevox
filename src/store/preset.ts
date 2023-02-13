import { PresetStoreState, PresetStoreTypes } from "@/store/type";
import { Preset, Voice, VoiceId } from "@/type/preload";
import { createPartialStore } from "./vuex";

import { v4 as uuidv4 } from "uuid";
import { voiceToVoiceId } from "@/lib/voice";

export const presetStoreState: PresetStoreState = {
  presetItems: {},
  presetKeys: [],
  defaultPresetKeyMap: {},
};

export const presetStore = createPartialStore<PresetStoreTypes>({
  SET_PRESET_ITEMS: {
    mutation(state, { presetItems }: { presetItems: Record<string, Preset> }) {
      state.presetItems = presetItems;
    },
  },

  SET_PRESET_KEYS: {
    mutation(state, { presetKeys }: { presetKeys: string[] }) {
      state.presetKeys = presetKeys;
    },
  },

  SET_DEFAULT_PRESET_MAP: {
    action(
      { commit },
      { defaultPresetKeyMap }: { defaultPresetKeyMap: Record<VoiceId, string> }
    ) {
      window.electron.setSetting("defaultPresetKeyMap", defaultPresetKeyMap);
      commit("SET_DEFAULT_PRESET_MAP", { defaultPresetKeyMap });
    },
    mutation(
      state,
      { defaultPresetKeyMap }: { defaultPresetKeyMap: Record<VoiceId, string> }
    ) {
      state.defaultPresetKeyMap = defaultPresetKeyMap;
    },
  },

  HYDRATE_PRESET_STORE: {
    async action({ commit }) {
      // Branded typeがkeyのrecordのinfer結果がPartialで包まれてしまうのでキャストが必要、つらい
      const defaultPresetKeyMap = (await window.electron.getSetting(
        "defaultPresetKeyMap"
      )) as Record<VoiceId, string>;

      commit("SET_DEFAULT_PRESET_MAP", {
        defaultPresetKeyMap,
      });

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
  },

  SAVE_PRESET_ORDER: {
    action({ state, dispatch }, { presetKeys }: { presetKeys: string[] }) {
      return dispatch("SAVE_PRESET_CONFIG", {
        presetItems: state.presetItems,
        presetKeys,
      });
    },
  },

  SAVE_PRESET_CONFIG: {
    async action(
      context,
      {
        presetItems,
        presetKeys,
      }: { presetItems: Record<string, Preset>; presetKeys: string[] }
    ) {
      const result = await window.electron.setSetting("presets", {
        items: JSON.parse(JSON.stringify(presetItems)),
        keys: JSON.parse(JSON.stringify(presetKeys)),
      });
      context.commit("SET_PRESET_ITEMS", { presetItems: result.items });
      context.commit("SET_PRESET_KEYS", { presetKeys: result.keys });
    },
  },

  ADD_PRESET: {
    async action(
      context,
      { presetData, presetKey }: { presetData: Preset; presetKey?: string }
    ) {
      const newKey = presetKey ?? uuidv4();
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
  },

  CREATE_DEFAULT_PRESET_IF_NEEDED: {
    async action({ state, dispatch }, { voice }: { voice: Voice }) {
      const voiceId = voiceToVoiceId(voice);
      const defaultPresetKey = state.defaultPresetKeyMap[voiceId];

      if (state.presetKeys.includes(defaultPresetKey)) {
        return;
      }

      const presetKey = uuidv4();

      // 1. 初期値は /audio_query から得るべきか？
      // 2. プリセット名はhuman readableに名付けるべきか？
      const presetData: Preset = {
        name: presetKey,
        speedScale: 1,
        pitchScale: 0,
        intonationScale: 1,
        volumeScale: 1,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
      };
      await dispatch("ADD_PRESET", { presetData, presetKey });

      await dispatch("SET_DEFAULT_PRESET_MAP", {
        defaultPresetKeyMap: {
          ...state.defaultPresetKeyMap,
          [voiceId]: presetKey,
        },
      });
    },
  },

  UPDATE_PRESET: {
    async action(
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
  },

  DELETE_PRESET: {
    async action(context, { presetKey }: { presetKey: string }) {
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
});
