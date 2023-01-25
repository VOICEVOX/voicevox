import { createUILockAction } from "@/store/ui";
import { AudioItem, ProjectStoreState, ProjectStoreTypes } from "@/store/type";
import semver from "semver";
import { buildProjectFileName, getBaseName } from "./utility";
import { createPartialStore } from "./vuex";

import { AccentPhrase } from "@/openapi";
import { z } from "zod";

const DEFAULT_SAMPLING_RATE = 24000;

export const projectStoreState: ProjectStoreState = {
  savedLastCommandUnixMillisec: null,
};

export const projectStore = createPartialStore<ProjectStoreTypes>({
  PROJECT_NAME: {
    getter(state) {
      return state.projectFilePath
        ? getBaseName(state.projectFilePath)
        : undefined;
    },
  },

  SET_PROJECT_FILEPATH: {
    mutation(state, { filePath }: { filePath?: string }) {
      state.projectFilePath = filePath;
    },
  },

  CREATE_NEW_PROJECT: {
    action: createUILockAction(
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
  },

  LOAD_PROJECT_FILE: {
    action: createUILockAction(
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
          const projectData = JSON.parse(text);

          // appVersion Validation check
          if (
            !(
              "appVersion" in projectData &&
              typeof projectData.appVersion === "string"
            )
          ) {
            throw new Error(
              projectFileErrorMsg +
                " The appVersion of the project file should be string"
            );
          }
          const projectAppVersion: string = projectData.appVersion;
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
            for (const audioItemsKey in projectData.audioItems) {
              if ("charactorIndex" in projectData.audioItems[audioItemsKey]) {
                projectData.audioItems[audioItemsKey].characterIndex =
                  projectData.audioItems[audioItemsKey].charactorIndex;
                delete projectData.audioItems[audioItemsKey].charactorIndex;
              }
            }
            for (const audioItemsKey in projectData.audioItems) {
              if (projectData.audioItems[audioItemsKey].query != null) {
                projectData.audioItems[audioItemsKey].query.volumeScale = 1;
                projectData.audioItems[
                  audioItemsKey
                ].query.prePhonemeLength = 0.1;
                projectData.audioItems[
                  audioItemsKey
                ].query.postPhonemeLength = 0.1;
                projectData.audioItems[audioItemsKey].query.outputSamplingRate =
                  DEFAULT_SAMPLING_RATE;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.5", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
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
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
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
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
              if (audioItem.speaker !== null) {
                audioItem.styleId = audioItem.speaker;
                delete audioItem.speaker;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.14", semverSatisfiesOptions)
          ) {
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
              if (audioItem.engineId === undefined) {
                audioItem.engineId = engineId;
              }
            }
          }

          // Validation check
          const parsedProjectData = projectSchema.parse(projectData);
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) => audioKey in parsedProjectData.audioItems
            )
          ) {
            throw new Error(
              projectFileErrorMsg +
                " Every audioKey in audioKeys should be a key of audioItems"
            );
          }
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) =>
                parsedProjectData.audioItems[audioKey].engineId != undefined
            )
          ) {
            throw new Error(
              'Every audioItem should have a "engineId" attribute.'
            );
          }
          // FIXME: assert engineId is registered
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) =>
                parsedProjectData.audioItems[audioKey].styleId != undefined
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

          const { audioItems, audioKeys } = projectData as ProjectType;

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
  },

  SAVE_PROJECT_FILE: {
    action: createUILockAction(
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
        if (
          context.state.projectFilePath &&
          context.state.projectFilePath != filePath
        ) {
          window.electron.showMessageDialog({
            type: "info",
            title: "保存",
            message: `編集中のプロジェクトが ${filePath} に切り替わりました。`,
          });
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
        await window.electron.writeFile({ filePath, buffer: buf });
        context.commit("SET_PROJECT_FILEPATH", { filePath });
        context.commit(
          "SET_SAVED_LAST_COMMAND_UNIX_MILLISEC",
          context.getters.LAST_COMMAND_UNIX_MILLISEC
        );
        return;
      }
    ),
  },

  IS_EDITED: {
    getter(state, getters) {
      return (
        getters.LAST_COMMAND_UNIX_MILLISEC !==
        state.savedLastCommandUnixMillisec
      );
    },
  },

  SET_SAVED_LAST_COMMAND_UNIX_MILLISEC: {
    mutation(state, unixMillisec) {
      state.savedLastCommandUnixMillisec = unixMillisec;
    },
  },
});

const moraSchema = z.object({
  text: z.string(),
  vowel: z.string(),
  vowelLength: z.number(),
  pitch: z.number(),
  consonant: z.string().optional(),
  consonantLength: z.number().optional(),
});

const accentPhraseSchema = z.object({
  moras: z.array(moraSchema),
  accent: z.number(),
  pauseMora: moraSchema.optional(),
  isInterrogative: z.boolean().optional(),
});

const audioQuerySchema = z.object({
  accentPhrases: z.array(accentPhraseSchema),
  speedScale: z.number(),
  pitchScale: z.number(),
  intonationScale: z.number(),
  volumeScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  outputSamplingRate: z.number(),
  outputStereo: z.boolean(),
  kana: z.string().optional(),
});

const morphingInfoSchema = z.object({
  rate: z.number(),
  targetEngineId: z.string(),
  targetSpeakerId: z.string(),
  targetStyleId: z.number(),
});

const audioItemSchema = z.object({
  text: z.string(),
  engineId: z.string().optional(),
  styleId: z.number().optional(),
  query: audioQuerySchema.optional(),
  presetKey: z.string().optional(),
  morphingInfo: morphingInfoSchema.optional(),
});

const projectSchema = z.object({
  appVersion: z.string(),
  // description: "Attribute keys of audioItems.",
  audioKeys: z.array(z.string()),
  // description: "VOICEVOX states per cell",
  audioItems: z.record(audioItemSchema),
});

export type LatestProjectType = z.infer<typeof projectSchema>;
interface ProjectType {
  appVersion: string;
  audioKeys: string[];
  audioItems: Record<string, AudioItem>;
}
