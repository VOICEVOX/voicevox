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
import { projectFilePath } from "./sandbox";
import { Store } from "@/store/vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  Phrase,
  PhraseKey,
  SingingVoiceKey,
  State,
} from "@/store/type";
import { secondToTick, tickToSecond } from "@/sing/domain";
import { phraseSingingVoices, singingVoiceCache } from "@/store/singing";
import onetimeWatch from "@/helpers/onetimeWatch";
import { createLogger } from "@/helpers/log";
import { getOrThrow } from "@/helpers/mapHelper";
import { showQuestionDialog } from "@/components/Dialog/Dialog";
import { UnreachableError } from "@/type/utility";

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
    let resolveUiLock: (() => void) | undefined;

    // 再生状態の更新
    onReceivedIPCMessage("updatePlayingState", (isPlaying: boolean) => {
      if (isPlaying && !resolveUiLock) {
        const { promise, resolve } = Promise.withResolvers<void>();
        resolveUiLock = resolve;
        void store.dispatch("SING_STOP_AUDIO");
        void store.dispatch("ASYNC_UI_LOCK", {
          callback: () => promise,
        });
      } else if (!isPlaying && resolveUiLock) {
        resolveUiLock();
        resolveUiLock = undefined;
      } else {
        log.warn(
          `unexpected isPlaying state: isPlaying=${isPlaying}, uiLockPromiseResolve=${!!resolveUiLock}`,
        );
      }
    });

    // エンジンが準備完了したときの処理
    onReceivedIPCMessage("engineReady", ({ port }: { port: number }) => {
      location.search = `?engineStatus=ready&port=${port}`;
    });

    // エンジンが起動していない時はエンジンを起動するように頼む
    const urlState = new URLSearchParams(window.location.search);
    if (urlState.get("engineStatus") !== "ready") {
      void (async () => {
        const engineInfos = await window.backend.engineInfos();
        const engineSettings =
          await window.backend.getSetting("engineSettings");
        const engineId = engineInfos[0].uuid;
        const engineSetting = engineSettings[engineId];
        if (!engineSetting) {
          throw new UnreachableError(`unreachable: engineSetting is not found`);
        }
        await startEngine({
          useGpu: engineSetting.useGpu,
          forceRestart: false,
        });
      })();
    }

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
        store.commit("SET_PROJECT_FILEPATH", { filePath: projectFilePath });
        void store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
      }, 5000),
      { deep: true },
    );

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

    void getProject().then((project) => {
      if (!project) {
        log.info("project not found");
        isReady.value = true;
        return;
      }
      log.info("project found");
      onetimeWatch(
        () => store.state.isEditorReady,
        async (isEditorReady) => {
          if (!isEditorReady) {
            return "continue";
          }

          log.info("Engine is ready, loading project");
          const loaded = await store.dispatch("LOAD_PROJECT_FILE", {
            type: "path",
            filePath: projectFilePath,
          });
          if (!loaded) {
            log.info("Failed to load project");
            const questionResult = await showQuestionDialog({
              title: "プロジェクトをエクスポートしますか？",
              message:
                "このまま続行すると、現在プラグインに保存されているプロジェクトは破棄されます。",
              buttons: [
                {
                  text: "破棄",
                  color: "warning",
                },
                {
                  text: "エクスポート",
                  color: "primary",
                },
              ],
            });
            if (questionResult === 1) {
              await exportProject();
            }
          }

          log.info("Loading cached voices");
          const encodedVoices = await getVoices();
          for (const [key, encodedVoice] of Object.entries(encodedVoices)) {
            singingVoiceCache.set(
              SingingVoiceKey(key),
              new Blob([await toBytes(encodedVoice)]),
            );
          }

          log.info(`Loaded ${Object.keys(encodedVoices).length} voices`);

          isReady.value = true;

          return "unwatch";
        },
        { deep: true },
      );
    });

    // フレーズ送信
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
            const cachedVoice = phraseSingingVoices.get(voice);
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
