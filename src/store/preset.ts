import { createPartialStore } from "./vuex";
import { PresetStoreState, PresetStoreTypes, State } from "@/store/type";
import { Preset, PresetKey, Voice, VoiceId } from "@/type/preload";

/**
 * configを参照して割り当てるべきpresetKeyとそのPresetを適用すべきかどうかを返す
 *
 * generate: プロジェクト新規作成時、空のAudioItemを作成する場合
 * copy: 元となるAudioItemがある場合（＋ボタンで作成したとき）
 * changeVoice: ボイス切り替え時
 */
export function determineNextPresetKey(
  state: Pick<
    State,
    "defaultPresetKeys" | "experimentalSetting" | "inheritAudioInfo"
  >,
  voice: Voice,
  presetKeyCandidate: PresetKey | undefined,
  operation: "generate" | "copy" | "changeVoice",
): {
  nextPresetKey: PresetKey | undefined;
  shouldApplyPreset: boolean;
} {
  const defaultPresetKeyForCurrentVoice =
    state.defaultPresetKeys[VoiceId(voice)];

  switch (operation) {
    case "generate": {
      // 初回作成時
      return {
        nextPresetKey: defaultPresetKeyForCurrentVoice,
        shouldApplyPreset: state.experimentalSetting.enablePreset,
      };
    }
    case "copy": {
      // 元となるAudioItemがある場合
      if (state.inheritAudioInfo) {
        // パラメータ引継ぎがONならそのまま引き継ぐ
        return {
          nextPresetKey: presetKeyCandidate,
          shouldApplyPreset: false,
        };
      }

      // それ以外はデフォルトプリセットを割り当て、適用するかはプリセットのON/OFFに依存
      return {
        nextPresetKey: defaultPresetKeyForCurrentVoice,
        shouldApplyPreset: state.experimentalSetting.enablePreset,
      };
    }
    case "changeVoice": {
      // ボイス切り替え時
      if (state.experimentalSetting.shouldApplyDefaultPresetOnVoiceChanged) {
        // デフォルトプリセットを適用する
        return {
          nextPresetKey: defaultPresetKeyForCurrentVoice,
          shouldApplyPreset: true,
        };
      }

      const isDefaultPreset = Object.values(state.defaultPresetKeys).some(
        (key) => key === presetKeyCandidate,
      );

      // 引き継ぎ元が他スタイルのデフォルトプリセットだった場合
      // 別キャラのデフォルトプリセットを引き継がないようにする
      // それ以外は指定そのまま
      return {
        nextPresetKey: isDefaultPreset
          ? defaultPresetKeyForCurrentVoice
          : presetKeyCandidate,
        shouldApplyPreset: false,
      };
    }
  }
}

export const presetStoreState: PresetStoreState = {
  presetItems: {},
  presetKeys: [],
  defaultPresetKeys: {},
};

export const presetStore = createPartialStore<PresetStoreTypes>({
  DEFAULT_PRESET_KEY_SETS: {
    getter: (state) => {
      return new Set(Object.values(state.defaultPresetKeys));
    },
  },

  SET_PRESET_ITEMS: {
    mutation(
      state,
      { presetItems }: { presetItems: Record<PresetKey, Preset> },
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
      { defaultPresetKeys }: { defaultPresetKeys: Record<VoiceId, PresetKey> },
    ) {
      window.backend.setSetting("defaultPresetKeys", defaultPresetKeys);
      commit("SET_DEFAULT_PRESET_MAP", { defaultPresetKeys });
    },
    mutation(
      state,
      { defaultPresetKeys }: { defaultPresetKeys: Record<VoiceId, PresetKey> },
    ) {
      state.defaultPresetKeys = defaultPresetKeys;
    },
  },

  HYDRATE_PRESET_STORE: {
    async action({ commit }) {
      const defaultPresetKeys = (await window.backend.getSetting(
        "defaultPresetKeys",
        // z.BRAND型のRecordはPartialになる仕様なのでasで型を変換
        // TODO: 将来的にzodのバージョンを上げてasを消す https://github.com/colinhacks/zod/pull/2097
      )) as Record<VoiceId, PresetKey>;

      commit("SET_DEFAULT_PRESET_MAP", {
        defaultPresetKeys,
      });

      const presetConfig = await window.backend.getSetting("presets");
      if (
        presetConfig == undefined ||
        presetConfig.items == undefined ||
        presetConfig.keys == undefined
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
      }: { presetItems: Record<PresetKey, Preset>; presetKeys: PresetKey[] },
    ) {
      const result = await window.backend.setSetting("presets", {
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
      const newKey = PresetKey(crypto.randomUUID());
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
    async action({ state, dispatch, getters }) {
      const voices = getters.GET_ALL_VOICES("talk");

      for (const voice of voices) {
        const voiceId = VoiceId(voice);
        const defaultPresetKey = state.defaultPresetKeys[voiceId];

        if (state.presetKeys.includes(defaultPresetKey)) {
          continue;
        }

        const characterName = getters.VOICE_NAME(voice);

        const presetData: Preset = {
          name: `デフォルト：${characterName}`,
          speedScale: 1.0,
          pitchScale: 0.0,
          intonationScale: 1.0,
          volumeScale: 1.0,
          prePhonemeLength: 0.1,
          postPhonemeLength: 0.1,
        };
        const newPresetKey = await dispatch("ADD_PRESET", { presetData });

        await dispatch("SET_DEFAULT_PRESET_MAP", {
          defaultPresetKeys: {
            ...state.defaultPresetKeys,
            [voiceId]: newPresetKey,
          },
        });
      }
    },
  },

  UPDATE_PRESET: {
    async action(
      context,
      { presetKey, presetData }: { presetData: Preset; presetKey: PresetKey },
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
        (key) => key != presetKey,
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
