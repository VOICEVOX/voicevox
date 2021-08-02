import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";

import { State, AudioItem } from "./type";
import { commandStore } from "./command";
import { audioStore, REMOVE_ALL_AUDIO_ITEM, REGISTER_AUDIO_ITEM } from "./audio";
import { uiStore, createUILockAction } from "./ui";
import { AssertionError } from "chai";

export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const LOAD_PROJECT_FILE = "LOAD_PROJECT_FILE";
export const SAVE_PROJECT_FILE = "SAVE_PROJECT_FILE";

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
    [LOAD_PROJECT_FILE]: createUILockAction(async (context) => {
      // Select and load a project File.
      const ret = await window.electron.showProjectLoadDialog({
        title: "プロジェクトファイルの選択",
      });
      if (ret == undefined || ret?.length == 0) {
        return;
      }
      const filePath = ret[0];
      try {
        const buf = await window.electron.readFile({ filePath });
        const text = new TextDecoder("utf8").decode(buf).trim();
        const projectData = JSON.parse(text);
        // todo: Checking if the data is valid and converting between another versions
        if (!("projectVersion" in projectData)) {
          throw AssertionError;
        }
        await context.dispatch(REMOVE_ALL_AUDIO_ITEM);
        const {
          audioKeys,
          audioItems,
        }: {
          audioItems: Record<string, AudioItem>;
          audioKeys: string[];
        } = projectData;
        let prevAudioKey = undefined;
        for (const audioKey of audioKeys) {
          const audioItem = audioItems[audioKey];
          prevAudioKey = await context.dispatch(REGISTER_AUDIO_ITEM, {
            prevAudioKey,
            audioItem,
          });
        }
      } catch (err) {
        console.error(err);
        console.error(
          `Voice Vox Project file "${filePath}" is a invalid file.`
        );
      }
      return;
    }),
    [SAVE_PROJECT_FILE]: createUILockAction(async (context) => {
      // Write the current status to a project file.
      const ret = await window.electron.showProjectSaveDialog({
        title: "プロジェクトファイルの選択",
      });
      if (ret == undefined) {
        return;
      }
      const filePath = ret;
      const { audioItems, audioKeys } = context.state;
      const projectData = {
        projectVersion: "0.1.0",
        audioKeys,
        audioItems,
      };
      const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
      window.electron.writeFile({ filePath, buffer: buf });
      return;
    }),
  },
});

export const useStore = () => {
  return baseUseStore(storeKey);
};
