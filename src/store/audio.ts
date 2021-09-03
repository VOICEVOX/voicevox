import { AudioQuery, AccentPhrase, Configuration, DefaultApi } from "@/openapi";
import { StoreOptions } from "vuex";
import path from "path";
import { createCommandAction } from "./command";
import { v4 as uuidv4 } from "uuid";
import { AudioItem, EngineState, SaveCommandResult, State } from "./type";
import { createUILockAction } from "./ui";
import { CharacterInfo, Encoding as EncodingType } from "@/type/preload";
import Encoding from "encoding-japanese";

const api = new DefaultApi(
  new Configuration({ basePath: process.env.VUE_APP_ENGINE_URL })
);

async function generateUniqueId(audioItem: AudioItem) {
  const data = new TextEncoder().encode(
    JSON.stringify([audioItem.text, audioItem.query, audioItem.characterIndex])
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

function parseTextFile(
  body: string,
  characterInfos?: CharacterInfo[]
): AudioItem[] {
  const characters = new Map(
    characterInfos?.map((info, index) => [info.metas.name, index])
  );
  if (!characters.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastCharacterIndex = 0;
  for (const splittedText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const characterIndex = characters.get(splittedText);
    if (characterIndex !== undefined) {
      lastCharacterIndex = characterIndex;
      continue;
    }

    audioItems.push({ text: splittedText, characterIndex: lastCharacterIndex });
  }
  return audioItems;
}

function buildFileName(state: State, audioKey: string) {
  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;
  const index = state.audioKeys.indexOf(audioKey);
  const audioItem = state.audioItems[audioKey];
  const character = state.characterInfos![audioItem.characterIndex!];
  const characterName = character.metas.name.replace(sanitizer, "");
  let text = audioItem.text.replace(sanitizer, "");
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }
  return (
    (index + 1).toString().padStart(3, "0") + `_${characterName}_${text}.wav`
  );
}

export const SET_ENGINE_STATE = "SET_ENGINE_STATE";
export const START_WAITING_ENGINE = "START_WAITING_ENGINE";
export const ACTIVE_AUDIO_KEY = "ACTIVE_AUDIO_KEY";
export const SET_ACTIVE_AUDIO_KEY = "SET_ACTIVE_AUDIO_KEY";
export const IS_ACTIVE = "IS_ACTIVE";
export const SET_CHARACTER_INFOS = "SET_CHARACTER_INFOS";
export const LOAD_CHARACTER = "LOAD_CHARACTER";
export const SET_AUDIO_TEXT = "SET_AUDIO_TEXT";
export const SET_AUDIO_CHARACTER_INDEX = "SET_AUDIO_CHARACTER_INDEX";
export const CHANGE_CHARACTER_INDEX = "CHANGE_CHARACTER_INDEX";
export const INSERT_AUDIO_ITEM = "INSERT_AUDIO_ITEM";
export const REMOVE_AUDIO_ITEM = "REMOVE_AUDIO_ITEM";
export const REMOVE_ALL_AUDIO_ITEM = "REMOVE_ALL_AUDIO_ITEM";
export const REGISTER_AUDIO_ITEM = "REGISTER_AUDIO_ITEM";
export const GET_AUDIO_CACHE = "GET_AUDIO_CACHE";
export const SET_ACCENT_PHRASES = "SET_ACCENT_PHRASES";
export const FETCH_ACCENT_PHRASES = "FETCH_ACCENT_PHRASES";
export const FETCH_MORA_PITCH = "FETCH_MORA_PITCH";
export const HAVE_AUDIO_QUERY = "HAVE_AUDIO_QUERY";
export const SET_AUDIO_QUERY = "SET_AUDIO_QUERY";
export const FETCH_AUDIO_QUERY = "FETCH_AUDIO_QUERY";
export const SET_AUDIO_SPEED_SCALE = "SET_AUDIO_SPEED_SCALE";
export const SET_AUDIO_PITCH_SCALE = "SET_AUDIO_PITCH_SCALE";
export const SET_AUDIO_INTONATION_SCALE = "SET_AUDIO_INTONATION_SCALE";
export const SET_AUDIO_VOLUME_SCALE = "SET_AUDIO_VOLUME_SCALE";
export const SET_AUDIO_ACCENT = "SET_AUDIO_ACCENT";
export const CHANGE_ACCENT = "CHANGE_ACCENT";
export const TOGGLE_ACCENT_PHRASE_SPLIT = "TOGGLE_ACCENT_PHRASE_SPLIT";
export const CHANGE_ACCENT_PHRASE_SPLIT = "CHANGE_ACCENT_PHRASE_SPLIT";
export const SET_AUDIO_MORA_PITCH = "SET_AUDIO_MORA_PITCH";
export const GENERATE_AUDIO = "GENERATE_AUDIO";
export const GENERATE_AND_SAVE_AUDIO = "GENERATE_AND_SAVE_AUDIO";
export const GENERATE_AND_SAVE_ALL_AUDIO = "GENERATE_AND_SAVE_ALL_AUDIO";
export const IMPORT_FROM_FILE = "IMPORT_FROM_FILE";
export const PLAY_AUDIO = "PLAY_AUDIO";
export const STOP_AUDIO = "STOP_AUDIO";
export const SET_AUDIO_NOW_PLAYING = "SET_AUDIO_NOW_PLAYING";
export const SET_AUDIO_NOW_GENERATING = "SET_AUDIO_NOW_GENERATING";
export const PLAY_CONTINUOUSLY_AUDIO = "PLAY_CONTINUOUSLY_AUDIO";
export const STOP_CONTINUOUSLY_AUDIO = "STOP_CONTINUOUSLY_AUDIO";
export const SET_NOW_PLAYING_CONTINUOUSLY = "SET_NOW_PLAYING_CONTINUOUSLY";
export const PUT_TEXTS = "PUT_TEXTS";
export const OPEN_TEXT_EDIT_CONTEXT_MENU = "OPEN_TEXT_EDIT_CONTEXT_MENU";
export const DETECTED_ENGINE_ERROR = "DETECTED_ENGINE_ERROR";
export const RESTART_ENGINE = "RESTART_ENGINE";
export const SET_IS_SAVE_ALL = "SET_IS_SAVE_ALL";

const audioBlobCache: Record<string, Blob> = {};
const audioElements: Record<string, HTMLAudioElement> = {};

export const audioStore = {
  getters: {
    [ACTIVE_AUDIO_KEY](state) {
      return state._activeAudioKey !== undefined &&
        state.audioKeys.includes(state._activeAudioKey)
        ? state._activeAudioKey
        : undefined;
    },
    [HAVE_AUDIO_QUERY]: (state) => (audioKey: string) => {
      return state.audioItems[audioKey]?.query != undefined;
    },
    [IS_ACTIVE]: (state) => (audioKey: string) => {
      return state._activeAudioKey === audioKey;
    },
  },

  mutations: {
    [SET_ENGINE_STATE](state, { engineState }: { engineState: EngineState }) {
      state.engineState = engineState;
    },
    [SET_CHARACTER_INFOS](
      state,
      { characterInfos }: { characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos = characterInfos;
    },
    [SET_ACTIVE_AUDIO_KEY](state, { audioKey }: { audioKey?: string }) {
      state._activeAudioKey = audioKey;
    },
    [SET_AUDIO_NOW_PLAYING](
      state,
      { audioKey, nowPlaying }: { audioKey: string; nowPlaying: boolean }
    ) {
      state.audioStates[audioKey].nowPlaying = nowPlaying;
    },
    [SET_AUDIO_NOW_GENERATING](
      state,
      { audioKey, nowGenerating }: { audioKey: string; nowGenerating: boolean }
    ) {
      state.audioStates[audioKey].nowGenerating = nowGenerating;
    },
    [SET_NOW_PLAYING_CONTINUOUSLY](
      state,
      { nowPlaying }: { nowPlaying: boolean }
    ) {
      state.nowPlayingContinuously = nowPlaying;
    },
    [SET_IS_SAVE_ALL](state, { isSaveAll }: { isSaveAll: boolean }) {
      state.isSaveAll = isSaveAll;
    },
  },

  actions: {
    [START_WAITING_ENGINE]: createUILockAction(async ({ state, commit }, _) => {
      let engineState = state.engineState;
      for (let i = 0; i < 100; i++) {
        engineState = state.engineState;
        if (engineState === "FAILED_STARTING") {
          break;
        }

        try {
          await api.versionVersionGet();
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("waiting engine...");
          continue;
        }
        engineState = "READY";
        commit(SET_ENGINE_STATE, { engineState });
        break;
      }

      if (engineState !== "READY") {
        commit(SET_ENGINE_STATE, { engineState: "FAILED_STARTING" });
      }
    }),
    [LOAD_CHARACTER]: createUILockAction(async ({ commit }) => {
      const characterInfos = await window.electron.getCharacterInfos();

      await Promise.all(
        characterInfos.map(async (characterInfo) => {
          const [iconBuf, portraitBuf] = await Promise.all([
            window.electron.readFile({ filePath: characterInfo.iconPath }),
            window.electron.readFile({ filePath: characterInfo.portraitPath }),
          ]);
          characterInfo.iconBlob = new Blob([iconBuf]);
          characterInfo.portraitBlob = new Blob([portraitBuf]);
        })
      );

      commit(SET_CHARACTER_INFOS, { characterInfos });
    }),
    [SET_AUDIO_TEXT]: createCommandAction(
      (draft, { audioKey, text }: { audioKey: string; text: string }) => {
        draft.audioItems[audioKey].text = text;
      }
    ),
    [SET_AUDIO_CHARACTER_INDEX]: createCommandAction<
      State,
      { audioKey: string; characterIndex: number }
    >((draft, { audioKey, characterIndex }) => {
      draft.audioItems[audioKey].characterIndex = characterIndex;
    }),
    async [CHANGE_CHARACTER_INDEX](
      { getters, dispatch },
      { audioKey, characterIndex }: { audioKey: string; characterIndex: number }
    ) {
      const haveAudioQuery = getters[HAVE_AUDIO_QUERY](audioKey);
      await dispatch(SET_AUDIO_CHARACTER_INDEX, { audioKey, characterIndex });
      if (haveAudioQuery) {
        return dispatch(FETCH_MORA_PITCH, { audioKey });
      }
    },
    [INSERT_AUDIO_ITEM]: createCommandAction(
      (
        draft,
        {
          audioItem,
          audioKey,
          index,
        }: { audioItem: AudioItem; audioKey: string; index: number }
      ) => {
        draft.audioKeys.splice(index, 0, audioKey);
        draft.audioItems[audioKey] = audioItem;
        draft.audioStates[audioKey] = {
          nowPlaying: false,
          nowGenerating: false,
        };
      }
    ),
    [REMOVE_AUDIO_ITEM]: createCommandAction(
      (draft, { audioKey }: { audioKey: string }) => {
        draft.audioKeys.splice(draft.audioKeys.indexOf(audioKey), 1);
        delete draft.audioItems[audioKey];
        delete draft.audioStates[audioKey];
      }
    ),
    [REMOVE_ALL_AUDIO_ITEM]: createCommandAction((draft) => {
      for (const audioKey of draft.audioKeys) {
        delete draft.audioItems[audioKey];
        delete draft.audioStates[audioKey];
      }
      draft.audioKeys.splice(0, draft.audioKeys.length);
    }),
    [REGISTER_AUDIO_ITEM](
      { state, dispatch },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey: string | undefined }
    ) {
      const audioKey = uuidv4();
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      dispatch(INSERT_AUDIO_ITEM, { audioItem, audioKey, index });
      audioElements[audioKey] = new Audio();
      return audioKey;
    },
    [SET_ACTIVE_AUDIO_KEY]({ commit }, { audioKey }: { audioKey?: string }) {
      commit(SET_ACTIVE_AUDIO_KEY, { audioKey });
    },
    async [GET_AUDIO_CACHE]({ state }, { audioKey }: { audioKey: string }) {
      const audioItem = state.audioItems[audioKey];
      const id = await generateUniqueId(audioItem);

      if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
        return audioBlobCache[id];
      } else {
        return null;
      }
    },
    [SET_ACCENT_PHRASES]: createCommandAction(
      (
        draft,
        {
          audioKey,
          accentPhrases,
        }: { audioKey: string; accentPhrases: AccentPhrase[] }
      ) => {
        draft.audioItems[audioKey].query!.accentPhrases = accentPhrases;
      }
    ),
    [SET_AUDIO_QUERY]: createCommandAction(
      (
        draft,
        { audioKey, audioQuery }: { audioKey: string; audioQuery: AudioQuery }
      ) => {
        draft.audioItems[audioKey].query = audioQuery;
      }
    ),
    [FETCH_ACCENT_PHRASES]: (
      { state, dispatch },
      { audioKey }: { audioKey: string }
    ) => {
      const audioItem = state.audioItems[audioKey];

      return api
        .accentPhrasesAccentPhrasesPost({
          text: audioItem.text,
          speaker:
            state.characterInfos![audioItem.characterIndex!].metas.speaker,
        })
        .then((accentPhrases) =>
          dispatch(SET_ACCENT_PHRASES, { audioKey, accentPhrases })
        );
    },
    [FETCH_MORA_PITCH](
      { state, dispatch },
      { audioKey }: { audioKey: string }
    ) {
      const audioItem = state.audioItems[audioKey];

      return api
        .moraPitchMoraPitchPost({
          accentPhrase: audioItem.query!.accentPhrases,
          speaker:
            state.characterInfos![audioItem.characterIndex!].metas.speaker,
        })
        .then((accentPhrases) =>
          dispatch(SET_ACCENT_PHRASES, { audioKey, accentPhrases })
        );
    },
    [FETCH_AUDIO_QUERY]: (
      { state, dispatch },
      { audioKey }: { audioKey: string }
    ) => {
      const audioItem = state.audioItems[audioKey];

      return api
        .audioQueryAudioQueryPost({
          text: audioItem.text,
          speaker:
            state.characterInfos![audioItem.characterIndex!].metas.speaker,
        })
        .then((audioQuery) =>
          dispatch(SET_AUDIO_QUERY, { audioKey, audioQuery })
        );
    },
    [SET_AUDIO_SPEED_SCALE]: createCommandAction(
      (
        draft,
        { audioKey, speedScale }: { audioKey: string; speedScale: number }
      ) => {
        draft.audioItems[audioKey].query!.speedScale = speedScale;
      }
    ),
    [SET_AUDIO_PITCH_SCALE]: createCommandAction<
      State,
      { audioKey: string; pitchScale: number }
    >((draft, { audioKey, pitchScale }) => {
      draft.audioItems[audioKey].query!.pitchScale = pitchScale;
    }),
    [SET_AUDIO_INTONATION_SCALE]: createCommandAction<
      State,
      { audioKey: string; intonationScale: number }
    >((draft, { audioKey, intonationScale }) => {
      draft.audioItems[audioKey].query!.intonationScale = intonationScale;
    }),
    [SET_AUDIO_VOLUME_SCALE]: createCommandAction<
      State,
      { audioKey: string; volumeScale: number }
    >((draft, { audioKey, volumeScale }) => {
      draft.audioItems[audioKey].query!.volumeScale = volumeScale;
    }),
    [SET_AUDIO_ACCENT]: createCommandAction<
      State,
      {
        audioKey: string;
        accentPhraseIndex: number;
        accent: number;
      }
    >((draft, { audioKey, accentPhraseIndex, accent }) => {
      draft.audioItems[audioKey].query!.accentPhrases[
        accentPhraseIndex
      ].accent = accent;
    }),
    async [CHANGE_ACCENT](
      { dispatch },
      {
        audioKey,
        accentPhraseIndex,
        accent,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        accent: number;
      }
    ) {
      await dispatch(SET_AUDIO_ACCENT, { audioKey, accentPhraseIndex, accent });
      return dispatch(FETCH_MORA_PITCH, { audioKey });
    },
    [TOGGLE_ACCENT_PHRASE_SPLIT]: createCommandAction<
      State,
      {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number | null;
        isPause: boolean;
      }
    >((draft, { audioKey, accentPhraseIndex, moraIndex, isPause }) => {
      const query = draft.audioItems[audioKey].query!;
      if (
        moraIndex === query.accentPhrases[accentPhraseIndex].moras.length - 1 ||
        isPause
      ) {
        // merge
        const newAccentPhrase: AccentPhrase = {
          moras: [
            ...query.accentPhrases[accentPhraseIndex].moras,
            ...query.accentPhrases[accentPhraseIndex + 1].moras,
          ],
          accent: query.accentPhrases[accentPhraseIndex].accent,
          pauseMora: query.accentPhrases[accentPhraseIndex + 1].pauseMora,
        };
        query.accentPhrases.splice(accentPhraseIndex, 2, newAccentPhrase);
      } else {
        // split
        if (moraIndex === null) {
          return;
        }
        const newAccentPhrase1: AccentPhrase = {
          moras: query.accentPhrases[accentPhraseIndex].moras.slice(
            0,
            moraIndex + 1
          ),
          accent:
            query.accentPhrases[accentPhraseIndex].accent > moraIndex
              ? moraIndex + 1
              : query.accentPhrases[accentPhraseIndex].accent,
          pauseMora: undefined,
        };
        const newAccentPhrase2: AccentPhrase = {
          moras: query.accentPhrases[accentPhraseIndex].moras.slice(
            moraIndex + 1
          ),
          accent:
            query.accentPhrases[accentPhraseIndex].accent > moraIndex + 1
              ? query.accentPhrases[accentPhraseIndex].accent - moraIndex - 1
              : 1,
          pauseMora: query.accentPhrases[accentPhraseIndex].pauseMora,
        };
        query.accentPhrases.splice(
          accentPhraseIndex,
          1,
          newAccentPhrase1,
          newAccentPhrase2
        );
      }
    }),
    async [CHANGE_ACCENT_PHRASE_SPLIT](
      { dispatch },
      {
        audioKey,
        accentPhraseIndex,
        moraIndex,
        isPause,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number | null;
        isPause: boolean;
      }
    ) {
      await dispatch(TOGGLE_ACCENT_PHRASE_SPLIT, {
        audioKey,
        accentPhraseIndex,
        moraIndex,
        isPause,
      });
      return dispatch(FETCH_MORA_PITCH, { audioKey });
    },
    [SET_AUDIO_MORA_PITCH]: createCommandAction<
      State,
      {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        pitch: number;
      }
    >((draft, { audioKey, accentPhraseIndex, moraIndex, pitch }) => {
      const query = draft.audioItems[audioKey].query!;
      query.accentPhrases[accentPhraseIndex].moras[moraIndex].pitch = pitch;
    }),
    [GENERATE_AUDIO]: createUILockAction(
      async ({ state }, { audioKey }: { audioKey: string }) => {
        const audioItem = state.audioItems[audioKey];
        const id = await generateUniqueId(audioItem);

        return api
          .synthesisSynthesisPost({
            audioQuery: audioItem.query!,
            speaker:
              state.characterInfos![audioItem.characterIndex!].metas.speaker,
          })
          .then(async (blob) => {
            audioBlobCache[id] = blob;
            return blob;
          })
          .catch((e) => {
            window.electron.logError(e);
            return null;
          });
      }
    ),
    [GENERATE_AND_SAVE_AUDIO]: createUILockAction(
      async (
        { state, dispatch },
        {
          audioKey,
          filePath,
          encoding,
        }: {
          audioKey: string;
          filePath?: string;
          encoding?: EncodingType;
        }
      ) => {
        const blobPromise: Promise<Blob> = dispatch(GENERATE_AUDIO, {
          audioKey,
        });
        filePath ??= await window.electron.showAudioSaveDialog({
          title: "Save",
          defaultPath: buildFileName(state, audioKey),
        });
        const blob = await blobPromise;
        if (!blob) {
          throw ["ENGINE_ERROR", filePath];
        }

        if (filePath) {
          try {
            window.electron.writeFile({
              filePath,
              buffer: await blob.arrayBuffer(),
            });
          } catch (e) {
            window.electron.logError(e);

            throw ["WRITE_ERROR", filePath];
          }

          const textBlob = ((): Blob => {
            if (!encoding || encoding === "UTF-8") {
              const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
              return new Blob([bom, state.audioItems[audioKey].text], {
                type: "text/plain;charset=UTF-8",
              });
            }
            const sjisArray = Encoding.convert(
              Encoding.stringToCode(state.audioItems[audioKey].text),
              { to: "SJIS", type: "arraybuffer" }
            );
            return new Blob([new Uint8Array(sjisArray)], {
              type: "text/plain;charset=Shift_JIS",
            });
          })();

          try {
            window.electron.writeFile({
              filePath: filePath.replace(/\.wav$/, ".txt"),
              buffer: await textBlob.arrayBuffer(),
            });

            return ["SUCCESS", filePath];
          } catch (e) {
            window.electron.logError(e);

            throw ["WRITE_ERROR", filePath];
          }
        }
      }
    ),
    [GENERATE_AND_SAVE_ALL_AUDIO]: createUILockAction(
      async (
        { state, dispatch, commit },
        { dirPath, encoding }: { dirPath?: string; encoding: EncodingType }
      ) => {
        dirPath ??= await window.electron.showOpenDirectoryDialog({
          title: "Save ALL",
        });
        if (dirPath) {
          await commit(SET_IS_SAVE_ALL, { isSaveAll: true });
          const promises = state.audioKeys.map((audioKey, index) => {
            const name = buildFileName(state, audioKey);
            return dispatch(GENERATE_AND_SAVE_AUDIO, {
              audioKey,
              filePath: path.join(dirPath!, name),
              encoding,
            });
          });
          return Promise.all(promises).finally(() =>
            commit(SET_IS_SAVE_ALL, { isSaveAll: false })
          );
        }
      }
    ),
    [IMPORT_FROM_FILE]: createUILockAction(
      async ({ state, dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "セリフ読み込み",
          });
          if (!filePath) return;
        }
        let body = new TextDecoder("utf-8").decode(
          await window.electron.readFile({ filePath })
        );
        if (body.indexOf("\ufffd") > -1) {
          body = new TextDecoder("shift-jis").decode(
            await window.electron.readFile({ filePath })
          );
        }
        const audioItems = parseTextFile(body, state.characterInfos);
        return Promise.all(
          audioItems.map((item) =>
            dispatch(REGISTER_AUDIO_ITEM, { audioItem: item })
          )
        );
      }
    ),
    [PLAY_AUDIO]: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: string }) => {
        const audioElem = audioElements[audioKey];
        audioElem.pause();

        // 音声用意
        let blob = await dispatch(GET_AUDIO_CACHE, { audioKey });
        if (!blob) {
          commit(SET_AUDIO_NOW_GENERATING, { audioKey, nowGenerating: true });
          blob = await dispatch(GENERATE_AUDIO, { audioKey });
          commit(SET_AUDIO_NOW_GENERATING, {
            audioKey,
            nowGenerating: false,
          });
          if (!blob) {
            return false;
          }
        }
        audioElem.src = URL.createObjectURL(blob);

        // 再生終了時にresolveされるPromiseを返す
        const played = async () => {
          commit(SET_AUDIO_NOW_PLAYING, { audioKey, nowPlaying: true });
        };
        audioElem.addEventListener("play", played);

        let paused: () => void;
        const audioPlayPromise = new Promise<boolean>((resolve) => {
          paused = () => {
            resolve(audioElem.ended);
          };
          audioElem.addEventListener("pause", paused);
        }).finally(async () => {
          audioElem.removeEventListener("play", played);
          audioElem.removeEventListener("pause", paused);
          commit(SET_AUDIO_NOW_PLAYING, { audioKey, nowPlaying: false });
        });

        audioElem.play();
        return audioPlayPromise;
      }
    ),
    [STOP_AUDIO](_, { audioKey }: { audioKey: string }) {
      const audioElem = audioElements[audioKey];
      audioElem.pause();
    },
    [PLAY_CONTINUOUSLY_AUDIO]: createUILockAction(
      async ({ state, commit, dispatch }) => {
        const currentAudioKey = state._activeAudioKey;
        commit(SET_NOW_PLAYING_CONTINUOUSLY, { nowPlaying: true });
        try {
          for (const audioKey of state.audioKeys) {
            commit(SET_ACTIVE_AUDIO_KEY, { audioKey });
            const isEnded = await dispatch(PLAY_AUDIO, { audioKey });
            if (!isEnded) {
              return false;
            }
          }

          return true;
        } finally {
          commit(SET_ACTIVE_AUDIO_KEY, { audioKey: currentAudioKey });
          commit(SET_NOW_PLAYING_CONTINUOUSLY, { nowPlaying: false });
        }
      }
    ),
    [STOP_CONTINUOUSLY_AUDIO]({ state, dispatch }) {
      for (const audioKey of state.audioKeys) {
        if (state.audioStates[audioKey].nowPlaying) {
          dispatch(STOP_AUDIO, { audioKey });
        }
      }
    },
    [PUT_TEXTS]: createUILockAction(
      async (
        { dispatch },
        {
          texts,
          characterIndex,
          prevAudioKey,
        }: {
          texts: string[];
          characterIndex: number | undefined;
          prevAudioKey: string | undefined;
        }
      ) => {
        const arrLen = texts.length;
        characterIndex == undefined ? 0 : characterIndex;
        const addedAudioKeys = [];
        for (let i = 0; i < arrLen; i++) {
          if (texts[i] != "") {
            const audioItem = {
              text: texts[i],
              characterIndex: characterIndex,
            };
            prevAudioKey = await dispatch(REGISTER_AUDIO_ITEM, {
              audioItem: audioItem,
              prevAudioKey: prevAudioKey,
            });
            addedAudioKeys.push(prevAudioKey);
          }
        }

        return Promise.all(
          addedAudioKeys.map((audioKey) =>
            dispatch(FETCH_AUDIO_QUERY, { audioKey })
          )
        );
      }
    ),
    [OPEN_TEXT_EDIT_CONTEXT_MENU]() {
      window.electron.openTextEditContextMenu();
    },
    [DETECTED_ENGINE_ERROR]({ state, commit }) {
      switch (state.engineState) {
        case "STARTING":
          commit(SET_ENGINE_STATE, { engineState: "FAILED_STARTING" });
          break;
        case "READY":
          commit(SET_ENGINE_STATE, { engineState: "ERROR" });
          break;
        default:
          commit(SET_ENGINE_STATE, { engineState: "ERROR" });
      }
    },
    async [RESTART_ENGINE]({ commit }) {
      await commit(SET_ENGINE_STATE, { engineState: "STARTING" });
      window.electron.restartEngine();
    },
  },
} as StoreOptions<State>;
