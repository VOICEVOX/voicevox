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
  mutations: {},
  actions: {
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
  },
};

export const store = createStore<State, AllGetters, AllActions, AllMutations>({
  state: {
    engineState: "STARTING",
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
    isMaximized: false,
    savedLastCommandUnixMillisec: null,
    savingSetting: {
      fileEncoding: "UTF-8",
      fixedExportEnabled: false,
      fixedExportDir: "",
      avoidOverwrite: false,
      exportLab: false,
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
