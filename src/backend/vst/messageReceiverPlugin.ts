import { Plugin, watch } from "vue";
import AsyncLock from "async-lock";
import { debounce } from "quasar";
import { toBase64 } from "fast-base64";
import { getProject, setPhrases, setVoices } from "./ipc";
import { projectFilePath } from "./sandbox";
import { Store } from "@/store/vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  SingingVoiceKey,
  State,
} from "@/store/type";
import { secondToTick } from "@/sing/domain";
import { phraseSingingVoices } from "@/store/singing";
import onetimeWatch from "@/helpers/onetimeWatch";
import { createLogger } from "@/domain/frontend/log";

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

export const vstMessageReceiver: Plugin = {
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
    let uiLockPromiseResolve: (() => void) | undefined;
    // @ts-expect-error VSTからのメッセージを受け取るためのグローバル関数
    window.vstOnMessage = (message: Message) => {
      switch (message.type) {
        case "update:isPlaying":
          if (message.isPlaying && !uiLockPromiseResolve) {
            void store.dispatch("SING_STOP_AUDIO");
            void store.dispatch("ASYNC_UI_LOCK", {
              callback: () =>
                new Promise((resolve) => {
                  uiLockPromiseResolve = resolve;
                }),
            });
          } else if (!message.isPlaying && uiLockPromiseResolve) {
            uiLockPromiseResolve();
            uiLockPromiseResolve = undefined;
          } else {
            log.warn(
              `[vstOnMessage] unexpected isPlaying state: isPlaying=${message.isPlaying}, uiLockPromiseResolve=${!!uiLockPromiseResolve}`,
            );
          }

          break;
        case "update:time":
          void store.dispatch("SET_PLAYHEAD_POSITION", {
            position: secondToTick(
              message.time,
              store.state.tempos,
              store.state.tpqn,
            ),
          });
          break;
      }
    };

    const phrasesLock = new AsyncLock();

    // void clearPhrases();

    const songProjectState = {
      tempos: store.state.tempos,
      tpqn: store.state.tpqn,
      timeSignature: store.state.timeSignature,
      tracks: store.state.tracks,
    };

    let haveSentNonEmptyProject = false;
    watch(
      () => songProjectState,
      debounce(() => {
        const isEmptyProject = [...songProjectState.tracks.values()].every(
          (track) => track.notes.length === 0,
        );
        if (isEmptyProject && !haveSentNonEmptyProject) {
          return;
        }
        haveSentNonEmptyProject = true;
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
          void store.dispatch("SET_OPENED_EDITOR", { editor: "song" });
        }
      },
    );

    void getProject().then((project) => {
      if (!project) {
        log.info("project not found");
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
          await store.dispatch("LOAD_PROJECT_FILE", {
            filePath: projectFilePath,
          });
          return "unwatch";
        },
        { deep: true },
      );
    });

    watch(
      () => store.state.phrases,
      (phrases) => {
        void phrasesLock.acquire("phrases", async () => {
          log.info("Sending phrases");
          const missingVoices = await setPhrases(
            [...phrases.values()].flatMap((phrase) =>
              phrase.singingVoiceKey
                ? [
                    {
                      start: phrase.startTime,
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
      },
      { deep: true },
    );
  },
};
