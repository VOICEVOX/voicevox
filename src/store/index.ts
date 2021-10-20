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
  State,
  VoiceVoxStoreOptions,
} from "./type";
import { commandStore } from "./command";
import { audioStore, audioCommandStore } from "./audio";
import { projectStore } from "./project";
import { uiStore } from "./ui";
import { settingStore } from "./setting";

const isDevelopment = process.env.NODE_ENV == "development";

export const storeKey: InjectionKey<
  Store<State, AllGetters, AllActions, AllMutations>
> = Symbol();

export const indexStore: VoiceVoxStoreOptions<
  IndexGetters,
  IndexActions,
  IndexMutations
> = {
  getters: {},
  mutations: {
    SET_DEFAULT_STYLE_IDS(state, { defaultStyleIds }) {
      state.defaultStyleIds = defaultStyleIds;
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
    async IS_UNSET_DEFAULT_STYLE_IDS() {
      return await window.electron.isUnsetDefaultStyleIds();
    },
    async LOAD_DEFAULT_STYLE_IDS({ commit }) {
      const defaultStyleIds = await window.electron.getDefaultStyleIds();
      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
    },
    async SET_DEFAULT_STYLE_IDS({ commit }, defaultStyleIds) {
      commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
      await window.electron.setDefaultStyleIds(defaultStyleIds);
    },
  },
};

export const store = createStore<State, AllGetters, AllActions, AllMutations>({
  state: {
    engineState: "STARTING",
    defaultStyleIds: [],
    audioItems: {},
    audioKeys: [],
    audioStates: {},
    uiLockCount: 0,
    audioDetailPaneOffset: undefined,
    audioInfoPaneOffset: undefined,
    nowPlayingContinuously: false,
    undoCommands: [],
    redoCommands: [],
    useUndoRedo: isDevelopment,
    useGpu: false,
    isHelpDialogOpen: false,
    isSettingDialogOpen: false,
    isDefaultStyleSelectDialogOpen: false,
    isMaximized: false,
    savedLastCommandUnixMillisec: null,
    savingSetting: {
      fileEncoding: "UTF-8",
      fixedExportEnabled: false,
      fixedExportDir: "",
      avoidOverwrite: false,
      exportLab: false,
      exportText: true,
    },
    isPinned: false,
    hotkeySettings: [],
  },

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
    ...audioCommandStore.getters,
    ...indexStore.getters,
  },

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...commandStore.mutations,
    ...projectStore.mutations,
    ...settingStore.mutations,
    ...audioCommandStore.mutations,
    ...indexStore.mutations,
  },

  actions: {
    ...uiStore.actions,
    ...audioStore.actions,
    ...commandStore.actions,
    ...projectStore.actions,
    ...settingStore.actions,
    ...audioCommandStore.actions,
    ...indexStore.actions,
  },
  plugins: isDevelopment ? [createLogger()] : undefined,
  strict: process.env.NODE_ENV !== "production",
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
