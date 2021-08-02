import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";

import { State, AudioItem } from "./type";
import { commandStore } from "./command";
import {
  audioStore,
  REMOVE_ALL_AUDIO_ITEM,
  REGISTER_AUDIO_ITEM,
} from "./audio";
import { uiStore, createUILockAction } from "./ui";

import { assert, AssertionError } from "chai";

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
      // todo: Add confirm window to break current state.
      try {
        const buf = await window.electron.readFile({ filePath });
        const text = new TextDecoder("utf-8").decode(buf).trim();
        projectValidationCheck(text);
        await context.dispatch(REMOVE_ALL_AUDIO_ITEM);

        const {
          audioItems,
          audioKeys,
        }: {
          audioItems: Record<string, AudioItem>;
          audioKeys: string[];
        } = JSON.parse(text);

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
        projectVersion: PROJECT_VERSION.map(String).join("."),
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


const PROJECT_VERSION = [0, 1, 0];

// projectValidationCheck(text: string) -> void;
// Check for validation using the given text as project data.
const projectValidationCheck = (text: string) => {
  const projectData = JSON.parse(text);
  const projectVersionText = projectData.projectVersion ?? "0.0.0";
  const projectVersion = projectVersionText.split(".");
  assert(projectVersion <= PROJECT_VERSION);
  const projectAttributes = [
    "projectVersion",
    "audioKeys",
    "audioItems",
  ] as const;

  for (const attribute of projectAttributes) {
    assert(
      attribute in projectData,
      `Project should have attribute "${attribute}".`
    );
  }

  const { audioItems, audioKeys } = projectData;
  assert(
    Array.isArray(audioKeys) &&
      audioKeys.every((item) => typeof item === "string"),
    'The attribute "audioKeys" should be string[]'
  );

  const attributeValidationCheck =
    (attrName: string, type: string, optional = false) =>
    (obj: any) => {
      assert(
        typeof obj === type ||
          optional && obj == null,
        `The attribute ${attrName} should be ${type}${
          optional ? "|undefined" : ""
        }.`
      );
    };

  const arrayWrapper =
    (attrName: string, checker: (obj: any) => void) => (obj: any) => {
      if (Array.isArray(obj)) {
        obj.map((child)=>checker(child));
      } else {
        throw new AssertionError(`${attrName} should be Array.`);
      }
    };

  const moraValidationCheck = (mora: any) => {
    const moraAttributes = {
      text: attributeValidationCheck("text", "string"),
      consonant: attributeValidationCheck("consonant", "string", true),
      vowel: attributeValidationCheck("vowel", "string"),
      pitch: attributeValidationCheck("pitch", "number"),
    };
    for (const [attr, checker] of Object.entries(moraAttributes)) {
      checker(mora[attr]);
    }
  };
  const accentPhraseValidationCheck = (accentPhrase: any) => {
    const accentPhraseAttributes = {
      moras: arrayWrapper("moras", moraValidationCheck),
      accent: attributeValidationCheck("accent", "number"),
      pauseMora: (pauseMora: any) =>
        pauseMora == null || moraValidationCheck(pauseMora),
    };
    for (const [attr, checker] of Object.entries(accentPhraseAttributes)) {
      checker(accentPhrase[attr]);
    }
  };
  const audioQueryValidationCheck = (query: any) => {
    const audioQueryAttributes = {
      accentPhrases: arrayWrapper("accentPhrases", accentPhraseValidationCheck),
      speedScale: attributeValidationCheck("speedScale", "number"),
      pitchScale: attributeValidationCheck("pitchScale", "number"),
      intonationScale: attributeValidationCheck("intonationScale", "number"),
    };
    for (const [attr, checker] of Object.entries(audioQueryAttributes)) {
      checker(query[attr]);
    }
  };
  const audioItemValidationCheck = (item: any) => {
    const audioItemAttributes = {
      text: attributeValidationCheck("text", "string"),
      charactorIndex: attributeValidationCheck(
        "charactorIndex",
        "number",
        true
      ),
      query: (obj: any) => obj == null || audioQueryValidationCheck(obj),
    };
    for (const [attr, checker] of Object.entries(audioItemAttributes)) {
      checker(item[attr]);
    }
  };

  audioKeys.map((key: any) => {
    assert(
      key in audioItems,
      "AudioItems should contain the elements contained in AudioKeys."
    );
    const audioItem = audioItems[key];
    audioItemValidationCheck(audioItem);
  });
};