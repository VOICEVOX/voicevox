import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";
import Ajv from "ajv";

import { State, AudioItem } from "./type";
import { commandStore } from "./command";
import {
  audioStore,
  REMOVE_ALL_AUDIO_ITEM,
  REGISTER_AUDIO_ITEM,
} from "./audio";
import { uiStore, createUILockAction } from "./ui";

export const GET_OSS_LICENSES = "GET_OSS_LICENSES";
export const LOAD_PROJECT_FILE = "LOAD_PROJECT_FILE";
export const SAVE_PROJECT_FILE = "SAVE_PROJECT_FILE";
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
    [LOAD_PROJECT_FILE]: createUILockAction(
      async (
        context,
        { filePath, confirm }: { filePath?: string; confirm?: boolean }
      ) => {
        if (!filePath) {
          // Select and load a project File.
          const ret = await window.electron.showProjectLoadDialog({
            title: "プロジェクトファイルの選択",
          });
          if (ret == undefined || ret?.length == 0) {
            return;
          }
          filePath = ret[0];
        }

        try {
          const buf = await window.electron.readFile({ filePath });
          const text = new TextDecoder("utf-8").decode(buf).trim();
          const obj = JSON.parse(text);
          if (!(await projectValidationCheck(obj, true))) {
            return;
          }
          const projectData = obj as ProjectData;
          if (
            confirm !== false &&
            !(await window.electron.showConfirmDialog({
              title: "警告",
              message:
                "プロジェクトをロードすると現在のプロジェクトは破棄されます。\n" +
                "よろしいですか？",
            }))
          ) {
            return;
          }
          await context.dispatch(REMOVE_ALL_AUDIO_ITEM);

          const { audioItems, audioKeys } = projectData;

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
            `VOICEVOX Project file "${filePath}" is a invalid file.`
          );
        }
      }
    ),
    [SAVE_PROJECT_FILE]: createUILockAction(async (context) => {
      // Write the current status to a project file.
      const ret = await window.electron.showProjectSaveDialog({
        title: "プロジェクトファイルの選択",
      });
      if (ret == undefined) {
        return;
      }
      const filePath = ret;

      const appInfos = await window.electron.getAppInfos();
      const { audioItems, audioKeys } = context.state;
      const projectData = {
        appVersion: appInfos.version,
        audioKeys,
        audioItems,
      };
      const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
      window.electron.writeFile({ filePath, buffer: buf });
      return;
    }),
    [GET_UPDATE_INFOS]: async () => {
      return await window.electron.getUpdateInfos();
    },
  },
});

export const useStore = () => {
  return baseUseStore(storeKey);
};

type ProjectData = {
  appVersion: string;
  audioKeys: string[];
  audioItems: Record<string, AudioItem>;
};

// https://githubmemory.com/repo/ajv-validator/ajv/issues/1652
const projectSchema = {
  title: "VOICEVOX Project",
  type: "object",
  properties: {
    appVersion: { type: "string" },
    audioKeys: {
      // discription: "Attribute keys of audioItems.",
      type: "array",
      items: { type: "string" },
    },
    audioItems: {
      // discription: "VOICEVOX states per cell",
      type: "object",
      additionalProperties: {
        $ref: "#/$defs/AudioItem",
      },
    },
  },
  required: ["appVersion", "audioKeys", "audioItems"],
  $defs: {
    Mora: {
      type: "object",
      properties: {
        text: { type: "string" },
        consonant: { type: "string" },
        vowel: { type: "string" },
        pitch: { type: "number" },
      },
      required: ["text", "vowel", "pitch"],
    },
    AccentPhrase: {
      type: "object",
      properties: {
        moras: {
          type: "array",
          nullable: true,
          items: { $ref: "#/$defs/Mora" },
        },
        accent: { type: "number" },
        pauseMora: { $ref: "#/$defs/Mora" },
      },
      required: ["moras", "accent"],
    },
    AudioQuery: {
      type: "object",
      properties: {
        accentPhrases: {
          type: "array",
          nullable: true,
          items: { $ref: "#/$defs/AccentPhrase" },
        },
        speedScale: { type: "number" },
        pitchScale: { type: "number" },
        intonationScale: { type: "number" },
      },
      required: [
        "accentPhrases",
        "speedScale",
        "pitchScale",
        "intonationScale",
      ],
    },
    AudioItem: {
      type: "object",
      properties: {
        text: { type: "string" },
        charactorIndex: { type: "number" },
        query: { $ref: "#/$defs/AudioQuery" },
      },
      required: ["text"],
    },
  },
};

// projectValidationCheck(text: string) -> void;
// Check for validation using the given text as project data.
const projectValidationCheck = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  showError = false
): Promise<boolean> => {
  const ajv = new Ajv();
  const validate = ajv.compile<ProjectData>(projectSchema);
  if (!validate(obj)) {
    if (showError) console.error(validate.errors);
    return false;
  }
  const projectData = obj;
  const appVersionText = projectData.appVersion;
  const appVersion = appVersionText.split(".").map(Number);

  const appInfos = await window.electron.getAppInfos();
  const APP_VERSION = appInfos.version.split(".").map(Number);
  if (appVersion > APP_VERSION) {
    if (showError)
      console.error(
        `project propertie "appVersion" should be lower than ${appInfos.version}`
      );
    return false;
  }

  const { audioItems, audioKeys } = projectData;
  if (!audioKeys.every((audioKey) => audioKey in audioItems)) {
    if (showError)
      console.error(
        "All audioKeys contained in audioKeys should be attributes of audioItems."
      );
    return false;
  }
  return true;
};
