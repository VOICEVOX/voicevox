import { v4 as uuidv4 } from "uuid";
import { createPartialStore } from "./vuex";
import { PresetStoreState, PresetStoreTypes } from "@/store/type";
import { Preset, PresetKey, VoiceId } from "@/type/preload";

import { voiceToVoiceId } from "@/lib/voice";

export const presetStoreState: PresetStoreState = {
  presetItems: {},
  presetKeys: [],
  defaultPresetKeys: {},
};

export const presetStore = createPartialStore<PresetStoreTypes>({
  SET_PRESET_ITEMS: {
    mutation(
      state,
      { presetItems }: { presetItems: Record<PresetKey, Preset> }
    ) {
      state.presetItems = presetItems;
    },
  },

  SET_PRESET_KEYS: {
    mutation(state, { presetKeys }: { presetKeys: PresetKey[] }) {
      state.presetKeys = presetKeys;
    },
  },

  SET_DEFAULT_PRESET_MAP: {
    action(
      { commit },
      { defaultPresetKeys }: { defaultPresetKeys: Record<VoiceId, PresetKey> }
    ) {
      window.electron.setSetting("defaultPresetKeys", defaultPresetKeys);
      commit("SET_DEFAULT_PRESET_MAP", { defaultPresetKeys });
    },
    mutation(
      state,
      { defaultPresetKeys }: { defaultPresetKeys: Record<VoiceId, PresetKey> }
    ) {
      state.defaultPresetKeys = defaultPresetKeys;
    },
  },

  HYDRATE_PRESET_STORE: {
    async action({ commit }) {
      const defaultPresetKeys = (await window.electron.getSetting(
        "defaultPresetKeys"
        // z.BRAND型のRecordはPartialになる仕様なのでasで型を変換
        // TODO: 将来的にzodのバージョンを上げてasを消す https://github.com/colinhacks/zod/pull/2097
      )) as Record<VoiceId, PresetKey>;

      commit("SET_DEFAULT_PRESET_MAP", {
        defaultPresetKeys,
      });

      const presetConfig = await window.electron.getSetting("presets");
      if (
        presetConfig === undefined ||
        presetConfig.items === undefined ||
        presetConfig.keys === undefined
      )
        return;
      commit("SET_PRESET_ITEMS", {
        // z.BRAND型のRecordはPartialになる仕様なのでasで型を変換
        // TODO: 将来的にzodのバージョンを上げてasを消す https://github.com/colinhacks/zod/pull/2097
        presetItems: presetConfig.items as Record<PresetKey, Preset>,
      });
      commit("SET_PRESET_KEYS", {
        presetKeys: presetConfig.keys,
      });
    },
  },

  SAVE_PRESET_ORDER: {
    action({ state, dispatch }, { presetKeys }: { presetKeys: PresetKey[] }) {
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
      }: { presetItems: Record<PresetKey, Preset>; presetKeys: PresetKey[] }
    ) {
      const result = await window.electron.setSetting("presets", {
        items: JSON.parse(JSON.stringify(presetItems)),
        keys: JSON.parse(JSON.stringify(presetKeys)),
      });
      context.commit("SET_PRESET_ITEMS", {
        // z.BRAND型のRecordはPartialになる仕様なのでasで型を変換
        // TODO: 将来的にzodのバージョンを上げてasを消す https://github.com/colinhacks/zod/pull/2097
        presetItems: result.items as Record<PresetKey, Preset>,
      });
      context.commit("SET_PRESET_KEYS", { presetKeys: result.keys });
    },
  },

  ADD_PRESET: {
    async action(context, { presetData }: { presetData: Preset }) {
      const newKey = PresetKey(uuidv4());
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

  CREATE_ALL_DEFAULT_PRESET: {
    async action({ dispatch, getters }) {
      window.electron.getSetting("defaultPresetKeys");

      const voices = getters.GET_ALL_VOICES;

      for await (const voice of voices) {
        await dispatch("CREATE_DEFAULT_PRESET_IF_NEEDED", { voice });
      }
    },
  },

  CREATE_DEFAULT_PRESET_IF_NEEDED: {
    async action({ state, dispatch, getters }, { voice }) {
      const voiceId = voiceToVoiceId(voice);
      const defaultPresetKey = state.defaultPresetKeys[voiceId];

      if (state.presetKeys.includes(defaultPresetKey)) {
        return defaultPresetKey;
      }

      const characterName = getters.CHARACTER_NAME(voice);

      const audioQuery = await dispatch("FETCH_AUDIO_QUERY", {
        engineId: voice.engineId,
        styleId: voice.styleId,
        text: "",
      });

      const presetData: Preset = {
        name: `デフォルト：${characterName}`,
        speedScale: audioQuery.speedScale,
        pitchScale: audioQuery.pitchScale,
        intonationScale: audioQuery.intonationScale,
        volumeScale: audioQuery.volumeScale,
        prePhonemeLength: audioQuery.prePhonemeLength,
        postPhonemeLength: audioQuery.postPhonemeLength,
      };
      const newPresetKey = await dispatch("ADD_PRESET", { presetData });

      await dispatch("SET_DEFAULT_PRESET_MAP", {
        defaultPresetKeys: {
          ...state.defaultPresetKeys,
          [voiceId]: newPresetKey,
        },
      });

      return newPresetKey;
    },
  },

  UPDATE_PRESET: {
    async action(
      context,
      { presetKey, presetData }: { presetData: Preset; presetKey: PresetKey }
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
    async action(context, { presetKey }: { presetKey: PresetKey }) {
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
