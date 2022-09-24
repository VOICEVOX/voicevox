import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "./vuex";

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
import { projectStoreState, projectStore } from "./project";
import { uiStoreState, uiStore } from "./ui";
import { settingStoreState, settingStore } from "./setting";
import { presetStoreState, presetStore } from "./preset";
import { dictionaryStoreState, dictionaryStore } from "./dictionary";
import { proxyStore, proxyStoreState } from "./proxy";
<<<<<<< HEAD
import { createPartialStore } from "./vuex";
import { DefaultStyleId } from "@/type/preload";
=======
import { CharacterInfo, DefaultStyleId } from "@/type/preload";
>>>>>>> ca4e32c (Change: GET_FLATTEN_CHARACTER_INFOSをMapに変更)

export const storeKey: InjectionKey<
  Store<State, AllGetters, AllActions, AllMutations>
> = Symbol();

export const indexStoreState: IndexStoreState = {
  defaultStyleIds: [],
  userCharacterOrder: [],
};

export const indexStore = createPartialStore<IndexStoreTypes>({
  GET_FLATTEN_CHARACTER_INFOS: {
    /**
     * すべてのエンジンのキャラクター情報のMap。
     * 同じspeakerUuidのキャラクター情報は、登録順が早いエンジンの情報を元に統合される。
     * キャラクター情報が読み出されていないときは、空リストを返す。
     */
<<<<<<< HEAD
    getter(state) {
=======
    GET_ALL_CHARACTER_INFOS(state) {
>>>>>>> ca4e32c (Change: GET_FLATTEN_CHARACTER_INFOSをMapに変更)
      const speakerUuids = [
        ...new Set(
          state.engineIds.flatMap((engineId) =>
            (state.characterInfos[engineId] ?? []).map(
              (c) => c.metas.speakerUuid
            )
          )
        ),
      ];
      const flattenCharacterInfos = speakerUuids.map((speakerUuid) => {
        const characterInfos = state.engineIds.flatMap(
          (engineId) =>
            state.characterInfos[engineId]?.find(
              (c) => c.metas.speakerUuid === speakerUuid
            ) ?? []
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
        flattenCharacterInfos.map((c) => [c.metas.speakerUuid, c])
      );
    },
    /**
     * すべてのエンジンのキャラクター情報のリスト。
     * GET_ALL_CHARACTER_INFOSとは違い、話者の順番が保持される。
     */
    GET_ORDERED_ALL_CHARACTER_INFOS(state) {
      const speakerUuids = state.engineIds
        .flatMap((engineId) =>
          (state.characterInfos[engineId] ?? []).map((c) => c.metas.speakerUuid)
        )
        .filter((uuid, index, uuids) => uuids.indexOf(uuid) === index); // Setを使うと順番が保証されないのでindexOfで重複削除をする。
      const flattenCharacterInfos = speakerUuids.map((speakerUuid) => {
        const characterInfos = state.engineIds.flatMap(
          (engineId) =>
            state.characterInfos[engineId]?.find(
              (c) => c.metas.speakerUuid === speakerUuid
            ) ?? []
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

  GET_HOW_TO_USE_TEXT: {
    async action() {
      return await window.electron.getHowToUseText();
    },
  },

  GET_CONTACT_TEXT: {
    async action() {
      return await window.electron.getContactText();
    },
  },

  GET_Q_AND_A_TEXT: {
    async action() {
      return await window.electron.getQAndAText();
    },
  },

  GET_POLICY_TEXT: {
    async action() {
      return await window.electron.getPolicyText();
    },
  },

  GET_OSS_LICENSES: {
    async action() {
      return await window.electron.getOssLicenses();
    },
  },

  GET_UPDATE_INFOS: {
    async action() {
      return await window.electron.getUpdateInfos();
    },
  },

  GET_OSS_COMMUNITY_INFOS: {
    async action() {
      return await window.electron.getOssCommunityInfos();
    },
  },

  GET_PRIVACY_POLICY_TEXT: {
    async action() {
      return await window.electron.getPrivacyPolicyText();
    },
  },

  IS_UNSET_DEFAULT_STYLE_ID: {
    async action(_, { speakerUuid }) {
      return await window.electron.isUnsetDefaultStyleId(speakerUuid);
    },
  },

  LOAD_DEFAULT_STYLE_IDS: {
    async action({ commit, getters }) {
      let defaultStyleIds = await window.electron.getSetting("defaultStyleIds");

      const flattenCharacterInfos = getters.GET_FLATTEN_CHARACTER_INFOS;

      // デフォルトスタイルが設定されていない場合は0をセットする
      // FIXME: 保存しているものとstateのものが異なってしまうので良くない。デフォルトスタイルが未設定の場合はAudioCellsを表示しないようにすべき
      const unsetCharacterInfos = flattenCharacterInfos.filter(
        (characterInfo) =>
          !defaultStyleIds.some(
            (styleId) => styleId.speakerUuid == characterInfo.metas.speakerUuid
          )
      );
      defaultStyleIds = [
        ...defaultStyleIds,
        ...unsetCharacterInfos.map<DefaultStyleId>((info) => ({
          speakerUuid: info.metas.speakerUuid,
          defaultStyleId: info.metas.styles[0].styleId,
        })),
      ];

      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
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
          if (audioItem.engineId === undefined)
            throw new Error("assert audioItem.engineId !== undefined");

          if (audioItem.styleId === undefined)
            throw new Error("assert audioItem.styleId !== undefined");

          const characterInfo = getCharacterInfo(
            state,
            audioItem.engineId,
            audioItem.styleId
          );

          if (characterInfo === undefined)
            throw new Error("assert characterInfo !== undefined");

          const speakerUuid = characterInfo.metas.speakerUuid;
          const defaultStyleId = defaultStyleIds.find(
            (styleId) => speakerUuid == styleId.speakerUuid
          )?.defaultStyleId;

          audioItem.styleId = defaultStyleId;
        }
      }
    },
    async action({ commit }, defaultStyleIds) {
      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
      await window.electron.setSetting("defaultStyleIds", defaultStyleIds);
    },
  },

  LOAD_USER_CHARACTER_ORDER: {
    async action({ commit }) {
      const userCharacterOrder = await window.electron.getSetting(
        "userCharacterOrder"
      );
      commit("SET_USER_CHARACTER_ORDER", { userCharacterOrder });
    },
  },

  SET_USER_CHARACTER_ORDER: {
    mutation(state, { userCharacterOrder }) {
      state.userCharacterOrder = userCharacterOrder;
    },
    async action({ commit }, userCharacterOrder) {
      commit("SET_USER_CHARACTER_ORDER", { userCharacterOrder });
      await window.electron.setSetting(
        "userCharacterOrder",
        userCharacterOrder
      );
    },
<<<<<<< HEAD
  },

  GET_NEW_CHARACTERS: {
    action({ state, getters }) {
      const flattenCharacterInfos = getters.GET_FLATTEN_CHARACTER_INFOS;
=======
    GET_NEW_CHARACTERS({ state, getters }) {
      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;
>>>>>>> ca4e32c (Change: GET_FLATTEN_CHARACTER_INFOSをMapに変更)

      // キャラクター表示順序に含まれていなければ新規キャラとみなす
      const allSpeakerUuid = [...allCharacterInfos.keys()];
      const newSpeakerUuid = allSpeakerUuid.filter(
        (speakerUuid) => !state.userCharacterOrder.includes(speakerUuid)
      );
      return newSpeakerUuid;
    },
  },

<<<<<<< HEAD
  LOG_ERROR: {
    action(_, ...params: unknown[]) {
      window.electron.logError(...params);
=======
      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;

      // デフォルトスタイルが設定されていない場合は0をセットする
      // FIXME: 保存しているものとstateのものが異なってしまうので良くない。デフォルトスタイルが未設定の場合はAudioCellsを表示しないようにすべき
      const unsetCharacterInfos = [...allCharacterInfos.keys()].filter(
        (speakerUuid) =>
          !defaultStyleIds.some((styleId) => styleId.speakerUuid == speakerUuid)
      );
      defaultStyleIds = [
        ...defaultStyleIds,
        ...unsetCharacterInfos.map<DefaultStyleId>((speakerUuid) => ({
          speakerUuid: speakerUuid,
          defaultStyleId: (allCharacterInfos.get(speakerUuid) as CharacterInfo)
            .metas.styles[0].styleId,
        })),
      ];

      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
>>>>>>> ca4e32c (Change: GET_FLATTEN_CHARACTER_INFOSをMapに変更)
    },
  },

  LOG_INFO: {
    action(_, ...params: unknown[]) {
      window.electron.logInfo(...params);
    },
  },

  INIT_VUEX: {
    async action({ dispatch }) {
      const promises = [];

      // 設定ファイルからstoreへ読み込む
      promises.push(dispatch("HYDRATE_UI_STORE"));
      promises.push(dispatch("HYDRATE_PRESET_STORE"));
      promises.push(dispatch("HYDRATE_SETTING_STORE"));

      await Promise.all(promises).then(() => {
        dispatch("ON_VUEX_READY");
      });
    },
  },
});

export const store = createStore<State, AllGetters, AllActions, AllMutations>({
  state: {
    ...uiStoreState,
    ...audioStoreState,
    ...commandStoreState,
    ...projectStoreState,
    ...settingStoreState,
    ...audioCommandStoreState,
    ...indexStoreState,
    ...presetStoreState,
    ...dictionaryStoreState,
    ...proxyStoreState,
  },

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
    ...presetStore.getters,
    ...dictionaryStore.getters,
    ...audioCommandStore.getters,
    ...indexStore.getters,
    ...proxyStore.getters,
  },

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...commandStore.mutations,
    ...projectStore.mutations,
    ...settingStore.mutations,
    ...audioCommandStore.mutations,
    ...presetStore.mutations,
    ...dictionaryStore.mutations,
    ...indexStore.mutations,
    ...proxyStore.mutations,
  },

  actions: {
    ...uiStore.actions,
    ...audioStore.actions,
    ...commandStore.actions,
    ...projectStore.actions,
    ...settingStore.actions,
    ...audioCommandStore.actions,
    ...presetStore.actions,
    ...dictionaryStore.actions,
    ...indexStore.actions,
    ...proxyStore.actions,
  },
  strict: process.env.NODE_ENV !== "production",
});

export const useStore = (): Store<
  State,
  AllGetters,
  AllActions,
  AllMutations
> => {
  return baseUseStore(storeKey);
};
