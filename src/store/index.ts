import { InjectionKey } from "vue";
import { createLogger } from "vuex";
import {
  createStore,
  Store,
  StoreOptions,
  useStore as baseUseStore,
} from "./vuex";

import {
  actionsMixer,
  AllActions,
  AllGetters,
  AllMutations,
  gettersMixer,
  IndexActions,
  IndexGetters,
  IndexMutations,
  State,
} from "./type";
import { commandStore } from "./command";
import { audioStore, audioCommandStore } from "./audio";
import { projectStore } from "./project";
import { uiStore } from "./ui";
import { settingStore } from "./setting";

export const GET_POLICY_TEXT = "GET_POLICY_TEXT";
export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const GET_UPDATE_INFOS = "GET_UPDATE_INFOS";
export const SHOW_WARNING_DIALOG = "SHOW_WARNING_DIALOG";
export const LOG_ERROR = "LOG_ERROR";

const isDevelopment = process.env.NODE_ENV == "development";

export const storeKey: InjectionKey<
  Store<State, AllGetters, AllActions, AllMutations>
> = Symbol();

export const indexStore: StoreOptions<
  State,
  IndexGetters,
  IndexActions,
  IndexMutations
> = {
  getters: {},
  mutations: {},
  actions: {
    [GET_POLICY_TEXT]: async () => {
      return await window.electron.getPolicyText();
    },
    [GET_OSS_LICENSES]: async () => {
      return await window.electron.getOssLicenses();
    },
    [GET_UPDATE_INFOS]: async () => {
      return await window.electron.getUpdateInfos();
    },
    [SHOW_WARNING_DIALOG]: async (
      _,
      { title, message }: { title: string; message: string }
    ) => {
      return await window.electron.showWarningDialog({ title, message });
    },
    [LOG_ERROR]: (_, ...params: unknown[]) => {
      window.electron.logError(...params);
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
    useGpu: false,
    isHelpDialogOpen: false,
    isSettingDialogOpen: false,
    isMaximized: false,
    savingSetting: {
      fileEncoding: "UTF-8",
      fixedExportEnabled: false,
      fixedExportDir: "",
      avoidOverwrite: false,
    },
    isPinned: false,
  },

  getters: gettersMixer({
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
    ...audioCommandStore.getters,
    ...indexStore.getters,
  }),

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...commandStore.mutations,
    ...projectStore.mutations,
    ...settingStore.mutations,
    ...audioCommandStore.mutations,
    ...indexStore.mutations,
  },

  actions: actionsMixer({
    ...uiStore.actions,
    ...audioStore.actions,
    ...commandStore.actions,
    ...projectStore.actions,
    ...settingStore.actions,
    ...audioCommandStore.actions,
    ...indexStore.actions,
  }),
  plugins: isDevelopment ? [createLogger()] : undefined,
  strict: process.env.NODE_ENV !== "production",
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
