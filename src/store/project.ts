import { ActionTree } from "vuex";
import { createUILockAction } from "@/store/ui";
import { REGISTER_AUDIO_ITEM, REMOVE_ALL_AUDIO_ITEM } from "@/store/audio";
import { State, AudioItem } from "@/store/type";

import Ajv, { JTDDataType } from "ajv/dist/jtd";

export const LOAD_PROJECT_FILE = "LOAD_PROJECT_FILE";
export const SAVE_PROJECT_FILE = "SAVE_PROJECT_FILE";

export const projectActions = {
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

        // appVersion Validation check
        if (!("appVersion" in obj && typeof obj.appVersion === "string")) {
          throw new Error(
            "The appVersion of the project file should be string"
          );
        }
        const appVersionList = versionTextParse(obj.appVersion);
        const nowAppInfo = await window.electron.getAppInfos();
        const nowAppVersionList = versionTextParse(nowAppInfo.version);
        if (appVersionList == null || nowAppVersionList == null) {
          throw new Error(
            'An invalid appVersion format. The appVersion should be in the format "%d.%d.%d'
          );
        }

        // Migration
        if (appVersionList < [0, 4, 0]) {
          for (const audioKey of obj.audioKeys) {
            if ("charactorIndex" in obj.audioItems[audioKey]) {
              obj.audioItems[audioKey].characterIndex =
                obj.audioItems[audioKey].charactorIndex;
              delete obj.audioItems[audioKey].charactorIndex;
            }
          }
        }

        // Validation check
        const ajv = new Ajv();
        const validate = ajv.compile(projectSchema);
        if (!validate(obj)) {
          throw validate.errors;
        }

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

        const { audioItems, audioKeys } = obj as ProjectType;

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
        console.error(`VOICEVOX Project file "${filePath}" is a invalid file.`);
        await window.electron.showErrorDialog({
          title: "エラー",
          message: "ファイルフォーマットが正しくありません。",
        });
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
    const projectData: ProjectType = {
      appVersion: appInfos.version,
      audioKeys,
      audioItems,
    };
    const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
    window.electron.writeFile({ filePath, buffer: buf });
    return;
  }),
} as ActionTree<State, State>;

const moraSchema = {
  properties: {
    text: { type: "string" },
    vowel: { type: "string" },
    pitch: { type: "float32" },
  },
  optionalProperties: {
    consonant: { type: "string" },
  },
} as const;

const accentPhraseSchema = {
  properties: {
    moras: {
      elements: moraSchema,
    },
    accent: { type: "int32" },
  },
  optionalProperties: {
    pauseMora: moraSchema,
  },
} as const;

const audioQuerySchema = {
  properties: {
    accentPhrases: {
      elements: accentPhraseSchema,
    },
    speedScale: { type: "float32" },
    pitchScale: { type: "float32" },
    intonationScale: { type: "float32" },
  },
} as const;

const audioItemSchema = {
  properties: {
    text: { type: "string" },
  },
  optionalProperties: {
    characterIndex: { type: "int32" },
    query: audioQuerySchema,
  },
} as const;

export const projectSchema = {
  properties: {
    appVersion: { type: "string" },
    audioKeys: {
      // description: "Attribute keys of audioItems.",
      elements: { type: "string" },
    },
    audioItems: {
      // description: "VOICEVOX states per cell",
      values: audioItemSchema,
    },
  },
} as const;

export type LatestProjectType = JTDDataType<typeof projectSchema>;
interface ProjectType {
  appVersion: string;
  audioKeys: string[];
  audioItems: Record<string, AudioItem>;
}

export type VersionType = [number, number, number];

const versionTextParse = (appVersionText: string): VersionType | undefined => {
  const textArray = appVersionText.split(".");
  if (textArray.length !== 3) return undefined;
  const appVersion = textArray.map(Number) as VersionType;
  if (!appVersion.every((item) => Number.isInteger(item))) return undefined;
  return appVersion;
};
