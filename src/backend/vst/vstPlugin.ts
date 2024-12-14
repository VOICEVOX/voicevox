import { Plugin, ref, watch } from "vue";
import AsyncLock from "async-lock";
import { debounce } from "quasar";
import { toBase64, toBytes } from "fast-base64";
import {
  getProject,
  onReceivedIPCMessage,
  setPhrases,
  setTracks,
  getVoices,
  setVoices,
  getCurrentPosition,
  exportProject,
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
import { secondToTick } from "@/sing/domain";
import { phraseSingingVoices, singingVoiceCache } from "@/store/singing";
import onetimeWatch from "@/helpers/onetimeWatch";
import { createLogger } from "@/domain/frontend/log";
import { getOrThrow } from "@/helpers/mapHelper";
import {
  showMessageDialog,
  showQuestionDialog,
} from "@/components/Dialog/Dialog";

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

    // void clearPhrases();

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
            if (questionResult === 0) {
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
    const sendPhrases = debounce(async (phrases: Map<PhraseKey, Phrase>) => {
      void lock.acquire("phrases", async () => {
        log.info("Sending phrases");
        const missingVoices = await setPhrases(
          [...phrases.values()].flatMap((phrase) =>
            phrase.singingVoiceKey
              ? [
                  {
                    start: phrase.startTime,
                    trackId: phrase.trackId,
                    voice: phrase.singingVoiceKey,
                  },
                ]
              : [],
          ),
        );

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
    }, 500);

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
