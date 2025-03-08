import { InjectionKey } from "vue";
import {
  createStore,
  Store as BaseStore,
  useStore as baseUseStore,
} from "./vuex";

import {
  AllActions,
  AllGetters,
  AllMutations,
  IndexStoreState,
  IndexStoreTypes,
  State,
} from "./type";
import { commandStoreState, commandStore } from "./command";
import {
  audioStoreState,
  audioStore,
  audioCommandStore,
  audioCommandStoreState,
  getCharacterInfo,
} from "./audio";
import { audioPlayerStoreState, audioPlayerStore } from "./audioPlayer";
import {
  singingStoreState,
  singingStore,
  singingCommandStoreState,
  singingCommandStore,
} from "./singing";
import { projectStoreState, projectStore } from "./project";
import { uiStoreState, uiStore } from "./ui";
import { settingStoreState, settingStore } from "./setting";
import { presetStoreState, presetStore } from "./preset";
import { dictionaryStoreState, dictionaryStore } from "./dictionary";
import { proxyStore, proxyStoreState } from "./proxy";
import { createPartialStore } from "./vuex";
import { engineStoreState, engineStore } from "./engine";
import { filterCharacterInfosByStyleType } from "./utility";
import {
  DefaultStyleId,
  EngineId,
  SpeakerId,
  StyleId,
  Voice,
} from "@/type/preload";
import { isProduction } from "@/helpers/platform";

export type Store = BaseStore<State, AllGetters, AllActions, AllMutations>;
export const storeKey: InjectionKey<Store> = Symbol();

export const indexStoreState: IndexStoreState = {
  defaultStyleIds: [],
  userCharacterOrder: [],
  isMultiEngineOffMode: false,
};

export const indexStore = createPartialStore<IndexStoreTypes>({
  GET_ALL_CHARACTER_INFOS: {
    /**
     * すべてのエンジンのキャラクター情報のMap。
     * 同じspeakerUuidのキャラクター情報は、登録順が早いエンジンの情報を元に統合される。
     * キャラクター情報が読み出されていないときは、空リストを返す。
     */
    getter(state) {
      const speakerUuids = [
        ...new Set(
          state.engineIds.flatMap((engineId) =>
            (state.characterInfos[engineId] ?? []).map(
              (c) => c.metas.speakerUuid,
            ),
          ),
        ),
      ];
      const flattenCharacterInfos = speakerUuids.map((speakerUuid) => {
        const characterInfos = state.engineIds.flatMap(
          (engineId) =>
            state.characterInfos[engineId]?.find(
              (c) => c.metas.speakerUuid === speakerUuid,
            ) ?? [],
        );

        // エンジンの登録順が早い方が優先される。
        return {
          ...characterInfos[0],
          metas: {
            ...characterInfos[0].metas,
            styles: characterInfos.flatMap((c) => c.metas.styles),
          },
        };
      });
      return new Map(
        flattenCharacterInfos.map((c) => [c.metas.speakerUuid, c]),
      );
    },
  },
  /**
   * すべてのエンジンのキャラクター情報のリスト。
   * GET_ALL_CHARACTER_INFOSとは違い、話者の順番が保持される。
   */
  GET_ORDERED_ALL_CHARACTER_INFOS: {
    getter(state) {
      const speakerUuids = state.engineIds
        .flatMap((engineId) =>
          (state.characterInfos[engineId] ?? []).map(
            (c) => c.metas.speakerUuid,
          ),
        )
        .filter((uuid, index, uuids) => uuids.indexOf(uuid) === index); // Setを使うと順番が保証されないのでindexOfで重複削除をする。
      const flattenCharacterInfos = speakerUuids.map((speakerUuid) => {
        const characterInfos = state.engineIds.flatMap(
          (engineId) =>
            state.characterInfos[engineId]?.find(
              (c) => c.metas.speakerUuid === speakerUuid,
            ) ?? [],
        );

        // エンジンの登録順が早い方が優先される。
        return {
          ...characterInfos[0],
          metas: {
            ...characterInfos[0].metas,
            styles: characterInfos.flatMap((c) => c.metas.styles),
          },
        };
      });
      return flattenCharacterInfos;
    },
  },

  GET_ALL_VOICES: {
    getter: (state) => (styleType: "all" | "singerLike" | "talk") => {
      let flattenCharacters = Object.values(state.characterInfos).flatMap(
        (characterInfos) => characterInfos,
      );
      if (styleType !== "all") {
        flattenCharacters = filterCharacterInfosByStyleType(
          flattenCharacters,
          styleType,
        );
      }
      const flattenVoices: Voice[] = flattenCharacters.flatMap((c) =>
        c.metas.styles.map((s) => ({
          engineId: EngineId(s.engineId),
          speakerId: SpeakerId(c.metas.speakerUuid),
          styleId: StyleId(s.styleId),
        })),
      );

      return flattenVoices;
    },
  },

  GET_HOW_TO_USE_TEXT: {
    async action() {
      return await window.backend.getTextAsset("HowToUse");
    },
  },

  GET_CONTACT_TEXT: {
    async action() {
      return await window.backend.getTextAsset("Contact");
    },
  },

  GET_Q_AND_A_TEXT: {
    async action() {
      return await window.backend.getTextAsset("QAndA");
    },
  },

  GET_POLICY_TEXT: {
    async action() {
      return await window.backend.getTextAsset("PrivacyPolicy");
    },
  },

  GET_OSS_LICENSES: {
    async action() {
      return await window.backend.getTextAsset("OssLicenses");
    },
  },

  GET_UPDATE_INFOS: {
    async action() {
      return await window.backend.getTextAsset("UpdateInfos");
    },
  },

  GET_OSS_COMMUNITY_INFOS: {
    async action() {
      return await window.backend.getTextAsset("OssCommunityInfos");
    },
  },

  GET_PRIVACY_POLICY_TEXT: {
    async action() {
      return await window.backend.getTextAsset("PrivacyPolicy");
    },
  },

  LOAD_DEFAULT_STYLE_IDS: {
    async action({ mutations, getters }) {
      let defaultStyleIds = await window.backend.getSetting("defaultStyleIds");

      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;

      // デフォルトスタイルが設定されていない、または
      // デフォルトスタイルのスタイルが存在しない場合は0をセットする
      // FIXME: 勝手に0番のデフォルトスタイルが保存されてしまうため、存在しないデフォルトスタイルでもUIが表示されるようにする
      const unsetCharacterInfos = [...allCharacterInfos.keys()].filter(
        (speakerUuid) => {
          const defaultStyleId = defaultStyleIds.find(
            (styleId) => styleId.speakerUuid == speakerUuid,
          );
          if (defaultStyleId == undefined) {
            return true;
          }

          const characterInfo = allCharacterInfos.get(speakerUuid);

          if (!characterInfo) {
            return false;
          }
          return !characterInfo.metas.styles.some(
            (style) => style.styleId == defaultStyleId.defaultStyleId,
          );
        },
      );
      defaultStyleIds = [
        ...defaultStyleIds,
        ...unsetCharacterInfos.map<DefaultStyleId>((speakerUuid) => {
          const characterInfo = allCharacterInfos.get(speakerUuid);
          if (!characterInfo) {
            throw new Error(
              `characterInfo not found. speakerUuid=${speakerUuid}`,
            );
          }
          return {
            engineId: characterInfo.metas.styles[0].engineId,
            speakerUuid: speakerUuid,
            defaultStyleId: characterInfo.metas.styles[0].styleId,
          };
        }),
      ];

      mutations.SET_DEFAULT_STYLE_IDS({ defaultStyleIds });
    },
  },

  SET_DEFAULT_STYLE_IDS: {
    mutation(state, { defaultStyleIds }) {
      state.defaultStyleIds = defaultStyleIds;

      // 初期状態（空のAudioCellが１つだけ）だった場合は、スタイルを変更する
      // FIXME: デフォルトスタイル選択前にAudioCellを生成しないようにする
      if (state.audioKeys.length === 1) {
        const audioItem = state.audioItems[state.audioKeys[0]];
        if (audioItem.text === "") {
          const characterInfo = getCharacterInfo(
            state,
            audioItem.voice.engineId,
            audioItem.voice.styleId,
          );

          if (characterInfo == undefined)
            throw new Error("assert characterInfo !== undefined");

          const speakerUuid = characterInfo.metas.speakerUuid;
          const defaultStyleId = defaultStyleIds.find(
            (styleId) => speakerUuid == styleId.speakerUuid,
          );
          if (defaultStyleId == undefined)
            throw new Error("defaultStyleId == undefined");

          audioItem.voice = {
            engineId: defaultStyleId.engineId,
            speakerId: defaultStyleId.speakerUuid,
            styleId: defaultStyleId.defaultStyleId,
          };
        }
      }
    },
    async action({ mutations }, defaultStyleIds) {
      mutations.SET_DEFAULT_STYLE_IDS({ defaultStyleIds });
      await window.backend.setSetting("defaultStyleIds", defaultStyleIds);
    },
  },

  LOAD_USER_CHARACTER_ORDER: {
    async action({ mutations }) {
      const userCharacterOrder =
        await window.backend.getSetting("userCharacterOrder");
      mutations.SET_USER_CHARACTER_ORDER({ userCharacterOrder });
    },
  },

  SET_USER_CHARACTER_ORDER: {
    mutation(state, { userCharacterOrder }) {
      state.userCharacterOrder = userCharacterOrder;
    },
    async action({ mutations }, userCharacterOrder) {
      mutations.SET_USER_CHARACTER_ORDER({ userCharacterOrder });
      await window.backend.setSetting("userCharacterOrder", userCharacterOrder);
    },
  },

  GET_NEW_CHARACTERS: {
    action({ state, getters }) {
      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;

      // キャラクター表示順序に含まれていなければ新規キャラとみなす
      const allSpeakerUuid = [...allCharacterInfos.keys()];
      const newSpeakerUuid = allSpeakerUuid.filter(
        (speakerUuid) => !state.userCharacterOrder.includes(speakerUuid),
      );
      return newSpeakerUuid;
    },
  },

  INIT_VUEX: {
    async action({ actions }) {
      const promises = [];

      // 設定ファイルからstoreへ読み込む
      promises.push(actions.HYDRATE_UI_STORE());
      promises.push(actions.HYDRATE_PRESET_STORE());
      promises.push(actions.HYDRATE_SETTING_STORE());

      await Promise.all(promises).then(() => {
        void actions.ON_VUEX_READY();
      });
    },
  },

  SET_IS_MULTI_ENGINE_OFF_MODE: {
    mutation(state, { isMultiEngineOffMode }) {
      state.isMultiEngineOffMode = isMultiEngineOffMode;
    },
    action({ mutations }, isMultiEngineOffMode) {
      mutations.SET_IS_MULTI_ENGINE_OFF_MODE({ isMultiEngineOffMode });
    },
  },
});

export const store = createStore<State, AllGetters, AllActions, AllMutations>({
  state: {
    ...uiStoreState,
    ...audioStoreState,
    ...audioPlayerStoreState,
    ...singingStoreState,
    ...commandStoreState,
    ...engineStoreState,
    ...projectStoreState,
    ...settingStoreState,
    ...audioCommandStoreState,
    ...indexStoreState,
    ...presetStoreState,
    ...dictionaryStoreState,
    ...proxyStoreState,
    ...singingStoreState,
    ...singingCommandStoreState,
  },

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...audioPlayerStore.getters,
    ...commandStore.getters,
    ...engineStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
    ...presetStore.getters,
    ...dictionaryStore.getters,
    ...audioCommandStore.getters,
    ...indexStore.getters,
    ...proxyStore.getters,
    ...singingStore.getters,
    ...singingCommandStore.getters,
  },

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...audioPlayerStore.mutations,
    ...commandStore.mutations,
    ...engineStore.mutations,
    ...projectStore.mutations,
    ...settingStore.mutations,
    ...audioCommandStore.mutations,
    ...presetStore.mutations,
    ...dictionaryStore.mutations,
    ...indexStore.mutations,
    ...proxyStore.mutations,
    ...singingStore.mutations,
    ...singingCommandStore.mutations,
  },

  actions: {
    ...uiStore.actions,
    ...audioStore.actions,
    ...audioPlayerStore.actions,
    ...engineStore.actions,
    ...commandStore.actions,
    ...projectStore.actions,
    ...settingStore.actions,
    ...audioCommandStore.actions,
    ...presetStore.actions,
    ...dictionaryStore.actions,
    ...indexStore.actions,
    ...proxyStore.actions,
    ...singingStore.actions,
    ...singingCommandStore.actions,
  },
  strict: !isProduction,
});

export const useStore = (): Store => {
  return baseUseStore(storeKey);
};
