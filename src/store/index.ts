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
import { audioStoreState, audioStore, audioCommandStore } from "./audio";
import { projectStoreState, projectStore } from "./project";
import { uiStoreState, uiStore } from "./ui";
import { settingStoreState, settingStore } from "./setting";
import { presetStoreState, presetStore } from "./preset";
import { proxyStore, proxyStoreState } from "./proxy";
import { DefaultStyleId } from "@/type/preload";

const isDevelopment = process.env.NODE_ENV == "development";

export const storeKey: InjectionKey<
  Store<State, AllGetters, AllActions, AllMutations>
> = Symbol();

export const indexStoreState: IndexStoreState = {
  defaultStyleIds: [],
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
    async SHOW_WARNING_DIALOG(
      _,
      { title, message }: { title: string; message: string }
    ) {
      return await window.electron.showWarningDialog({ title, message });
    },
    LOG_ERROR(_, ...params: unknown[]) {
      window.electron.logError(...params);
    },
    LOG_INFO(_, ...params: unknown[]) {
      window.electron.logInfo(...params);
    },
    async IS_UNSET_DEFAULT_STYLE_ID(_, { speakerUuid }) {
      return await window.electron.isUnsetDefaultStyleId(speakerUuid);
    },
    async LOAD_DEFAULT_STYLE_IDS({ commit, state }) {
      const storeDefaultStyleIds = await window.electron.getDefaultStyleIds();
      if (storeDefaultStyleIds.length === 0) {
        const characterInfos = await state.characterInfos;
        if (characterInfos == undefined)
          throw new Error("state.characterInfos == undefined");
        const defaultStyleIds = characterInfos.map<DefaultStyleId>((info) => ({
          speakerUuid: info.metas.speakerUuid,
          defaultStyleId: info.metas.styles[0].styleId,
        }));
        commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
      } else {
        commit("SET_DEFAULT_STYLE_IDS", {
          defaultStyleIds: storeDefaultStyleIds,
        });
      }
    },
    async SET_DEFAULT_STYLE_IDS({ commit }, defaultStyleIds) {
      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
      await window.electron.setDefaultStyleIds(defaultStyleIds);
    },
    async INIT_VUEX({ dispatch }) {
      const promises = [];

      promises.push(dispatch("GET_ENGINES"));
      promises.push(dispatch("GET_USE_GPU"));
      promises.push(dispatch("GET_PRESET_CONFIG"));
      promises.push(dispatch("GET_INHERIT_AUDIOINFO"));
      promises.push(dispatch("GET_SAVING_SETTING"));
      promises.push(dispatch("GET_HOTKEY_SETTINGS"));
      promises.push(dispatch("GET_TOOLBAR_SETTING"));
      promises.push(dispatch("GET_THEME_SETTING"));
      promises.push(dispatch("GET_ACCEPT_RETRIEVE_TELEMETRY"));
      promises.push(dispatch("GET_EXPERIMENTAL_SETTING"));

      await Promise.all(promises).then(async () => {
        await dispatch("ON_VUEX_READY");
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
    ...audioCommandStore,
    ...indexStoreState,
    ...presetStoreState,
    ...proxyStoreState,
  },

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
    ...presetStore.getters,
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
