import { Plugin, watch } from "vue";
import AsyncLock from "async-lock";
import { clearPhrases, updatePhrases } from "./ipc";
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

export const vstMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> }
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
            options.store.dispatch("ASYNC_UI_LOCK", {
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
          options.store.dispatch("SET_PLAYHEAD_POSITION", {
            position: secondToTick(
              message.time,
              options.store.state.tempos,
              options.store.state.tpqn
            ),
          });
          break;
      }
    };

    const vstPhrases: Map<string, { blob: Blob; startTime: number }> =
      new Map();

    const phrasesLock = new AsyncLock();

    clearPhrases();

    watch(
      () => options.store.state.phrases,
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
                  options.store.state.tempos,
                  options.store.state.tpqn
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

          updatePhrases(removedPhrases, newPhrasesWithAudio);
        });
      },
      { deep: true }
    );
  },
};
