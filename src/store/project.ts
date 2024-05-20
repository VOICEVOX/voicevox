import semver from "semver";
import { getBaseName } from "./utility";
import { createPartialStore, Dispatch } from "./vuex";
import { generateAccentPhraseKey } from "./proxy";
import { createUILockAction } from "@/store/ui";
import {
  AllActions,
  AudioItem,
  EditorAccentPhrase,
  ProjectStoreState,
  ProjectStoreTypes,
} from "@/store/type";
import { AccentPhrase } from "@/openapi";
import { EngineId } from "@/type/preload";
import { getValueOrThrow, ResultError } from "@/type/result";
import { LatestProjectType, projectSchema } from "@/domain/project/schema";
import {
  createDefaultTempo,
  createDefaultTimeSignature,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BEATS,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/sing/domain";

const DEFAULT_SAMPLING_RATE = 24000;

export const projectStoreState: ProjectStoreState = {
  savedLastCommandUnixMillisec: null,
};

const validateTalkProject = (talkProject: LatestProjectType["talk"]) => {
  if (
    !talkProject.audioKeys.every(
      (audioKey) => audioKey in talkProject.audioItems,
    )
  ) {
    throw new Error(
      "Every audioKey in audioKeys should be a key of audioItems",
    );
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) => talkProject.audioItems[audioKey]?.voice != undefined,
    )
  ) {
    throw new Error('Every audioItem should have a "voice" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.engineId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "engineId" attribute.');
  }
  // FIXME: assert engineId is registered
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.speakerId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "speakerId" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.styleId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "styleId" attribute.');
  }
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

  LOAD_PROJECT_FILE: {
    /**
     * プロジェクトファイルを読み込む。読み込めたかの成否が返る。
     * エラー発生時はダイアログが表示される。
     */
    action: createUILockAction(
      async (
        context,
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

        const projectFileErrorMsg = `VOICEVOX Project file "${filePath}" is a invalid file.`;

        let buf: ArrayBuffer;
        try {
          buf = await window.backend
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
                " The appVersion of the project file should be string",
            );
          }
          const projectAppVersion: string = projectData.appVersion;
          if (!semver.valid(projectAppVersion)) {
            throw new Error(
              projectFileErrorMsg +
                ` The app version of the project file "${projectAppVersion}" is invalid. The app version should be a string in semver format.`,
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
                projectData.audioItems[audioItemsKey].query.prePhonemeLength =
                  0.1;
                projectData.audioItems[audioItemsKey].query.postPhonemeLength =
                  0.1;
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
                if (audioItem.characterIndex == undefined)
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
              if (audioItem.speaker != null) {
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
              if (audioItem.engineId == undefined) {
                audioItem.engineId = engineId;
              }
            }
          }

          if (
            semver.satisfies(projectAppVersion, "<0.15", semverSatisfiesOptions)
          ) {
            const characterInfos =
              context.getters.USER_ORDERED_CHARACTER_INFOS("talk");
            if (characterInfos == undefined)
              throw new Error("characterInfos == undefined");
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
              if (audioItem.voice == undefined) {
                const oldEngineId = audioItem.engineId;
                const oldStyleId = audioItem.styleId;
                const chracterinfo = characterInfos.find((characterInfo) =>
                  characterInfo.metas.styles.some(
                    (styeleinfo) =>
                      styeleinfo.engineId === audioItem.engineId &&
                      styeleinfo.styleId === audioItem.styleId,
                  ),
                );
                if (chracterinfo == undefined)
                  throw new Error(
                    `chracterinfo == undefined: ${oldEngineId}, ${oldStyleId}`,
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

          if (
            semver.satisfies(projectAppVersion, "<0.17", semverSatisfiesOptions)
          ) {
            // 0.17 未満のプロジェクトファイルはトークの情報のみ
            // なので全情報(audioKeys/audioItems)をtalkに移動する
            projectData.talk = {
              audioKeys: projectData.audioKeys,
              audioItems: projectData.audioItems,
            };

            // ソングの情報を初期化
            // generateSingingStoreInitialScoreが今後変わることがあるかもしれないので、
            // 0.17時点のスコア情報を直接書く
            projectData.song = {
              tpqn: DEFAULT_TPQN,
              tempos: [
                {
                  position: 0,
                  bpm: DEFAULT_BPM,
                },
              ],
              timeSignatures: [
                {
                  measureNumber: 1,
                  beats: DEFAULT_BEATS,
                  beatType: DEFAULT_BEAT_TYPE,
                },
              ],
              tracks: [
                {
                  singer: undefined,
                  keyRangeAdjustment: 0,
                  notes: [],
                },
              ],
            };

            delete projectData.audioKeys;
            delete projectData.audioItems;
          }

          if (
            semver.satisfies(
              projectAppVersion,
              "<0.17.1",
              semverSatisfiesOptions,
            )
          ) {
            // 声量調整値の追加
            for (const track of projectData.song.tracks) {
              track.volumeRangeAdjustment = 0;
            }
          }

          if (
            semver.satisfies(
              projectAppVersion,
              "<0.19.0",
              semverSatisfiesOptions,
            )
          ) {
            // ピッチ編集値の追加
            for (const track of projectData.song.tracks) {
              track.pitchEditData = [];
            }
          }
          if (
            semver.satisfies(
              projectAppVersion,
              "<0.20.0",
              semverSatisfiesOptions,
            )
          ) {
            for (const audioItemsKey in projectData.audioItems) {
              const audioItem = projectData.audioItems[audioItemsKey];
              if (audioItem.query != null) {
                audioItem.query.accentPhrases.forEach(
                  (accentPhrase: EditorAccentPhrase) => {
                    accentPhrase.key = generateAccentPhraseKey();
                  },
                );
              }
            }
          }
          // Validation check
          // トークはvalidateTalkProjectで検証する
          // ソングはSET_SCOREの中の`isValidScore`関数で検証される
          const parsedProjectData = projectSchema.parse(projectData);
          validateTalkProject(parsedProjectData.talk);

          if (confirm !== false && context.getters.IS_EDITED) {
            const result = await context.dispatch(
              "SAVE_OR_DISCARD_PROJECT_FILE",
              {
                additionalMessage:
                  "プロジェクトをロードすると現在のプロジェクトは破棄されます。",
              },
            );
            if (result == "canceled") {
              return false;
            }
          }

          await applyTalkProjectToStore(
            context.dispatch,
            parsedProjectData.talk,
          );
          await applySongProjectToStore(
            context.dispatch,
            parsedProjectData.song,
          );

          context.commit("SET_PROJECT_FILEPATH", { filePath });
          context.commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
          context.commit("CLEAR_COMMANDS");
          return true;
        } catch (err) {
          window.backend.logError(err);
          const message = (() => {
            if (typeof err === "string") return err;
            if (!(err instanceof Error)) return "エラーが発生しました。";
            if (err instanceof ResultError && err.code === "ENOENT")
              return "プロジェクトファイルが見つかりませんでした。ファイルが移動、または削除された可能性があります。";
            if (err.message.startsWith(projectFileErrorMsg))
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
