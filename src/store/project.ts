import semver from "semver";
import { z } from "zod";
import { getBaseName } from "./utility";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "@/store/ui";
import { AudioItem, ProjectStoreState, ProjectStoreTypes } from "@/store/type";

import { AccentPhrase } from "@/openapi";
import {
  AudioKey,
  audioKeySchema,
  EngineId,
  engineIdSchema,
  speakerIdSchema,
  styleIdSchema,
  WorkspaceType,
} from "@/type/preload";
import { getValueOrThrow, ResultError } from "@/type/result";
import { escapeHtml } from "@/helpers/htmlHelper";

const DEFAULT_SAMPLING_RATE = 24000;

export const projectStoreState: ProjectStoreState = {
  savedLastCommandUnixMillisec: null,
  workspace: {
    state: "none",
  },
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
          const result = await context.dispatch(
            "SAVE_OR_DISCARD_PROJECT_FILE",
            {}
          );
          if (result == "canceled") {
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
        context.dispatch("GENERATE_WORKSPACE", { tempProjectState: "none" });
      }
    ),
  },

  LOAD_PROJECT_FILE: {
    /**
     * プロジェクトファイルを読み込む。読み込めたかの成否が返る。
     * エラー発生時はダイアログが表示される。
     */
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
            return false;
          }
          filePath = ret[0];
        }

        const projectFileErrorMsg = `VOICEVOX Project file "${filePath}" is a invalid file.`;

        let buf: ArrayBuffer;
        try {
          buf = await window.electron
            .readFile({ filePath })
            .then(getValueOrThrow);

          await context.dispatch("APPEND_RECENTLY_USED_PROJECT", {
            filePath,
          });
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
          const engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");

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
                  // 四国めたん 0 -> 四国めたん（あまあま） 0
                  audioItem.speaker = 0;
                }
                if (audioItem.characterIndex == 1) {
                  // ずんだもん 1 -> ずんだもん（あまあま） 1
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

          if (
            semver.satisfies(projectAppVersion, "<0.15", semverSatisfiesOptions)
          ) {
            const characterInfos = context.getters.USER_ORDERED_CHARACTER_INFOS;
            if (characterInfos == undefined)
              throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
              if (audioItem.voice == undefined) {
                const oldEngineId = audioItem.engineId;
                const oldStyleId = audioItem.styleId;
                const chracterinfo = characterInfos.find((characterInfo) =>
                  characterInfo.metas.styles.some(
                    (styeleinfo) =>
                      styeleinfo.engineId === audioItem.engineId &&
                      styeleinfo.styleId === audioItem.styleId
                  )
                );
                if (chracterinfo == undefined)
                  throw new Error(
                    `chracterinfo == undefined: ${oldEngineId}, ${oldStyleId}`
                  );
                const speakerId = chracterinfo.metas.speakerUuid;
                audioItem.voice = {
                  engineId: oldEngineId,
                  speakerId,
                  styleId: oldStyleId,
                };

                delete audioItem.engineId;
                delete audioItem.styleId;
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
                parsedProjectData.audioItems[audioKey]?.voice != undefined
            )
          ) {
            throw new Error('Every audioItem should have a "voice" attribute.');
          }
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) =>
                parsedProjectData.audioItems[audioKey]?.voice.engineId !=
                undefined
            )
          ) {
            throw new Error('Every voice should have a "engineId" attribute.');
          }
          // FIXME: assert engineId is registered
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) =>
                parsedProjectData.audioItems[audioKey]?.voice.speakerId !=
                undefined
            )
          ) {
            throw new Error('Every voice should have a "speakerId" attribute.');
          }
          if (
            !parsedProjectData.audioKeys.every(
              (audioKey) =>
                parsedProjectData.audioItems[audioKey]?.voice.styleId !=
                undefined
            )
          ) {
            throw new Error('Every voice should have a "styleId" attribute.');
          }

          if (confirm !== false && context.getters.IS_EDITED) {
            const result = await context.dispatch(
              "SAVE_OR_DISCARD_PROJECT_FILE",
              {
                additionalMessage:
                  "プロジェクトをロードすると現在のプロジェクトは破棄されます。",
              }
            );
            if (result == "canceled") {
              return false;
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
          context.dispatch("GENERATE_WORKSPACE", {
            tempProjectState: "saved",
          });
          return true;
        } catch (err) {
          window.electron.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            if (err instanceof ResultError && err.code === "ENOENT")
              return "プロジェクトファイルが見つかりませんでした。ファイルが移動、または削除された可能性があります。";
            if (err.message.startsWith(projectFileErrorMsg))
              return "ファイルフォーマットが正しくありません。";
            return err.message;
          })();
          await window.electron.showMessageDialog({
            type: "error",
            title: "エラー",
            message: `プロジェクトファイルの読み込みに失敗しました。\n${message}`,
          });
          return false;
        }
      }
    ),
  },

  SAVE_PROJECT_FILE: {
    /**
     * プロジェクトファイルを保存する。保存の成否が返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(
      async (context, { overwrite }: { overwrite?: boolean }) => {
        let filePath = context.state.projectFilePath;
        try {
          if (!overwrite || !filePath) {
            let defaultPath: string;

            if (!filePath) {
              // if new project: use generated name
              defaultPath = `${context.getters.DEFAULT_PROJECT_FILE_BASE_NAME}.vvproj`;
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
              return false;
            }
            filePath = ret;
          }
          if (
            context.state.projectFilePath &&
            context.state.projectFilePath != filePath
          ) {
            await window.electron.showMessageDialog({
              type: "info",
              title: "保存",
              message: `編集中のプロジェクトが ${filePath} に切り替わりました。`,
            });
          }

          await context.dispatch("APPEND_RECENTLY_USED_PROJECT", {
            filePath,
          });
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
          await window.electron
            .writeFile({
              filePath,
              buffer: buf,
            })
            .then(getValueOrThrow);
          context.commit("SET_PROJECT_FILEPATH", { filePath });
          context.commit(
            "SET_SAVED_LAST_COMMAND_UNIX_MILLISEC",
            context.getters.LAST_COMMAND_UNIX_MILLISEC
          );
          // 保存完了時にワークスペースを更新する
          context.dispatch("GENERATE_WORKSPACE", { tempProjectState: "saved" });
          return true;
        } catch (err) {
          window.electron.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            return err.message;
          })();
          await window.electron.showMessageDialog({
            type: "error",
            title: "エラー",
            message: `プロジェクトファイルの保存に失敗しました。\n${message}`,
          });
          return false;
        }
      }
    ),
  },

  /**
   * プロジェクトファイルを保存するか破棄するかキャンセルするかのダイアログを出して、保存する場合は保存する。
   * 何を選択したかが返る。
   * 保存に失敗した場合はキャンセル扱いになる。
   */
  SAVE_OR_DISCARD_PROJECT_FILE: {
    action: createUILockAction(async ({ dispatch }, { additionalMessage }) => {
      let message = "プロジェクトの変更が保存されていません。";
      if (additionalMessage) {
        message += "\n" + additionalMessage;
      }
      message += "\n変更を保存しますか？";

      const result: number = await window.electron.showQuestionDialog({
        type: "info",
        title: "警告",
        message,
        buttons: ["保存", "破棄", "キャンセル"],
        cancelId: 2,
        defaultId: 2,
      });
      if (result == 0) {
        const saved = await dispatch("SAVE_PROJECT_FILE", {
          overwrite: true,
        });
        return saved ? "saved" : "canceled";
      } else if (result == 1) {
        // 変更内容を破棄する場合一時ファイルをクリアする
        await dispatch("GENERATE_WORKSPACE", {
          tempProjectState: "none",
        });
        return "discarded";
      } else {
        return "canceled";
      }
    }),
  },

  /**
   * プロジェクトを一時ファイルに保存する
   */
  SAVE_TEMP_PROJECT_FILE: {
    async action(context) {
      try {
        const { audioItems, audioKeys } = context.state;

        // 初期状態の audioItems の場合
        if (audioKeys.length <= 1 && !audioItems[audioKeys[0]].text) {
          return;
        }
        context.dispatch("GENERATE_WORKSPACE", { tempProjectState: "unSaved" });
      } catch (err) {
        window.electron.logError(err);
      }
    },
  },

  /**
   * 一時ファイルを読み込む
   * 一時ファイルにプロジェクトがある場合は、復元するか破棄するかのダイアログを出す
   */
  LOAD_OR_DISCARD_TEMP_PROJECT_FILE: {
    action: createUILockAction(async (context) => {
      try {
        const workspace = context.state.workspace;

        if (workspace.state === "none") {
          return;
        }

        const { autoLoadProjectInfo } = workspace;

        if (workspace.state === "saved") {
          // 自動読み込み機能OFFで保存済みの場合は何もしない
          if (!context.state.enableAutoLoad || !autoLoadProjectInfo) {
            return;
          }

          // プロジェクト保存先のファイル変更チェック
          if (context.getters.IS_PROJECT_EXTERNAL_MODIFIED) {
            const applyRestoredProject = await context.dispatch(
              "SHOW_CONFIRM_DIALOG",
              {
                title: "読み込みファイルの変更",
                message: `前回開いていたプロジェクトがエディタ外で変更されています。読み込みますか？<br />
                  読み込み先ファイル名：${escapeHtml(
                    getBaseName(autoLoadProjectInfo.projectFilePath)
                  )}`,
                actionName: "読み込む",
                cancel: "読み込まない",
                html: true,
              }
            );

            if (applyRestoredProject === "CANCEL") {
              return;
            }
          }

          // 自動読み込み機能有効時保存されたプロジェクトを復元する
          await context.dispatch("LOAD_PROJECT_FILE", {
            filePath: autoLoadProjectInfo.projectFilePath,
            confirm: false,
          });
          return;
        }

        const { tempProject } = workspace;

        // ダイアログに表示するメッセージを生成
        let dialogMessage = `復元されたプロジェクトがあります。復元しますか？<br /><br />
          復元内容：${escapeHtml(
            tempProject.project.audioItems[tempProject.project.audioKeys[0]]
              .text
          )}...`;

        // 保存済みプロジェクトの場合は保存先ファイル名を表示
        if (autoLoadProjectInfo) {
          dialogMessage += `<br />保存先ファイル名 : <span style='overflow-wrap: break-word;'>${escapeHtml(
            getBaseName(autoLoadProjectInfo.projectFilePath)
          )}</span>`;
        }

        if (context.getters.IS_PROJECT_EXTERNAL_MODIFIED) {
          dialogMessage +=
            "<br />※保存先のファイルが保存後にエディタ外で変更されています。";
        }

        // 未保存時の復元確認
        const applyRestoredProject = await context.dispatch(
          "SHOW_CONFIRM_DIALOG",
          {
            title: "復元されたプロジェクト",
            message: dialogMessage,
            actionName: "復元",
            cancel: "破棄",
            html: true,
          }
        );

        if (applyRestoredProject === "OK") {
          // 復元ボタン押下時
          // プロジェクト保存先の復元
          if (autoLoadProjectInfo) {
            context.commit("SET_PROJECT_FILEPATH", {
              filePath: autoLoadProjectInfo.projectFilePath,
            });
          }

          // AudioItems の復元
          await context.dispatch("REMOVE_ALL_AUDIO_ITEM");

          const parsedProjectData = projectSchema.parse(
            tempProject.project
          ) as ProjectType;
          const { audioItems, audioKeys } = parsedProjectData;

          let prevAudioKey: AudioKey | undefined;
          for (const audioKey of audioKeys) {
            const audioItem = audioItems[audioKey];
            prevAudioKey = await context.dispatch("REGISTER_AUDIO_ITEM", {
              prevAudioKey,
              audioItem,
            });
          }

          return;
        } else {
          // 破棄ボタン押下時
          await context.dispatch("GENERATE_WORKSPACE", {
            tempProjectState: "none",
          });
          return;
        }
      } catch (err) {
        window.electron.logError(err);

        const message = (() => {
          if (typeof err === "string") return err;
          if (!(err instanceof Error)) return "エラーが発生しました。";
          return err.message;
        })();
        await window.electron.showMessageDialog({
          type: "error",
          title: "エラー",
          message: `プロジェクト一時ファイルの読み込みに失敗しました。\n${message}`,
        });

        // エラー発生時に audioItem を再生成する
        if (context.state.audioKeys.length === 0) {
          const audioItem = await context.dispatch("GENERATE_AUDIO_ITEM", {});
          await context.dispatch("REGISTER_AUDIO_ITEM", {
            audioItem,
          });
        }

        return;
      }
    }),
  },

  SET_WORKSPACE: {
    mutation(state, { workspace }) {
      state.workspace = workspace;
    },
    async action({ commit }, { workspace }) {
      const buf = new TextEncoder().encode(JSON.stringify(workspace)).buffer;
      await window.electron.setTempProject(buf).then(getValueOrThrow);

      commit("SET_WORKSPACE", { workspace });
    },
  },

  HYDRATE_PROJECT_STORE: {
    async action({ commit }) {
      try {
        const workspace: WorkspaceType = await window.electron
          .getTempProject()
          .then(getValueOrThrow);

        await commit("SET_WORKSPACE", { workspace });
      } catch (e) {
        window.electron.logError(e);
      }
    },
  },

  /**
   * ワークスペース情報を生成し、一時ファイルに保存する
   */
  GENERATE_WORKSPACE: {
    async action({ state, dispatch, commit }, { tempProjectState }) {
      const backupState = state.workspace;
      let workspace = state.workspace as WorkspaceType;

      switch (tempProjectState) {
        case "unSaved": {
          const appInfos = await window.electron.getAppInfos();
          const { audioItems, audioKeys } = state;

          if (state.projectFilePath && state.workspace.state !== "none") {
            // プロジェクト保存または読み込み後に編集し、保存していない状態
            workspace = {
              state: "unSaved",
              tempProject: {
                project: {
                  appVersion: appInfos.version,
                  audioKeys,
                  audioItems,
                },
              },
              autoLoadProjectInfo: {
                projectFilePath: state.projectFilePath,
                projectSavedAt:
                  state.workspace.autoLoadProjectInfo?.projectSavedAt ?? null,
              },
            };
          } else {
            // プロジェクト新規作成後に編集し、保存していない状態
            workspace = {
              state: "unSaved",
              tempProject: {
                project: {
                  appVersion: appInfos.version,
                  audioKeys,
                  audioItems,
                },
              },
            };
          }
          break;
        }
        case "saved": {
          if (state.projectFilePath) {
            const fileModifiedAt = await window.electron
              .getFileModifiedAt(state.projectFilePath)
              .then(getValueOrThrow);

            workspace = {
              state: "saved",
              autoLoadProjectInfo: {
                projectFilePath: state.projectFilePath,
                projectSavedAt: fileModifiedAt,
                fileModifiedAt: fileModifiedAt,
              },
            };
          } else {
            // projectFilePath がない場合は none にする
            workspace = {
              state: "none",
            };
          }

          break;
        }
        case "none":
          workspace = {
            state: "none",
          };
      }

      try {
        await dispatch("SET_WORKSPACE", { workspace });
      } catch (err) {
        // ファイルの更新に失敗した場合はロールバック
        commit("SET_WORKSPACE", { workspace: backupState });
        window.electron.logError(err);
      }
    },
  },

  IS_EDITED: {
    getter(state, getters) {
      return (
        getters.LAST_COMMAND_UNIX_MILLISEC !==
          state.savedLastCommandUnixMillisec ||
        state.workspace.state === "unSaved"
      );
    },
  },

  SET_SAVED_LAST_COMMAND_UNIX_MILLISEC: {
    mutation(state, unixMillisec) {
      state.savedLastCommandUnixMillisec = unixMillisec;
    },
  },

  // 自動読み込み対象のプロジェクトファイルが外部で変更されていないかチェックする
  IS_PROJECT_EXTERNAL_MODIFIED: {
    getter(state) {
      if (
        state.workspace.state === "none" ||
        !state.workspace.autoLoadProjectInfo
      ) {
        return false;
      }

      return (
        state.workspace.autoLoadProjectInfo.fileModifiedAt !==
        state.workspace.autoLoadProjectInfo.projectSavedAt
      );
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
  targetEngineId: engineIdSchema,
  targetSpeakerId: speakerIdSchema,
  targetStyleId: styleIdSchema,
});

const audioItemSchema = z.object({
  text: z.string(),
  voice: z.object({
    engineId: engineIdSchema,
    speakerId: speakerIdSchema,
    styleId: styleIdSchema,
  }),
  query: audioQuerySchema.optional(),
  presetKey: z.string().optional(),
  morphingInfo: morphingInfoSchema.optional(),
});

const projectSchema = z.object({
  appVersion: z.string(),
  // description: "Attribute keys of audioItems.",
  audioKeys: z.array(audioKeySchema),
  // description: "VOICEVOX states per cell",
  audioItems: z.record(audioKeySchema, audioItemSchema),
});

export type LatestProjectType = z.infer<typeof projectSchema>;
export interface ProjectType {
  appVersion: string;
  audioKeys: AudioKey[];
  audioItems: Record<AudioKey, AudioItem>;
}
