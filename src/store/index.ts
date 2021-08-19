import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";

import { State } from "./type";
import { commandStore } from "./command";
import { audioStore } from "./audio";
import { projectActions } from "./project";
import { uiStore } from "./ui";

export const GET_POLICY_TEXT = "GET_POLICY_TEXT";
export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const GET_UPDATE_INFOS = "GET_UPDATE_INFOS";
export const SHOW_WARNING_DIALOG = "SHOW_WARNING_DIALOG";

export const storeKey: InjectionKey<Store<State>> = Symbol();

export const store = createStore<State>({
  state: {
    isEngineReady: false,
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
<<<<<<< HEAD
    windowBoundsBeforeMaximize: { x: 0, y: 0, width: 800, height: 600 },
=======
    fileEncoding: "UTF-8",
>>>>>>> 63d4bca6f9ba2f043d6ea287ff9678b5312f0d80
  },

  getters: {
    ...uiStore.getters,
    ...audioStore.getters,
    ...commandStore.getters,
  },

  mutations: {
    ...uiStore.mutations,
    ...audioStore.mutations,
    ...commandStore.mutations,
  },

  actions: {
    ...uiStore.actions,
    ...audioStore.actions,
    ...commandStore.actions,
    ...projectActions,
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
  },
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
