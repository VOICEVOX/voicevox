import { InjectionKey } from "vue";
import {
  createLogger,
  createStore,
  Store,
  useStore as baseUseStore,
} from "vuex";

import { State } from "./type";
import { commandStore } from "./command";
import { audioStore, audioCommandStore } from "./audio";
import { projectStore } from "./project";
import { uiStore } from "./ui";
import { settingStore } from "./setting";
import { UpdateInfo } from "@/type/preload";

export const GET_POLICY_TEXT = "GET_POLICY_TEXT";
export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const GET_UPDATE_INFOS = "GET_UPDATE_INFOS";
export const SHOW_WARNING_DIALOG = "SHOW_WARNING_DIALOG";
export const LOG_ERROR = "LOG_ERROR";

const isDevelopment = process.env.NODE_ENV == "development";

export const storeKey: InjectionKey<Store<State>> = Symbol();

// eslint-disable-next-line @typescript-eslint/ban-types
export type IndexGetters = {};

// eslint-disable-next-line @typescript-eslint/ban-types
export type IndexMutations = {};

export type IndexActions = {
  GET_POLICY_TEXT(): string;
  GET_OSS_LICENSES(): Record<string, string>[];
  GET_UPDATE_INFOS(): UpdateInfo[];
  SHOW_WARNING_DIALOG(payload: {
    title: string;
    message: string;
  }): Electron.MessageBoxReturnValue;
  LOG_ERROR(payload: unknown[]): void;
};

export const store = createStore<State>({
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

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
    ...projectStore.getters,
    ...settingStore.getters,
  },

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...commandStore.mutations,
    ...projectStore.mutations,
    ...settingStore.mutations,
    ...audioCommandStore.mutations,
  },

  actions: {
    ...uiStore.actions,
    ...audioStore.actions,
    ...commandStore.actions,
    ...projectStore.actions,
    ...settingStore.actions,
    ...audioCommandStore.actions,
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
      context,
      { title, message }: { title: string; message: string }
    ) => {
      return await window.electron.showWarningDialog({ title, message });
    },
    [LOG_ERROR]: (_, ...params: unknown[]) => {
      window.electron.logError(...params);
    },
  },
  plugins: isDevelopment ? [createLogger()] : undefined,
  strict: process.env.NODE_ENV !== "production",
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
