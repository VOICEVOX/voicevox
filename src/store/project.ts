import { getBaseName } from "./utility";
import { createPartialStore, Dispatch } from "./vuex";
import { createUILockAction } from "@/store/ui";
import {
  AllActions,
  AudioItem,
  ProjectStoreState,
  ProjectStoreTypes,
} from "@/store/type";

import { getValueOrThrow, ResultError } from "@/type/result";
import { LatestProjectType } from "@/domain/project/schema";
import {
  migrateProjectFileObject,
  ProjectFileFormatError,
} from "@/domain/project";
import {
  createDefaultTempo,
  createDefaultTimeSignature,
  DEFAULT_TPQN,
} from "@/sing/domain";

export const projectStoreState: ProjectStoreState = {
  savedLastCommandUnixMillisec: null,
};

const applyTalkProjectToStore = async (
  dispatch: Dispatch<AllActions>,
  talkProject: LatestProjectType["talk"],
) => {
  await dispatch("REMOVE_ALL_AUDIO_ITEM");

  const { audioItems, audioKeys } = talkProject;

  let prevAudioKey = undefined;
  for (const audioKey of audioKeys) {
    const audioItem = audioItems[audioKey];
    // z.recordではvalueの型がundefinedになるが、
    // valueがundefinedにならないことを検証したあとであれば、
    // このif文に引っかかることはないはずである
    if (audioItem == undefined) throw new Error("audioItem == undefined");
    prevAudioKey = await dispatch("REGISTER_AUDIO_ITEM", {
      prevAudioKey,
      audioItem,
    });
  }
};

const applySongProjectToStore = async (
  dispatch: Dispatch<AllActions>,
  songProject: LatestProjectType["song"],
) => {
  const { tpqn, tempos, timeSignatures, tracks } = songProject;
  // TODO: マルチトラック対応
  await dispatch("SET_SINGER", {
    singer: tracks[0].singer,
  });
  await dispatch("SET_KEY_RANGE_ADJUSTMENT", {
    keyRangeAdjustment: tracks[0].keyRangeAdjustment,
  });
  await dispatch("SET_VOLUME_RANGE_ADJUSTMENT", {
    volumeRangeAdjustment: tracks[0].volumeRangeAdjustment,
  });
  await dispatch("SET_TPQN", { tpqn });
  await dispatch("SET_TEMPOS", { tempos });
  await dispatch("SET_TIME_SIGNATURES", { timeSignatures });
  await dispatch("SET_NOTES", { notes: tracks[0].notes });
  await dispatch("CLEAR_PITCH_EDIT_DATA"); // FIXME: SET_PITCH_EDIT_DATAがセッターになれば不要
  await dispatch("SET_PITCH_EDIT_DATA", {
    data: tracks[0].pitchEditData,
    startFrame: 0,
  });
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
            {},
          );
          if (result == "canceled") {
            return;
          }
        }

        // トークプロジェクトの初期化
        await context.dispatch("REMOVE_ALL_AUDIO_ITEM");

        const audioItem: AudioItem = await context.dispatch(
          "GENERATE_AUDIO_ITEM",
          {},
        );
        await context.dispatch("REGISTER_AUDIO_ITEM", {
          audioItem,
        });

        // ソングプロジェクトの初期化
        await context.dispatch("SET_TPQN", { tpqn: DEFAULT_TPQN });
        await context.dispatch("SET_TEMPOS", {
          tempos: [createDefaultTempo(0)],
        });
        await context.dispatch("SET_TIME_SIGNATURES", {
          timeSignatures: [createDefaultTimeSignature(1)],
        });
        await context.dispatch("SET_NOTES", { notes: [] });
        await context.dispatch("SET_SINGER", { withRelated: true });
        await context.dispatch("CLEAR_PITCH_EDIT_DATA");

        context.commit("SET_PROJECT_FILEPATH", { filePath: undefined });
        context.commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
        context.commit("CLEAR_COMMANDS");
      },
    ),
  },

  PARSE_PROJECT_FILE: {
    async action({ dispatch, getters }, { projectJson }) {
      const projectData = JSON.parse(projectJson);

      const characterInfos = getters.USER_ORDERED_CHARACTER_INFOS("talk");
      if (characterInfos == undefined)
        throw new Error("characterInfos == undefined");

      const parsedProjectData = await migrateProjectFileObject(projectData, {
        fetchMoraData: (payload) => dispatch("FETCH_MORA_DATA", payload),
        voices: characterInfos.flatMap((characterInfo) =>
          characterInfo.metas.styles.map((style) => ({
            engineId: style.engineId,
            speakerId: characterInfo.metas.speakerUuid,
            styleId: style.styleId,
          })),
        ),
      });

      return parsedProjectData;
    },
  },

  LOAD_PROJECT_FILE: {
    /**
     * プロジェクトファイルを読み込む。読み込めたかの成否が返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(
      async (
        { dispatch, commit, getters },
        { filePath, confirm }: { filePath?: string; confirm?: boolean },
      ) => {
        if (!filePath) {
          // Select and load a project File.
          const ret = await window.backend.showProjectLoadDialog({
            title: "プロジェクトファイルの選択",
          });
          if (ret == undefined || ret?.length == 0) {
            return false;
          }
          filePath = ret[0];
        }

        let buf: ArrayBuffer;
        try {
          buf = await window.backend
            .readFile({ filePath })
            .then(getValueOrThrow);

          await dispatch("APPEND_RECENTLY_USED_PROJECT", {
            filePath,
          });

          const text = new TextDecoder("utf-8").decode(buf).trim();
          const parsedProjectData = await dispatch("PARSE_PROJECT_FILE", {
            projectJson: text,
          });

          if (confirm !== false && getters.IS_EDITED) {
            const result = await dispatch("SAVE_OR_DISCARD_PROJECT_FILE", {
              additionalMessage:
                "プロジェクトをロードすると現在のプロジェクトは破棄されます。",
            });
            if (result == "canceled") {
              return false;
            }
          }

          await applyTalkProjectToStore(dispatch, parsedProjectData.talk);
          await applySongProjectToStore(dispatch, parsedProjectData.song);

          commit("SET_PROJECT_FILEPATH", { filePath });
          commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
          commit("CLEAR_COMMANDS");
          return true;
        } catch (err) {
          window.backend.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            if (err instanceof ResultError && err.code === "ENOENT")
              return "プロジェクトファイルが見つかりませんでした。ファイルが移動、または削除された可能性があります。";
            if (err instanceof ProjectFileFormatError)
              return "ファイルフォーマットが正しくありません。";
            return err.message;
          })();
          await window.backend.showMessageDialog({
            type: "error",
            title: "エラー",
            message: `プロジェクトファイルの読み込みに失敗しました。\n${message}`,
          });
          return false;
        }
      },
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
            const ret = await window.backend.showProjectSaveDialog({
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
            await window.backend.showMessageDialog({
              type: "info",
              title: "保存",
              message: `編集中のプロジェクトが ${filePath} に切り替わりました。`,
            });
          }

          await context.dispatch("APPEND_RECENTLY_USED_PROJECT", {
            filePath,
          });
          const appInfos = await window.backend.getAppInfos();
          const {
            audioItems,
            audioKeys,
            tpqn,
            tempos,
            timeSignatures,
            tracks,
          } = context.state;
          const projectData: LatestProjectType = {
            appVersion: appInfos.version,
            talk: {
              audioKeys,
              audioItems,
            },
            song: {
              tpqn,
              tempos,
              timeSignatures,
              tracks,
            },
          };

          const buf = new TextEncoder().encode(
            JSON.stringify(projectData),
          ).buffer;
          await window.backend
            .writeFile({
              filePath,
              buffer: buf,
            })
            .then(getValueOrThrow);
          context.commit("SET_PROJECT_FILEPATH", { filePath });
          context.commit(
            "SET_SAVED_LAST_COMMAND_UNIX_MILLISEC",
            context.getters.LAST_COMMAND_UNIX_MILLISEC,
          );
          return true;
        } catch (err) {
          window.backend.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            return err.message;
          })();
          await window.backend.showMessageDialog({
            type: "error",
            title: "エラー",
            message: `プロジェクトファイルの保存に失敗しました。\n${message}`,
          });
          return false;
        }
      },
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

      const result: number = await window.backend.showQuestionDialog({
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
        return "discarded";
      } else {
        return "canceled";
      }
    }),
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
