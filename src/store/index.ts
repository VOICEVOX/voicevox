import { InjectionKey } from "vue";
import { createLogger } from "vuex";
import { createStore, Store, useStore as baseUseStore } from "./vuex";

import {
  AllActions,
  AllGetters,
  AllMutations,
  IndexActions,
  IndexGetters,
  IndexMutations,
  IndexStoreState,
  State,
  VoiceVoxStoreOptions,
} from "./type";
import { commandStoreState, commandStore } from "./command";
import {
  audioStoreState,
  audioStore,
  audioCommandStore,
  audioCommandStoreState,
} from "./audio";
import { projectStoreState, projectStore } from "./project";
import { uiStoreState, uiStore } from "./ui";
import { settingStoreState, settingStore } from "./setting";
import { presetStoreState, presetStore } from "./preset";
import { dictionaryStoreState, dictionaryStore } from "./dictionary";
import { proxyStore, proxyStoreState } from "./proxy";
import { DefaultStyleId } from "@/type/preload";

const isDevelopment = process.env.NODE_ENV == "development";

export const storeKey: InjectionKey<
  Store<State, AllGetters, AllActions, AllMutations>
> = Symbol();

export const indexStoreState: IndexStoreState = {
  defaultStyleIds: [],
  userCharacterOrder: [],
};

export const indexStore: VoiceVoxStoreOptions<
  IndexGetters,
  IndexActions,
  IndexMutations
> = {
  getters: {},
  mutations: {
    SET_DEFAULT_STYLE_IDS(state, { defaultStyleIds }) {
      state.defaultStyleIds = defaultStyleIds;

      // 初期状態（空のAudioCellが１つだけ）だった場合は、スタイルを変更する
      // FIXME: デフォルトスタイル選択前にAudioCellを生成しないようにする
      if (state.audioKeys.length === 1) {
        const audioItem = state.audioItems[state.audioKeys[0]];
        if (audioItem.text === "") {
          const characterInfo = state.characterInfos?.find(
            (info) =>
              info.metas.styles.find(
                (style) => style.styleId == audioItem.styleId
              ) != undefined
          );
          if (characterInfo == undefined)
            throw new Error("characterInfo == undefined");

          const speakerUuid = characterInfo.metas.speakerUuid;
          const defaultStyleId = defaultStyleIds.find(
            (styleId) => speakerUuid == styleId.speakerUuid
          )?.defaultStyleId;

          audioItem.styleId = defaultStyleId;
        }
      }
    },
    SET_USER_CHARACTER_ORDER(state, { userCharacterOrder }) {
      state.userCharacterOrder = userCharacterOrder;
    },
  },
  actions: {
    async GET_HOW_TO_USE_TEXT() {
      return await window.electron.getHowToUseText();
    },
    async GET_POLICY_TEXT() {
      return await window.electron.getPolicyText();
    },
    async GET_OSS_LICENSES() {
      return await window.electron.getOssLicenses();
    },
    async GET_UPDATE_INFOS() {
      return await window.electron.getUpdateInfos();
    },
    async GET_OSS_COMMUNITY_INFOS() {
      return await window.electron.getOssCommunityInfos();
    },
    async GET_PRIVACY_POLICY_TEXT() {
      return await window.electron.getPrivacyPolicyText();
    },
    async GET_CONTACT_TEXT() {
      return await window.electron.getContactText();
    },
    async GET_Q_AND_A_TEXT() {
      return await window.electron.getQAndAText();
    },
    LOG_ERROR(_, ...params: unknown[]) {
      window.electron.logError(...params);
    },
    LOG_INFO(_, ...params: unknown[]) {
      window.electron.logInfo(...params);
    },
    async LOAD_USER_CHARACTER_ORDER({ commit }) {
      const userCharacterOrder = await window.electron.getSetting(
        "userCharacterOrder"
      );
      commit("SET_USER_CHARACTER_ORDER", { userCharacterOrder });
    },
    async SET_USER_CHARACTER_ORDER({ commit }, userCharacterOrder) {
      commit("SET_USER_CHARACTER_ORDER", { userCharacterOrder });
      await window.electron.setSetting(
        "userCharacterOrder",
        userCharacterOrder
      );
    },
    GET_NEW_CHARACTERS({ state }) {
      if (!state.characterInfos) throw new Error("characterInfos is undefined");

      // キャラクター表示順序に含まれていなければ新規キャラとみなす
      const allSpeakerUuid = state.characterInfos.map(
        (characterInfo) => characterInfo.metas.speakerUuid
      );
      const newSpeakerUuid = allSpeakerUuid.filter(
        (speakerUuid) => !state.userCharacterOrder.includes(speakerUuid)
      );
      return newSpeakerUuid;
    },
    async IS_UNSET_DEFAULT_STYLE_ID(_, { speakerUuid }) {
      return await window.electron.isUnsetDefaultStyleId(speakerUuid);
    },
    async LOAD_DEFAULT_STYLE_IDS({ commit, state }) {
      let defaultStyleIds = await window.electron.getSetting("defaultStyleIds");

      if (!state.characterInfos) throw new Error("characterInfos is undefined");

      // デフォルトスタイルが設定されていない場合は0をセットする
      // FIXME: 保存しているものとstateのものが異なってしまうので良くない。デフォルトスタイルが未設定の場合はAudioCellsを表示しないようにすべき
      const unsetCharacterInfos = state.characterInfos.filter(
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
    async SET_DEFAULT_STYLE_IDS({ commit }, defaultStyleIds) {
      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
      await window.electron.setSetting("defaultStyleIds", defaultStyleIds);
    },
    async INIT_VUEX({ dispatch }) {
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
};

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
  plugins: isDevelopment ? [createLogger()] : undefined,
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
