import { Plugin, watch } from "vue";
import AsyncLock from "async-lock";
import { debounce } from "quasar";
import { clearPhrases, getPhrases, getProject, updatePhrases } from "./ipc";
import { projectFilePath } from "./sandbox";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { secondToTick, tickToSecond } from "@/sing/domain";
import { phraseDataMap } from "@/store/singing";
import { blobToBase64 } from "@/helpers/binaryHelper";
import onetimeWatch from "@/helpers/onetimeWatch";

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
  window.backend.logInfo(`[vstMessageReceiver] ${message}`, ...args);
};

export const vstMessageReceiver: Plugin = {
  install: (
    _,
    {
      store,
    }: {
      store: Store<State, AllGetters, AllActions, AllMutations>;
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
            window.backend.logWarn(
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

    const phrasesLock = new AsyncLock();

    clearPhrases();

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
        const isEmptyProject = songProjectState.tracks.every(
          (track) => track.notes.length === 0
        );
        if (isEmptyProject && !haveSentNonEmptyProject) {
          return;
        }
        haveSentNonEmptyProject = true;
        log("Saving project file");
        store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
      }, 5000),
      { deep: true }
    );

    watch(
      () => store.state.openedEditor,
      (openedEditor) => {
        if (openedEditor !== "song") {
          store.dispatch("SET_OPENED_EDITOR", { editor: "song" });
        }
      }
    );

    getProject().then((project) => {
      store.commit("SET_PROJECT_FILEPATH", { filePath: projectFilePath });
      if (!project) {
        log("project not found");
        return;
      }
      log("project found");
      onetimeWatch(
        () => store.state.isEditorReady,
        async (isEditorReady) => {
          if (!isEditorReady) {
            return "continue";
          }

          log("Engine is ready, loading project");
          await store.dispatch("LOAD_PROJECT_FILE", {
            filePath: projectFilePath,
          });
          return "unwatch";
        },
        { deep: true }
      );
    });

    watch(
      () => store.state.phrases,
      (phrases) => {
        phrasesLock.acquire("phrases", async () => {
          const playablePhrases = [...phrases.entries()].filter(
            ([, phrase]) => phrase.state === "PLAYABLE"
          );
          const removedPhrases: string[] = [];
          const vstPhrases = await getPhrases();
          for (const id of vstPhrases.keys()) {
            if (!playablePhrases.some(([phraseId]) => phraseId === id)) {
              removedPhrases.push(id);
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

              if (vstPhrases.get(id)?.startTime === phrase.startTime) {
                return undefined;
              }

              const startTime = phrase.startTime;
              if (startTime == undefined) {
                throw new Error("startTime is not found");
              }
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
