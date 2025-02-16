import { Plugin, ref, watch } from "vue";
import AsyncLock from "async-lock";
import { debounce } from "quasar";
import { toBase64, toBytes } from "fast-base64";
import { dequal } from "dequal";
import {
  getProject,
  onReceivedIPCMessage,
  setPhrases,
  setTracks,
  getVoices,
  setVoices,
  getCurrentPosition,
  exportProject,
  startEngine,
  VstPhrase,
} from "./ipc";
import { internalProjectFilePath } from "./sandbox";
import { Store } from "@/store/vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  Phrase,
  PhraseKey,
  SingingVoice,
  SingingVoiceKey,
  State,
} from "@/store/type";
import { secondToTick, tickToSecond } from "@/sing/domain";
import onetimeWatch from "@/helpers/onetimeWatch";
import { createLogger } from "@/helpers/log";
import { getOrThrow } from "@/helpers/mapHelper";
import { showQuestionDialog } from "@/components/Dialog/Dialog";
import { UnreachableError } from "@/type/utility";
import { loadEnvEngineInfos } from "@/domain/defaultEngine/envEngineInfo";

export type Message =
  | {
      type: "update:time";
      time: number;
    }
  | {
      type: "update:isPlaying";
      isPlaying: boolean;
    };

const log = createLogger("vstMessageReceiver");

// VSTプラグインからのメッセージを受け取る。
export const vstPlugin: Plugin = {
  install: (
    _,
    {
      store,
    }: {
      store: Store<State, AllGetters, AllActions, AllMutations>;
    },
  ) => {
    if (import.meta.env.VITE_TARGET !== "vst") {
      return;
    }

    // 再生状態の更新
    onReceivedIPCMessage("updatePlayingState", (isPlaying: boolean) => {
      if (isPlaying) {
        void store.dispatch("SING_STOP_AUDIO");
      }
    });

    // エンジンを起動するように指示
    void (async () => {
      const baseEngineInfo = loadEnvEngineInfos()[0];
      const engineSettings = await window.backend.getSetting("engineSettings");
      const engineId = baseEngineInfo.uuid;
      const engineSetting = engineSettings[engineId];
      if (!engineSetting) {
        throw new UnreachableError(`unreachable: engineSetting is not found`);
      }
      await startEngine({
        useGpu: engineSetting.useGpu,
        forceRestart: false,
      });
    })();

    // 再生位置の更新
    const updatePlayheadPosition = async () => {
      const maybeCurrentPosition = await getCurrentPosition();
      if (maybeCurrentPosition != undefined) {
        void store.dispatch("SET_PLAYHEAD_POSITION", {
          position: secondToTick(
            maybeCurrentPosition,
            store.state.tempos,
            store.state.tpqn,
          ),
        });
      }
      requestAnimationFrame(updatePlayheadPosition);
    };

    requestAnimationFrame(updatePlayheadPosition);

    const lock = new AsyncLock();

    const isReady = ref(false);
    // プロジェクトの保存と送信。
    // しばらく操作がない（最後の操作から5秒）場合に自動で保存する。（SAVE_PROJECT_FILEはuiLockがかかるため）
    watch(
      () => ({
        tempos: store.state.tempos,
        tpqn: store.state.tpqn,
        timeSignature: store.state.timeSignature,
        tracks: store.state.tracks,
      }),
      debounce(() => {
        if (!isReady.value) {
          return;
        }
        log.info("Saving project file");
        store.commit("SET_PROJECT_FILEPATH", {
          filePath: internalProjectFilePath,
        });
        void store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
      }, 5000),
      { deep: true },
    );

    // ソングエディタを強制。
    watch(
      () => store.state.openedEditor,
      (openedEditor) => {
        if (openedEditor !== "song") {
          void store.dispatch("SET_ROOT_MISC_SETTING", {
            key: "openedEditor",
            value: "song",
          });
        }
      },
    );

    // // プロジェクトの読み込み
    // const projectPromise = getProject();
    // onetimeWatch(
    //   () => store.state.projectFilePath,
    //   async (isEditorReady) => {
    //     if (!isEditorReady) {
    //       return "continue";
    //     }
    //
    //     const project = await projectPromise;
    //     if (!project) {
    //       log.info("project not found");
    //       isReady.value = true;
    //       return "unwatch";
    //     }
    //     log.info("project found");
    //
    //     log.info("Engine is ready, loading project");
    //     const loaded = await store.dispatch("LOAD_PROJECT_FILE", {
    //       type: "path",
    //       filePath: internalProjectFilePath,
    //     });
    //     // プロジェクトが読み込めなかった場合の緊急脱出口。
    //     if (!loaded) {
    //       log.info("Failed to load project");
    //       const questionResult = await showQuestionDialog({
    //         title: "プロジェクトをエクスポートしますか？",
    //         message:
    //           "このまま続行すると、現在プラグインに保存されているプロジェクトは破棄されます。",
    //         buttons: [
    //           {
    //             text: "破棄",
    //             color: "warning",
    //           },
    //           {
    //             text: "エクスポート",
    //             color: "primary",
    //           },
    //         ],
    //         cancel: "noCancel",
    //       });
    //       if (questionResult === 1) {
    //         await exportProject();
    //       }
    //     }
    //
    //     // キャッシュされた歌声を読み込む
    //     log.info("Loading cached voices");
    //     const encodedVoices = await getVoices();
    //     await store.actions.LOAD_SINGING_VOICE_CACHE({
    //       cache: new Map(
    //         await Promise.all(
    //           Object.entries(encodedVoices).map(
    //             async ([key, encodedVoice]) =>
    //               [
    //                 SingingVoiceKey(key),
    //                 new Blob([await toBytes(encodedVoice)]),
    //               ] satisfies [SingingVoiceKey, SingingVoice],
    //           ),
    //         ),
    //       ),
    //     });
    //
    //     log.info(`Loaded ${Object.keys(encodedVoices).length} voices`);
    //
    //     isReady.value = true;
    //
    //     return "unwatch";
    //   },
    //   { deep: true },
    // );

    // フレーズの送信。100msごとに送信する。
    let lastPhrases: VstPhrase[] = [];
    const sendPhrases = debounce(async (phrases: Map<PhraseKey, Phrase>) => {
      void lock.acquire("phrases", async () => {
        log.info("Sending phrases");
        const newPhrases = [...phrases.values()].map((phrase) => ({
          start: phrase.startTime,
          trackId: phrase.trackId,
          voice:
            (phrase.state === "PLAYABLE" && phrase.singingVoiceKey) || null,
          notes: phrase.notes.map((note) => ({
            start: tickToSecond(
              note.position,
              store.state.tempos,
              store.state.tpqn,
            ),
            end: tickToSecond(
              note.position + note.duration,
              store.state.tempos,
              store.state.tpqn,
            ),
            noteNumber: note.noteNumber,
          })),
        }));
        if (newPhrases.length === 0) {
          return;
        }
        if (dequal(newPhrases, lastPhrases)) {
          return;
        }
        lastPhrases = newPhrases;
        const missingVoices = await setPhrases(newPhrases);

        if (missingVoices.length > 0) {
          log.info(`Missing ${missingVoices.length} voices`);
          const voices: Record<SingingVoiceKey, string> = {};
          for (const voice of missingVoices) {
            const cachedVoice = await store.actions.GET_SINGING_VOICE({
              key: voice,
            });
            if (cachedVoice) {
              voices[voice] = await toBase64(
                new Uint8Array(await cachedVoice.arrayBuffer()),
              );
            }
          }

          await setVoices(voices);
          log.info("Voices sent");
        } else {
          log.info("All voices are available");
        }
      });
    }, 100);

    watch(
      () => [store.state.phrases, isReady] as const,
      ([phrases]) => {
        if (!isReady.value) return;
        sendPhrases(phrases);
      },
      { deep: true },
    );

    // トラック送信
    watch(
      () => [store.state.tracks, store.state.trackOrder, isReady] as const,
      ([tracks, trackOrder]) => {
        if (!isReady.value) return;
        void lock.acquire("tracks", async () => {
          log.info("Sending tracks");
          const serializedTracks = Object.fromEntries(
            trackOrder.map((trackId) => [trackId, getOrThrow(tracks, trackId)]),
          );

          await setTracks(serializedTracks);
        });
      },
      { deep: true },
    );
  },
};
