import { createUILockAction } from "@/store/ui";
import {
  AudioItem,
  ProjectStoreState,
  ProjectGetters,
  ProjectActions,
  ProjectMutations,
  VoiceVoxStoreOptions,
} from "@/store/type";
import semver from "semver";
import { buildProjectFileName } from "./utility";

import Ajv, { JTDDataType } from "ajv/dist/jtd";
import { AccentPhrase } from "@/openapi";

const DEFAULT_SAMPLING_RATE = 24000;

export const projectStoreState: ProjectStoreState = {
  savedLastCommandUnixMillisec: null,
};

export const projectStore: VoiceVoxStoreOptions<
  ProjectGetters,
  ProjectActions,
  ProjectMutations
> = {
  getters: {
    PROJECT_NAME(state) {
      return state.projectFilePath !== undefined
        ? window.electron.getBaseName({ filePath: state.projectFilePath })
        : undefined;
    },
    IS_EDITED(state, getters) {
      return (
        getters.LAST_COMMAND_UNIX_MILLISEC !==
        state.savedLastCommandUnixMillisec
      );
    },
  },

  mutations: {
    SET_PROJECT_FILEPATH(state, { filePath }: { filePath?: string }) {
      state.projectFilePath = filePath;
    },
    SET_SAVED_LAST_COMMAND_UNIX_MILLISEC(state, unixMillisec) {
      state.savedLastCommandUnixMillisec = unixMillisec;
    },
  },

  actions: {
    CREATE_NEW_PROJECT: createUILockAction(
      async (context, { confirm }: { confirm?: boolean }) => {
        if (confirm !== false && context.getters.IS_EDITED) {
          const result: number = await window.electron.showQuestionDialog({
            type: "info",
            title: "警告",
            message:
              "プロジェクトの変更が保存されていません。\n" +
              "変更を破棄してもよろしいですか？",
            buttons: ["破棄", "キャンセル"],
            cancelId: 1,
          });
          if (result == 1) {
            return;
          }
        }

        await context.dispatch("REMOVE_ALL_AUDIO_ITEM");

        const audioItem: AudioItem = await context.dispatch(
          "GENERATE_AUDIO_ITEM",
          {}
        );
        await context.dispatch("REGISTER_AUDIO_ITEM", {
          audioItem,
        });

        context.commit("SET_PROJECT_FILEPATH", { filePath: undefined });
        context.commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
        context.commit("CLEAR_COMMANDS");
      }
    ),
    LOAD_PROJECT_FILE: createUILockAction(
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

        const projectFileErrorMsg = `VOICEVOX Project file "${filePath}" is a invalid file.`;

        try {
          const buf = await window.electron.readFile({ filePath });
          const text = new TextDecoder("utf-8").decode(buf).trim();
          const obj = JSON.parse(text);

          // appVersion Validation check
          if (!("appVersion" in obj && typeof obj.appVersion === "string")) {
            throw new Error(
              projectFileErrorMsg +
                " The appVersion of the project file should be string"
            );
          }
          const projectAppVersion: string = obj.appVersion;
          if (!semver.valid(projectAppVersion)) {
            throw new Error(
              projectFileErrorMsg +
                ` The app version of the project file "${projectAppVersion}" is invalid. The app version should be a string in semver format.`
            );
          }

          const semverSatisfiesOptions: semver.Options = {
            includePrerelease: true,
          };

          // Migration
          const engineId = "074fc39e-678b-4c13-8916-ffca8d505d1d";

          if (
            semver.satisfies(projectAppVersion, "<0.4", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in obj.audioItems) {
              if ("charactorIndex" in obj.audioItems[audioItemsKey]) {
                obj.audioItems[audioItemsKey].characterIndex =
                  obj.audioItems[audioItemsKey].charactorIndex;
                delete obj.audioItems[audioItemsKey].charactorIndex;
              }
            }
            for (const audioItemsKey in obj.audioItems) {
              if (obj.audioItems[audioItemsKey].query != null) {
                obj.audioItems[audioItemsKey].query.volumeScale = 1;
                obj.audioItems[audioItemsKey].query.prePhonemeLength = 0.1;
                obj.audioItems[audioItemsKey].query.postPhonemeLength = 0.1;
                obj.audioItems[audioItemsKey].query.outputSamplingRate =
                  DEFAULT_SAMPLING_RATE;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.5", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in obj.audioItems) {
              const audioItem = obj.audioItems[audioItemsKey];
              if (audioItem.query != null) {
                audioItem.query.outputStereo = false;
                for (const accentPhrase of audioItem.query.accentPhrases) {
                  if (accentPhrase.pauseMora) {
                    accentPhrase.pauseMora.vowelLength = 0;
                  }
                  for (const mora of accentPhrase.moras) {
                    if (mora.consonant) {
                      mora.consonantLength = 0;
                    }
                    mora.vowelLength = 0;
                  }
                }

                // set phoneme length
                // 0.7 未満のプロジェクトファイルは styleId ではなく characterIndex なので、ここだけ characterIndex とした
                if (audioItem.characterIndex === undefined)
                  throw new Error("audioItem.characterIndex === undefined");
                await context
                  .dispatch("FETCH_MORA_DATA", {
                    accentPhrases: audioItem.query.accentPhrases,
                    engineId,
                    styleId: audioItem.characterIndex,
                  })
                  .then((accentPhrases: AccentPhrase[]) => {
                    accentPhrases.forEach((newAccentPhrase, i) => {
                      const oldAccentPhrase = audioItem.query.accentPhrases[i];
                      if (newAccentPhrase.pauseMora) {
                        oldAccentPhrase.pauseMora.vowelLength =
                          newAccentPhrase.pauseMora.vowelLength;
                      }
                      newAccentPhrase.moras.forEach((mora, j) => {
                        if (mora.consonant) {
                          oldAccentPhrase.moras[j].consonantLength =
                            mora.consonantLength;
                        }
                        oldAccentPhrase.moras[j].vowelLength = mora.vowelLength;
                      });
                    });
                  });
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.7", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in obj.audioItems) {
              const audioItem = obj.audioItems[audioItemsKey];
              if (audioItem.characterIndex != null) {
                if (audioItem.characterIndex == 0) {
                  // 四国めたん 0 -> 四国めたん(あまあま) 0
                  audioItem.speaker = 0;
                }
                if (audioItem.characterIndex == 1) {
                  // ずんだもん 1 -> ずんだもん(あまあま) 1
                  audioItem.speaker = 1;
                }
                delete audioItem.characterIndex;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.8", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in obj.audioItems) {
              const audioItem = obj.audioItems[audioItemsKey];
              if (audioItem.speaker !== null) {
                audioItem.styleId = audioItem.speaker;
                delete audioItem.speaker;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.14", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in obj.audioItems) {
              const audioItem = obj.audioItems[audioItemsKey];
              if (audioItem.engineId === undefined) {
                audioItem.engineId = engineId;
              }
            }
          }

          // Validation check
          const ajv = new Ajv();
          const validate = ajv.compile(projectSchema);
          if (!validate(obj)) {
            throw validate.errors;
          }
          if (!obj.audioKeys.every((audioKey) => audioKey in obj.audioItems)) {
            throw new Error(
              projectFileErrorMsg +
                " Every audioKey in audioKeys should be a key of audioItems"
            );
          }
          if (
            !obj.audioKeys.every(
              (audioKey) => obj.audioItems[audioKey].engineId != undefined
            )
          ) {
            throw new Error(
              'Every audioItem should have a "engineId" attribute.'
            );
          }
          // FIXME: assert engineId is registered
          if (
            !obj.audioKeys.every(
              (audioKey) => obj.audioItems[audioKey].styleId != undefined
            )
          ) {
            throw new Error(
              'Every audioItem should have a "styleId" attribute.'
            );
          }

          if (confirm !== false && context.getters.IS_EDITED) {
            const result: number = await window.electron.showQuestionDialog({
              type: "info",
              title: "警告",
              message:
                "プロジェクトをロードすると現在のプロジェクトは破棄されます。\n" +
                "変更を破棄してもよろしいですか？",
              buttons: ["破棄", "キャンセル"],
              cancelId: 1,
            });
            if (result == 1) {
              return;
            }
          }
          await context.dispatch("REMOVE_ALL_AUDIO_ITEM");

          const { audioItems, audioKeys } = obj as ProjectType;

          let prevAudioKey = undefined;
          for (const audioKey of audioKeys) {
            const audioItem = audioItems[audioKey];
            prevAudioKey = await context.dispatch("REGISTER_AUDIO_ITEM", {
              prevAudioKey,
              audioItem,
            });
          }
          context.commit("SET_PROJECT_FILEPATH", { filePath });
          context.commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
          context.commit("CLEAR_COMMANDS");
        } catch (err) {
          window.electron.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            if (err.message.startsWith(projectFileErrorMsg))
              return "ファイルフォーマットが正しくありません。";
            return err.message;
          })();
          await window.electron.showMessageDialog({
            type: "error",
            title: "エラー",
            message,
          });
        }
      }
    ),
    SAVE_PROJECT_FILE: createUILockAction(
      async (context, { overwrite }: { overwrite?: boolean }) => {
        let filePath = context.state.projectFilePath;
        if (!overwrite || !filePath) {
          let defaultPath: string;

          if (!filePath) {
            // if new project: use generated name
            defaultPath = buildProjectFileName(context.state, "vvproj");
          } else {
            // if saveAs for existing project: use current project path
            defaultPath = filePath;
          }

          // Write the current status to a project file.
          const ret = await window.electron.showProjectSaveDialog({
            title: "プロジェクトファイルの保存",
            defaultPath,
          });
          if (ret == undefined) {
            return;
          }
          filePath = ret;
        }
        const appInfos = await window.electron.getAppInfos();
        const { audioItems, audioKeys } = context.state;
        const projectData: ProjectType = {
          appVersion: appInfos.version,
          audioKeys,
          audioItems,
        };
        const buf = new TextEncoder().encode(
          JSON.stringify(projectData)
        ).buffer;
        window.electron.writeFile({ filePath, buffer: buf });
        if (!context.state.projectFilePath) {
          context.commit("SET_PROJECT_FILEPATH", { filePath });
        }
        context.commit(
          "SET_SAVED_LAST_COMMAND_UNIX_MILLISEC",
          context.getters.LAST_COMMAND_UNIX_MILLISEC
        );
        return;
      }
    ),
  },
};

const moraSchema = {
  properties: {
    text: { type: "string" },
    vowel: { type: "string" },
    vowelLength: { type: "float32" },
    pitch: { type: "float32" },
  },
  optionalProperties: {
    consonant: { type: "string" },
    consonantLength: { type: "float32" },
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
    isInterrogative: { type: "boolean" },
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
    volumeScale: { type: "float32" },
    prePhonemeLength: { type: "float32" },
    postPhonemeLength: { type: "float32" },
    outputSamplingRate: { type: "int32" },
    outputStereo: { type: "boolean" },
  },
  optionalProperties: {
    kana: { type: "string" },
  },
} as const;

const audioItemSchema = {
  properties: {
    text: { type: "string" },
  },
  optionalProperties: {
    engineId: { type: "string" },
    styleId: { type: "int32" },
    query: audioQuerySchema,
    presetKey: { type: "string" },
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
