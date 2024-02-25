import { Plugin, watch } from "vue";
import AsyncLock from "async-lock";
import { debounce } from "quasar";
import { Router } from "vue-router";
import { clearPhrases, getProject, updatePhrases } from "./ipc";
import { projectFilePath } from "./sandbox";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { secondToTick, tickToSecond } from "@/sing/domain";
import { phraseDataMap } from "@/store/singing";
import { blobToBase64 } from "@/helpers/binaryHelper";

export type Message =
  | {
      type: "update:time";
      time: number;
    }
  | {
      type: "update:isPlaying";
      isPlaying: boolean;
    };

type PhraseWithAudio = {
  id: string;
  start: number;
  end: number;
  wav: string;
};

const log = (message: string, ...args: unknown[]) => {
  window.electron.logInfo(`[vstMessageReceiver] ${message}`, ...args);
};

export const vstMessageReceiver: Plugin = {
  install: (
    _,
    {
      store,
      router,
    }: {
      store: Store<State, AllGetters, AllActions, AllMutations>;
      router: Router;
    }
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
            store.dispatch("ASYNC_UI_LOCK", {
              callback: () =>
                new Promise((resolve) => {
                  uiLockPromiseResolve = resolve;
                }),
            });
          } else if (!message.isPlaying && uiLockPromiseResolve) {
            uiLockPromiseResolve();
            uiLockPromiseResolve = undefined;
          } else {
            window.electron.logWarn(
              `[vstOnMessage] unexpected isPlaying state: isPlaying=${message.isPlaying}, uiLockPromiseResolve=${uiLockPromiseResolve}`
            );
          }

          break;
        case "update:time":
          store.dispatch("SET_PLAYHEAD_POSITION", {
            position: secondToTick(
              message.time,
              store.state.tempos,
              store.state.tpqn
            ),
          });
          break;
      }
    };

    const vstPhrases: Map<string, { blob: Blob; startTime: number }> =
      new Map();

    const phrasesLock = new AsyncLock();

    clearPhrases();

    const songProjectState = {
      tempos: store.state.tempos,
      tpqn: store.state.tpqn,
      timeSignature: store.state.timeSignature,
      tracks: store.state.tracks,
    };

    let isFirstChange = true;
    watch(
      () => songProjectState,
      debounce(() => {
        if (isFirstChange) {
          isFirstChange = false;
          return;
        }
        log("Saving project file");
        store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
      }, 5000),
      { deep: true }
    );

    getProject().then((project) => {
      store.commit("SET_PROJECT_FILEPATH", { filePath: projectFilePath });
      if (!project) {
        log("project not found");
        return;
      }
      log("project found");
      router.push(`/talk?projectFilePath=${projectFilePath}`);
    });

    watch(
      () => store.state.phrases,
      (phrases) => {
        phrasesLock.acquire("phrases", async () => {
          const playablePhrases = [...phrases.entries()].filter(
            ([, phrase]) => phrase.state === "PLAYABLE"
          );
          const removedPhrases: string[] = [];
          for (const [id] of vstPhrases) {
            if (!playablePhrases.some(([phraseId]) => phraseId === id)) {
              removedPhrases.push(id);
              vstPhrases.delete(id);
            }
          }

          const newPhrasesWithAudio = await Promise.all(
            playablePhrases.map(async ([id, phrase]) => {
              const data = phraseDataMap.get(id);
              if (!data) {
                throw new Error("phraseDataMap is not found");
              }
              const wav = data.blob;
              if (!wav) {
                throw new Error("wav is not found");
              }

              if (
                vstPhrases.get(id)?.blob === wav &&
                vstPhrases.get(id)?.startTime === phrase.startTime
              ) {
                return undefined;
              }

              const startTime = phrase.startTime;
              if (startTime == undefined) {
                throw new Error("startTime is not found");
              }
              vstPhrases.set(id, { blob: wav, startTime });
              return {
                id,
                start: startTime,
                end: tickToSecond(
                  phrase.endTicks,
                  store.state.tempos,
                  store.state.tpqn
                ),
                wav: await blobToBase64(wav),
              };
            })
          ).then(
            (phrases) =>
              phrases.filter(
                (phrase) => phrase != undefined
              ) as PhraseWithAudio[]
          );

          if (removedPhrases.length === 0 && newPhrasesWithAudio.length === 0) {
            return;
          }
          updatePhrases(removedPhrases, newPhrasesWithAudio);
        });
      },
      { deep: true }
    );
  },
};
