import { createPartialStore, DotNotationDispatch } from "../vuex";
import {
  executeWritePromiseOrDialog,
  promptProjectSaveFilePath,
  markCurrentProjectAsSaved,
  writeProjectFile,
} from "./saveProjectHelper";
import { createUILockAction } from "@/store/ui";
import {
  AllActions,
  AudioItem,
  ProjectStoreState,
  ProjectStoreTypes,
} from "@/store/type";
import { TrackId } from "@/type/preload";
import path from "@/helpers/path";
import { getValueOrThrow, ResultError } from "@/type/result";
import { LatestProjectType } from "@/infrastructures/projectFile/type";
import { ProjectFileFormatError } from "@/infrastructures/projectFile/type";
import {
  createDefaultTempo,
  createDefaultTimeSignature,
  createDefaultTrack,
  DEFAULT_TPQN,
} from "@/sing/domain";
import { EditorType } from "@/type/preload";
import { IsEqual, UnreachableError } from "@/type/utility";
import {
  showAlertDialog,
  showMessageDialog,
  showQuestionDialog,
} from "@/components/Dialog/Dialog";
import { uuid4 } from "@/helpers/random";
import { recordToMap } from "@/sing/utility";
import type { Track } from "@/domain/project/type";
import { migrateProjectFileObject } from "@/infrastructures/projectFile/migration";

export const projectStoreState: ProjectStoreState = {
  savedLastCommandIds: { talk: null, song: null },
};

const applyTalkProjectToStore = async (
  actions: DotNotationDispatch<AllActions>,
  talkProject: LatestProjectType["talk"],
) => {
  await actions.REMOVE_ALL_AUDIO_ITEM();

  const { audioItems, audioKeys } = talkProject;

  let prevAudioKey = undefined;
  for (const audioKey of audioKeys) {
    const audioItem = audioItems[audioKey];
    // z.recordではvalueの型がundefinedになるが、
    // valueがundefinedにならないことを検証したあとであれば、
    // このif文に引っかかることはないはずである
    if (audioItem == undefined) throw new Error("audioItem == undefined");
    prevAudioKey = await actions.REGISTER_AUDIO_ITEM({
      prevAudioKey,
      audioItem,
    });
  }
};

const applySongProjectToStore = async (
  actions: DotNotationDispatch<AllActions>,
  songProject: LatestProjectType["song"],
) => {
  const { tpqn, tempos, timeSignatures, tracks, trackOrder } = songProject;

  await actions.SET_TPQN({ tpqn });
  await actions.SET_TEMPOS({ tempos });
  await actions.SET_TIME_SIGNATURES({ timeSignatures });
  await actions.SET_TRACKS({
    tracks: new Map(
      trackOrder.map((trackId): [TrackId, Track] => {
        const track = tracks[trackId];
        if (!track) throw new Error("track == undefined");
        // TODO: トラックの変換処理を関数化する
        return [
          trackId,
          {
            name: track.name,
            singer: track.singer,
            keyRangeAdjustment: track.keyRangeAdjustment,
            volumeRangeAdjustment: track.volumeRangeAdjustment,
            notes: track.notes,
            pitchEditData: track.pitchEditData,
            phonemeTimingEditData: recordToMap(track.phonemeTimingEditData),
            solo: track.solo,
            mute: track.mute,
            gain: track.gain,
            pan: track.pan,
          },
        ];
      }),
    ),
  });
};

export const projectStore = createPartialStore<ProjectStoreTypes>({
  PROJECT_NAME_WITH_EXT: {
    getter(state) {
      return state.projectFilePath
        ? path.basename(state.projectFilePath)
        : undefined;
    },
  },

  PROJECT_NAME: {
    getter(state) {
      return state.projectFilePath
        ? path.basename(state.projectFilePath, ".vvproj")
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
          const result = await context.actions.SAVE_OR_DISCARD_PROJECT_FILE({});
          if (result == "canceled") {
            return;
          }
        }

        // トークプロジェクトの初期化
        await context.actions.REMOVE_ALL_AUDIO_ITEM();

        const audioItem: AudioItem = await context.actions.GENERATE_AUDIO_ITEM(
          {},
        );
        await context.actions.REGISTER_AUDIO_ITEM({
          audioItem,
        });

        // ソングプロジェクトの初期化
        await context.actions.SET_TPQN({ tpqn: DEFAULT_TPQN });
        await context.actions.SET_TEMPOS({
          tempos: [createDefaultTempo(0)],
        });
        await context.actions.SET_TIME_SIGNATURES({
          timeSignatures: [createDefaultTimeSignature(1)],
        });
        const trackId = TrackId(uuid4());
        await context.actions.SET_TRACKS({
          tracks: new Map([[trackId, createDefaultTrack()]]),
        });
        await context.actions.SET_NOTES({ notes: [], trackId });
        await context.actions.SET_SINGER({ withRelated: true, trackId });
        await context.actions.CLEAR_PITCH_EDIT_DATA({ trackId });

        context.mutations.SET_PROJECT_FILEPATH({ filePath: undefined });
        void context.actions.CLEAR_UNDO_HISTORY();
      },
    ),
  },

  PARSE_PROJECT_FILE: {
    async action({ actions, getters }, { projectJson }) {
      const projectData: unknown = JSON.parse(projectJson);

      const characterInfos = getters.USER_ORDERED_CHARACTER_INFOS("talk");
      if (characterInfos == undefined)
        throw new Error("characterInfos == undefined");

      const parsedProjectData = await migrateProjectFileObject(projectData, {
        fetchMoraData: (payload) => actions.FETCH_MORA_DATA(payload),
        voices: characterInfos.flatMap((characterInfo) =>
          characterInfo.metas.styles.map((style) => ({
            engineId: style.engineId,
            speakerId: characterInfo.metas.speakerUuid,
            styleId: style.styleId,
          })),
        ),
        showOldProjectWarningDialog: async () => {
          const result = await showQuestionDialog({
            type: "warning",
            title: "プロジェクトファイルのバージョン警告",
            message:
              "このプロジェクトファイルは新しいバージョンのVOICEVOXで作成されたため、一部の機能が正しく動作しない可能性があります。読み込みを続行しますか？",
            buttons: ["いいえ", { text: "はい", color: "danger" }],
            cancel: 0,
          });
          return result === 1;
        },
      });

      if (parsedProjectData === "oldProject") {
        return undefined;
      }

      return parsedProjectData;
    },
  },

  LOAD_PROJECT_FILE: {
    /**
     * プロジェクトファイルを読み込む。読み込めたかの成否が返る。
     * ファイル選択ダイアログを表示するか、ファイルパス指定するか、Fileインスタンスを渡すか選べる。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(
      async ({ actions, mutations, getters }, payload) => {
        let filePath: undefined | string;
        if (payload.type == "dialog") {
          const ret = await window.backend.showOpenFileDialog({
            title: "プロジェクトファイルの選択",
            name: "VOICEVOX Project file",
            mimeType: "application/json",
            extensions: ["vvproj"],
          });
          if (ret == undefined) {
            return false;
          }
          filePath = ret;
        } else if (payload.type == "path") {
          filePath = payload.filePath;
        }

        try {
          let buf: Uint8Array;
          if (filePath != undefined) {
            buf = await window.backend
              .readFile({ filePath })
              .then(getValueOrThrow);

            await actions.APPEND_RECENTLY_USED_PROJECT({
              filePath,
            });
          } else {
            if (payload.type != "file")
              throw new UnreachableError("payload.type != 'file'");
            buf = new Uint8Array(await payload.file.arrayBuffer());
          }

          const text = new TextDecoder("utf-8").decode(buf).trim();
          const parsedProjectData = await actions.PARSE_PROJECT_FILE({
            projectJson: text,
          });

          if (parsedProjectData == undefined) {
            return false;
          }

          if (getters.IS_EDITED) {
            const result = await actions.SAVE_OR_DISCARD_PROJECT_FILE({
              additionalMessage:
                "プロジェクトをロードすると現在のプロジェクトは破棄されます。",
            });
            if (result == "canceled") {
              return false;
            }
          }

          await applyTalkProjectToStore(actions, parsedProjectData.talk);
          await applySongProjectToStore(actions, parsedProjectData.song);

          mutations.SET_PROJECT_FILEPATH({ filePath });
          void actions.CLEAR_UNDO_HISTORY();
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
          await showAlertDialog({
            title: "エラー",
            message: `プロジェクトファイルの読み込みに失敗しました。\n${message}`,
          });
          return false;
        }
      },
    ),
  },

  SAVE_PROJECT_FILE_OVERWRITE: {
    /**
     * プロジェクトファイルを上書き保存する。
     * 現在のプロジェクトファイルが未設定の場合は名前をつけて保存する。
     * ファイルを保存できた場合はtrueが、キャンセルしたか例外が発生した場合はfalseが返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(async (context) => {
      const filePath = context.state.projectFilePath;
      if (!filePath) {
        return await context.actions.SAVE_PROJECT_FILE_AS();
      }

      const result = await executeWritePromiseOrDialog(
        writeProjectFile(context, filePath),
      );
      if (!result) return false;

      await markCurrentProjectAsSaved(context, filePath);
      return true;
    }),
  },

  SAVE_PROJECT_FILE_AS: {
    /**
     * プロジェクトファイルを名前をつけて保存し、現在のプロジェクトファイルのパスを更新する。
     * ファイルを保存できた場合はtrueが、キャンセルしたか例外が発生した場合はfalseが返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(async (context) => {
      const filePath = await promptProjectSaveFilePath(context);
      if (!filePath) return false;

      const result = await executeWritePromiseOrDialog(
        writeProjectFile(context, filePath),
      );
      if (!result) return false;

      if (context.state.projectFilePath !== filePath) {
        context.mutations.SET_PROJECT_FILEPATH({ filePath });
        await showMessageDialog({
          type: "info",
          title: "保存",
          message: `編集中のプロジェクトが ${filePath} に切り替わりました。`,
        });
      }

      await markCurrentProjectAsSaved(context, filePath);
      return true;
    }),
  },

  SAVE_PROJECT_FILE_AS_COPY: {
    /**
     * プロジェクトファイルを複製として保存する。
     * ファイルを保存できた場合はtrueが、キャンセルしたか例外が発生した場合はfalseが返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(async (context) => {
      const filePath = await promptProjectSaveFilePath(context);
      if (!filePath) return false;

      const result = await executeWritePromiseOrDialog(
        writeProjectFile(context, filePath),
      );
      return result;
    }),
  },

  /**
   * プロジェクトファイルを保存するか破棄するかキャンセルするかのダイアログを出して、保存する場合は保存する。
   * 何を選択したかが返る。
   * 保存に失敗した場合はキャンセル扱いになる。
   */
  SAVE_OR_DISCARD_PROJECT_FILE: {
    action: createUILockAction(async ({ actions }, { additionalMessage }) => {
      let message = "プロジェクトの変更が保存されていません。";
      if (additionalMessage) {
        message += "\n" + additionalMessage;
      }

      const result: number = await showQuestionDialog({
        type: "warning",
        title: "プロジェクトを保存しますか？",
        message,
        buttons: [
          "キャンセル",
          { text: "破棄する", color: "warning" },
          { text: "保存する", color: "primary" },
        ],
        cancel: 0,
      });
      if (result == 2) {
        const saved = await actions.SAVE_PROJECT_FILE_OVERWRITE();
        return saved ? "saved" : "canceled";
      } else if (result == 1) {
        return "discarded";
      } else {
        return "canceled";
      }
    }),
  },

  GET_INITIAL_PROJECT_FILE_PATH: {
    action: async () => {
      return await window.backend.getInitialProjectFilePath();
    },
  },

  IS_EDITED: {
    getter(state, getters) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: IsEqual<
        typeof state.savedLastCommandIds,
        typeof getters.LAST_COMMAND_IDS
      > = true;
      return Object.keys(state.savedLastCommandIds).some((_editor) => {
        const editor = _editor as EditorType;
        return (
          state.savedLastCommandIds[editor] !== getters.LAST_COMMAND_IDS[editor]
        );
      });
    },
  },

  SET_SAVED_LAST_COMMAND_IDS: {
    mutation(state, commandIds) {
      state.savedLastCommandIds = commandIds;
    },
  },

  RESET_SAVED_LAST_COMMAND_IDS: {
    mutation(state) {
      state.savedLastCommandIds = { talk: null, song: null };
    },
  },

  CLEAR_UNDO_HISTORY: {
    action({ mutations }) {
      mutations.RESET_SAVED_LAST_COMMAND_IDS();
      mutations.CLEAR_COMMANDS();
    },
  },
});
