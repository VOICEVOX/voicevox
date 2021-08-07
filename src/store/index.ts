import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";

import { State } from "./type";
import { commandStore } from "./command";
import { audioStore } from "./audio";
import { uiStore } from "./ui";

export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const GET_UPDATE_INFOS = "GET_UPDATE_INFOS";

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

    [GET_OSS_LICENSES]: async () => {
      return await window.electron.getOssLicenses();
    },
    [GET_UPDATE_INFOS]: async () => {
      return await window.electron.getUpdateInfos();
    },
  },
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
