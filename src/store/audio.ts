import { AudioQuery, AccentPhrase, Configuration, DefaultApi } from "@/openapi";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  AudioItem,
  State,
  EngineState,
  SaveResultObject,
  typeAsStoreOptions,
  commandMutationsCreator,
} from "./type";
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

function toggleAccentPhrase(
  accentPhrases: AccentPhrase[],
  {
    accentPhraseIndex,
    moraIndex,
    isPause,
  }: {
    accentPhraseIndex: number;
    moraIndex: number | null;
    isPause: boolean;
  }
) {
  if (
    moraIndex === accentPhrases[accentPhraseIndex].moras.length - 1 ||
    isPause
  ) {
    // merge
    const newAccentPhrase: AccentPhrase = {
      moras: [
        ...accentPhrases[accentPhraseIndex].moras,
        ...accentPhrases[accentPhraseIndex + 1].moras,
      ],
      accent: accentPhrases[accentPhraseIndex].accent,
      pauseMora: accentPhrases[accentPhraseIndex + 1].pauseMora,
    };
    accentPhrases.splice(accentPhraseIndex, 2, newAccentPhrase);
  } else {
    // split
    if (moraIndex === null) {
      return;
    }
    const newAccentPhrase1: AccentPhrase = {
      moras: accentPhrases[accentPhraseIndex].moras.slice(0, moraIndex + 1),
      accent:
        accentPhrases[accentPhraseIndex].accent > moraIndex
          ? moraIndex + 1
          : accentPhrases[accentPhraseIndex].accent,
      pauseMora: undefined,
    };
    const newAccentPhrase2: AccentPhrase = {
      moras: accentPhrases[accentPhraseIndex].moras.slice(moraIndex + 1),
      accent:
        accentPhrases[accentPhraseIndex].accent > moraIndex + 1
          ? accentPhrases[accentPhraseIndex].accent - moraIndex - 1
          : 1,
      pauseMora: accentPhrases[accentPhraseIndex].pauseMora,
    };
    accentPhrases.splice(
      accentPhraseIndex,
      1,
      newAccentPhrase1,
      newAccentPhrase2
    );
  }
}

const audioBlobCache: Record<string, Blob> = {};
const audioElements: Record<string, HTMLAudioElement> = {};

// getters
export const ACTIVE_AUDIO_KEY = "ACTIVE_AUDIO_KEY";
export const HAVE_AUDIO_QUERY = "HAVE_AUDIO_QUERY";
export const IS_ACTIVE = "IS_ACTIVE";
export const IS_ENGINE_READY = "IS_ENGINE_READY";

//mutations (and actions)
const INSERT_AUDIO_ITEM = "INSERT_AUDIO_ITEM";
const REMOVE_AUDIO_ITEM = "REMOVE_AUDIO_ITEM";
const SET_AUDIO_CHARACTER_INDEX = "SET_AUDIO_CHARACTER_INDEX";
const SET_AUDIO_TEXT = "SET_AUDIO_TEXT";
const SET_AUDIO_QUERY = "SET_AUDIO_QUERY";
const SET_ACCENT_PHRASES = "SET_ACCENT_PHRASES";
const SET_AUDIO_SPEED_SCALE = "SET_AUDIO_SPEED_SCALE";
const SET_AUDIO_PITCH_SCALE = "SET_AUDIO_PITCH_SCALE";
const SET_AUDIO_INTONATION_SCALE = "SET_AUDIO_INTONATION_SCALE";
const SET_AUDIO_VOLUME_SCALE = "SET_AUDIO_VOLUME_SCALE";
const SET_AUDIO_ACCENT = "SET_AUDIO_ACCENT";
const TOGGLE_ACCENT_PHRASE_SPLIT = "TOGGLE_ACCENT_PHRASE_SPLIT";
const SET_AUDIO_MORA_DATA = "SET_AUDIO_MORA_DATA";

const SET_ENGINE_STATE = "SET_ENGINE_STATE";
const SET_CHARACTER_INFOS = "SET_CHARACTER_INFOS";
const SET_AUDIO_NOW_GENERATING = "SET_AUDIO_NOW_GENERATING";
const SET_AUDIO_NOW_PLAYING = "SET_AUDIO_NOW_PLAYING";
const SET_NOW_PLAYING_CONTINUOUSLY = "SET_NOW_PLAYING_CONTINUOUSLY";
//mutaion & actions
export const SET_ACTIVE_AUDIO_KEY = "SET_ACTIVE_AUDIO_KEY";

//actions
export const START_WAITING_ENGINE = "START_WAITING_ENGINE";
export const DETECTED_ENGINE_ERROR = "DETECTED_ENGINE_ERROR";
export const RESTART_ENGINE = "RESTART_ENGINE";
export const LOAD_CHARACTER = "LOAD_CHARACTER";
export const ISSUE_AUDIO_KEY = "ISSUE_AUDIO_KEY";
export const DISPOSE_AUDIO_KEY = "DISPOSE_AUDIO_KEY";
export const REGISTER_AUDIO_ITEM = "REGISTER_AUDIO_ITEM";
export const UNREGISER_AUDIO_ITEM = "UNREGISER_AUDIO_ITEM";
export const GENERATE_INITIAL_AUDIO_ITEM = "GENERATE_INITIAL_AUDIO_ITEM";
export const FETCH_ACCENT_PHRASES = "FETCH_ACCENT_PHRASES";
export const FETCH_MORA_DATA = "FETCH_MORA_DATA";
export const FETCH_AUDIO_QUERY = "FETCH_AUDIO_QUERY";
export const GET_AUDIO_CACHE = "GET_AUDIO_CACHE";
export const GENERATE_AUDIO = "GENERATE_AUDIO";
export const GENERATE_AND_SAVE_AUDIO = "GENERATE_AND_SAVE_AUDIO";
export const GENERATE_AND_SAVE_ALL_AUDIO = "GENERATE_AND_SAVE_ALL_AUDIO";
export const PLAY_AUDIO = "PLAY_AUDIO";
export const STOP_AUDIO = "STOP_AUDIO";
export const PLAY_CONTINUOUSLY_AUDIO = "PLAY_CONTINUOUSLY_AUDIO";
export const STOP_CONTINUOUSLY_AUDIO = "STOP_CONTINUOUSLY_AUDIO";
export const OPEN_TEXT_EDIT_CONTEXT_MENU = "OPEN_TEXT_EDIT_CONTEXT_MENU";
export const CHECK_FILE_EXISTS = "CHECK_FILE_EXISTS";

export const audioStore = typeAsStoreOptions({
  getters: {
    [ACTIVE_AUDIO_KEY](state) {
      return state._activeAudioKey !== undefined &&
        state.audioKeys.includes(state._activeAudioKey)
        ? state._activeAudioKey
        : undefined;
    },
    [HAVE_AUDIO_QUERY]: (state) => (audioKey: string) => {
      return state.audioItems[audioKey]?.query !== undefined;
    },
    [IS_ACTIVE]: (state) => (audioKey: string) => {
      return state._activeAudioKey === audioKey;
    },
    [IS_ENGINE_READY]: (state) => () => {
      return state.engineState == "READY";
    },
  },

  mutations: {
    [INSERT_AUDIO_ITEM]: (
      state,
      {
        audioItem,
        audioKey,
        index,
      }: { audioItem: AudioItem; audioKey: string; index: number }
    ) => {
      state.audioKeys.splice(index, 0, audioKey);
      state.audioItems[audioKey] = audioItem;
      state.audioStates[audioKey] = {
        nowPlaying: false,
        nowGenerating: false,
      };
    },
    [REMOVE_AUDIO_ITEM]: (state, { audioKey }: { audioKey: string }) => {
      state.audioKeys.splice(state.audioKeys.indexOf(audioKey), 1);
      delete state.audioItems[audioKey];
      delete state.audioStates[audioKey];
    },
    [SET_AUDIO_CHARACTER_INDEX]: (
      state,
      { audioKey, characterIndex }: { audioKey: string; characterIndex: number }
    ) => {
      state.audioItems[audioKey].characterIndex = characterIndex;
    },
    [SET_AUDIO_TEXT]: (
      state,
      { audioKey, text }: { audioKey: string; text: string }
    ) => {
      state.audioItems[audioKey].text = text;
    },
    [SET_AUDIO_QUERY]: (
      state,
      { audioKey, audioQuery }: { audioKey: string; audioQuery: AudioQuery }
    ) => {
      state.audioItems[audioKey].query = audioQuery;
    },
    [SET_ACCENT_PHRASES]: (
      state,
      {
        audioKey,
        accentPhrases,
      }: { audioKey: string; accentPhrases: AccentPhrase[] }
    ) => {
      state.audioItems[audioKey].query!.accentPhrases = accentPhrases;
    },
    [SET_AUDIO_SPEED_SCALE]: (
      state,
      { audioKey, speedScale }: { audioKey: string; speedScale: number }
    ) => {
      state.audioItems[audioKey].query!.speedScale = speedScale;
    },
    [SET_AUDIO_PITCH_SCALE]: (
      state,
      { audioKey, pitchScale }: { audioKey: string; pitchScale: number }
    ) => {
      state.audioItems[audioKey].query!.pitchScale = pitchScale;
    },
    [SET_AUDIO_INTONATION_SCALE]: (
      state,
      {
        audioKey,
        intonationScale,
      }: { audioKey: string; intonationScale: number }
    ) => {
      state.audioItems[audioKey].query!.intonationScale = intonationScale;
    },
    [SET_AUDIO_VOLUME_SCALE]: (
      state,
      { audioKey, volumeScale }: { audioKey: string; volumeScale: number }
    ) => {
      state.audioItems[audioKey].query!.volumeScale = volumeScale;
    },
    [SET_AUDIO_ACCENT]: (
      state,
      {
        audioKey,
        accentPhraseIndex,
        accent,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        accent: number;
      }
    ) => {
      state.audioItems[audioKey].query!.accentPhrases[
        accentPhraseIndex
      ].accent = accent;
    },
    [TOGGLE_ACCENT_PHRASE_SPLIT]: (
      state,
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
    ) => {
      const query = state.audioItems[audioKey].query!;
      toggleAccentPhrase(query.accentPhrases, {
        accentPhraseIndex,
        moraIndex,
        isPause,
      });
    },
    [SET_AUDIO_MORA_DATA]: (
      state,
      {
        audioKey,
        accentPhraseIndex,
        moraIndex,
        consonantLength,
        vowelLength,
        pitch,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        consonantLength: number | undefined;
        vowelLength: number | undefined;
        pitch: number | undefined;
      }
    ) => {
      const query = state.audioItems[audioKey].query!;
      const mora = query.accentPhrases[accentPhraseIndex].moras[moraIndex];
      mora.consonantLength = consonantLength ?? mora.consonantLength;
      mora.vowelLength = vowelLength ?? mora.vowelLength;
      mora.pitch = pitch ?? mora.pitch;
    },
    [SET_ENGINE_STATE](state, { engineState }: { engineState: EngineState }) {
      state.engineState = engineState;
    },
    [SET_CHARACTER_INFOS](
      state,
      { characterInfos }: { characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos = characterInfos;
    },
    [SET_ACTIVE_AUDIO_KEY]: (state, { audioKey }: { audioKey?: string }) => {
      state._activeAudioKey = audioKey;
    },
    [SET_AUDIO_NOW_GENERATING](
      state,
      { audioKey, nowGenerating }: { audioKey: string; nowGenerating: boolean }
    ) {
      state.audioStates[audioKey].nowGenerating = nowGenerating;
    },
    [SET_AUDIO_NOW_PLAYING](
      state,
      { audioKey, nowPlaying }: { audioKey: string; nowPlaying: boolean }
    ) {
      state.audioStates[audioKey].nowPlaying = nowPlaying;
    },
    [SET_NOW_PLAYING_CONTINUOUSLY](
      state,
      { nowPlaying }: { nowPlaying: boolean }
    ) {
      state.nowPlayingContinuously = nowPlaying;
    },
  },

  actions: {
    [START_WAITING_ENGINE]: createUILockAction(async ({ state, commit }) => {
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
    async [RESTART_ENGINE]({ commit, dispatch }) {
      await commit(SET_ENGINE_STATE, { engineState: "STARTING" });
      window.electron
        .restartEngine()
        .then(() => dispatch(START_WAITING_ENGINE))
        .catch(() => dispatch(DETECTED_ENGINE_ERROR));
    },
    [LOAD_CHARACTER]: createUILockAction(async ({ commit }) => {
      const characterInfos = await window.electron.getCharacterInfos();

      await Promise.all(
        characterInfos.map(async (characterInfo) => {
          const [iconBuf, portraitBuf] = await Promise.all([
            window.electron.readFile({ filePath: characterInfo.iconPath }),
            window.electron.readFile({
              filePath: characterInfo.portraitPath,
            }),
          ]);
          characterInfo.iconBlob = new Blob([iconBuf]);
          characterInfo.portraitBlob = new Blob([portraitBuf]);
        })
      );

      commit(SET_CHARACTER_INFOS, { characterInfos });
    }),
    [REGISTER_AUDIO_ITEM]: async (
      { state, dispatch, commit },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey: string | undefined }
    ) => {
      const audioKey = await dispatch(ISSUE_AUDIO_KEY);
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      commit(INSERT_AUDIO_ITEM, { audioItem, audioKey, index });
      return audioKey;
    },
    [UNREGISER_AUDIO_ITEM]: (
      { commit, dispatch },
      { audioKey }: { audioKey: string }
    ) => {
      commit(REMOVE_AUDIO_ITEM, { audioKey });
      dispatch(DISPOSE_AUDIO_KEY, { audioKey });
    },
    [GENERATE_INITIAL_AUDIO_ITEM]: async (
      context,
      {
        text,
        characterIndex,
      }: { text: string | undefined; characterIndex: number | undefined }
    ) => {
      return {
        text: text ?? "",
        characterIndex: characterIndex ?? 0,
        query: undefined,
      };
    },
    [ISSUE_AUDIO_KEY]: () => {
      const audioKey = uuidv4();
      audioElements[audioKey] = new Audio();
      return audioKey;
    },
    [DISPOSE_AUDIO_KEY]: (_, { audioKey }: { audioKey: string }) => {
      delete audioElements[audioKey];
    },
    [FETCH_ACCENT_PHRASES]: (
      { state },
      { text, characterIndex }: { text: string; characterIndex: number }
    ) => {
      return api
        .accentPhrasesAccentPhrasesPost({
          text: text,
          speaker: state.characterInfos![characterIndex].metas.speaker,
        })
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AccentPhrases for the text "${text}".`
          );
          throw error;
        });
    },
    [FETCH_MORA_DATA]: async (
      { state },
      {
        accentPhrases,
        characterIndex,
      }: { accentPhrases: AccentPhrase[]; characterIndex: number }
    ) => {
      if (accentPhrases.length == 0) {
        return [];
      } else {
        return await api
          .moraDataMoraDataPost({
            accentPhrase: accentPhrases,
            speaker: state.characterInfos![characterIndex].metas.speaker,
          })
          .catch((error) => {
            window.electron.logError(
              error,
              `Failed to fetch MoraData for the accentPhrases "${accentPhrases}".`
            );
            throw error;
          });
      }
    },
    [FETCH_AUDIO_QUERY]: (
      { state },
      { text, characterIndex }: { text: string; characterIndex: number }
    ) => {
      return api
        .audioQueryAudioQueryPost({
          text: text,
          speaker: state.characterInfos![characterIndex].metas.speaker,
        })
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch audio query for text "${text}"`
          );
          throw error;
        });
    },
    [GET_AUDIO_CACHE]: async (
      { state },
      { audioKey }: { audioKey: string }
    ) => {
      const audioItem = state.audioItems[audioKey];
      const id = await generateUniqueId(audioItem);

      if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
        return audioBlobCache[id];
      } else {
        return undefined;
      }
    },
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
            return undefined;
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
      ): Promise<SaveResultObject> => {
        const blobPromise: Promise<Blob | undefined> = dispatch(
          GENERATE_AUDIO,
          {
            audioKey,
          }
        );

        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            buildFileName(state, audioKey)
          );
        } else {
          filePath ??= await window.electron.showAudioSaveDialog({
            title: "Save",
            defaultPath: buildFileName(state, audioKey),
          });
        }

        if (!filePath) {
          return { result: "CANCELED", path: "" };
        }

        if (state.savingSetting.avoidOverwrite) {
          let tail = 1;
          const name = filePath.slice(0, filePath.length - 4);
          while (await dispatch(CHECK_FILE_EXISTS, { file: filePath })) {
            filePath = name + "[" + tail.toString() + "]" + ".wav";
            tail += 1;
          }
        }

        const blob = await blobPromise;
        if (!blob) {
          return { result: "ENGINE_ERROR", path: filePath };
        }

        try {
          window.electron.writeFile({
            filePath,
            buffer: await blob.arrayBuffer(),
          });
        } catch (e) {
          window.electron.logError(e);

          return { result: "WRITE_ERROR", path: filePath };
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

          return { result: "SUCCESS", path: filePath };
        } catch (e) {
          window.electron.logError(e);

          return { result: "WRITE_ERROR", path: filePath };
        }
      }
    ),
    [GENERATE_AND_SAVE_ALL_AUDIO]: createUILockAction(
      async (
        { state, dispatch },
        { dirPath, encoding }: { dirPath?: string; encoding: EncodingType }
      ) => {
        if (state.savingSetting.fixedExportEnabled) {
          dirPath = state.savingSetting.fixedExportDir;
        } else {
          dirPath ??= await window.electron.showOpenDirectoryDialog({
            title: "Save ALL",
          });
        }
        if (dirPath) {
          const promises = state.audioKeys.map((audioKey) => {
            const name = buildFileName(state, audioKey);
            return dispatch(GENERATE_AND_SAVE_AUDIO, {
              audioKey,
              filePath: path.join(dirPath!, name),
              encoding,
            });
          });
          return Promise.all(promises);
        }
      }
    ),
    [PLAY_AUDIO]: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: string }) => {
        const audioElem = audioElements[audioKey];
        audioElem.pause();

        // 音声用意
        let blob: Blob | undefined = await dispatch(GET_AUDIO_CACHE, {
          audioKey,
        });
        if (!blob) {
          commit(SET_AUDIO_NOW_GENERATING, { audioKey, nowGenerating: true });
          blob = await dispatch(GENERATE_AUDIO, { audioKey });
          commit(SET_AUDIO_NOW_GENERATING, {
            audioKey,
            nowGenerating: false,
          });
          if (!blob) {
            throw new Error();
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
    [STOP_AUDIO]: (_, { audioKey }: { audioKey: string }) => {
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
              break;
            }
          }
        } finally {
          commit(SET_ACTIVE_AUDIO_KEY, { audioKey: currentAudioKey });
          commit(SET_NOW_PLAYING_CONTINUOUSLY, { nowPlaying: false });
        }
      }
    ),
    [STOP_CONTINUOUSLY_AUDIO]: ({ state, dispatch }) => {
      for (const audioKey of state.audioKeys) {
        if (state.audioStates[audioKey].nowPlaying) {
          dispatch(STOP_AUDIO, { audioKey });
        }
      }
    },
    [OPEN_TEXT_EDIT_CONTEXT_MENU]: () => {
      window.electron.openTextEditContextMenu();
    },

    [SET_ACTIVE_AUDIO_KEY]: (
      { commit },
      { audioKey }: { audioKey?: string }
    ) => {
      commit(SET_ACTIVE_AUDIO_KEY, { audioKey });
    },
    [CHECK_FILE_EXISTS]({ commit }, { file }: { file: string }) {
      return window.electron.checkFileExists(file);
    },
  },
} as const);

//commands
export const COMMAND_REGISTER_AUDIO_ITEM = "COMMAND_REGISTER_AUDIO_ITEM";
export const COMMAND_UNREGISTER_AUDIO_ITEM = "COMMAND_UNREGISTER_AUDIO_ITEM";
export const COMMAND_UPDATE_AUDIO_TEXT = "COMMAND_UPDATE_AUDIO_TEXT";
export const COMMAND_CHANGE_CHARACTER_INDEX = "COMMAND_CHANGE_CHARACTER_INDEX";
export const COMMAND_CHANGE_ACCENT = "COMMAND_CHANGE_ACCENT";
export const COMMAND_CHANGE_ACCENT_PHRASE_SPLIT =
  "COMMAND_CHANGE_ACCENT_PHRASE_SPLIT";
export const COMMAND_SET_AUDIO_INTONATION_SCALE =
  "COMMAND_SET_AUDIO_INTONATION_SCALE";
export const COMMAND_SET_AUDIO_PITCH_SCALE = "COMMAND_SET_AUDIO_PITCH_SCALE";
export const COMMAND_SET_AUDIO_SPEED_SCALE = "COMMAND_SET_AUDIO_SPEED_SCALE";
export const COMMAND_SET_AUDIO_VOLUME_SCALE = "COMMAND_SET_AUDIO_VOLUME_SCALE";
export const COMMAND_SET_AUDIO_MORA_DATA = "COMMAND_SET_AUDIO_MORA_DATA";
export const COMMAND_IMPORT_FROM_FILE = "COMMAND_IMPORT_FROM_FILE";
export const COMMAND_PUT_TEXTS = "COMMAND_PUT_TEXTS";

export const audioCommandStore = typeAsStoreOptions({
  actions: {
    [COMMAND_REGISTER_AUDIO_ITEM]: async (
      { state, commit, dispatch },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey: string | undefined }
    ) => {
      const audioKey = await dispatch(ISSUE_AUDIO_KEY);
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      commit(COMMAND_REGISTER_AUDIO_ITEM, { audioItem, audioKey, index });
      return audioKey;
    },
    [COMMAND_UNREGISTER_AUDIO_ITEM]: async (
      { commit },
      { audioKey }: { audioKey: string }
    ) => {
      commit(COMMAND_UNREGISTER_AUDIO_ITEM, { audioKey });
    },
    [COMMAND_UPDATE_AUDIO_TEXT]: async (
      { state, commit, dispatch },
      { audioKey, text }: { audioKey: string; text: string }
    ) => {
      const characterIndex = state.audioItems[audioKey].characterIndex ?? 0;
      const query: AudioQuery | undefined = state.audioItems[audioKey].query;
      if (query !== undefined) {
        const accentPhrases: AccentPhrase[] = await dispatch(
          FETCH_ACCENT_PHRASES,
          {
            text: text,
            characterIndex: characterIndex,
          }
        ).catch((err) => {
          return [];
        });
        commit(COMMAND_UPDATE_AUDIO_TEXT, {
          audioKey,
          text,
          haveAudioQuery: true,
          accentPhrases,
        });
      } else {
        const newAudioQuery = await dispatch(FETCH_AUDIO_QUERY, {
          text,
          characterIndex,
        }).catch((err) => {
          return undefined;
        });
        commit(COMMAND_UPDATE_AUDIO_TEXT, {
          audioKey,
          text,
          haveAudioQuery: false,
          query: newAudioQuery,
        });
      }
    },
    [COMMAND_CHANGE_CHARACTER_INDEX]: async (
      { state, dispatch, commit },
      { audioKey, characterIndex }: { audioKey: string; characterIndex: number }
    ) => {
      const query = state.audioItems[audioKey].query;
      if (query !== undefined) {
        const accentPhrases = query.accentPhrases;
        const newAccentPhrases: AccentPhrase[] = await dispatch(
          FETCH_MORA_DATA,
          {
            accentPhrases,
            characterIndex,
          }
        ).catch((err) => {
          return accentPhrases;
        });
        commit(COMMAND_CHANGE_CHARACTER_INDEX, {
          characterIndex: characterIndex,
          audioKey: audioKey,
          haveAudioQuery: true,
          accentPhrases: newAccentPhrases,
        });
      } else {
        const text = state.audioItems[audioKey].text;
        const query: AudioQuery | undefined = await dispatch(
          FETCH_AUDIO_QUERY,
          {
            text: text,
            characterIndex: characterIndex,
          }
        ).catch((err) => {
          return undefined;
        });
        commit(COMMAND_CHANGE_CHARACTER_INDEX, {
          characterIndex,
          audioKey,
          haveAudioQuery: false,
          query,
        });
      }
    },
    [COMMAND_CHANGE_ACCENT]: async (
      { state, dispatch, commit },
      {
        audioKey,
        accentPhraseIndex,
        accent,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        accent: number;
      }
    ) => {
      const query = state.audioItems[audioKey].query;
      if (query !== undefined) {
        const newAccentPhrases: AccentPhrase[] = JSON.parse(
          JSON.stringify(query.accentPhrases)
        );
        newAccentPhrases[accentPhraseIndex].accent = accent;

        const characterIndex: number =
          state.audioItems[audioKey].characterIndex ?? 0;
        const resultAccentPhrases: AccentPhrase[] = await dispatch(
          FETCH_MORA_DATA,
          { accentPhrases: newAccentPhrases, characterIndex }
        ).catch((err) => {
          return newAccentPhrases;
        });
        commit(COMMAND_CHANGE_ACCENT, {
          audioKey,
          accentPhrases: resultAccentPhrases,
        });
      }
    },
    [COMMAND_CHANGE_ACCENT_PHRASE_SPLIT]: async (
      { state, dispatch, commit },
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
    ) => {
      const query: AudioQuery | undefined = state.audioItems[audioKey].query;
      const characterIndex: number =
        state.audioItems[audioKey].characterIndex ?? 0;
      if (query !== undefined) {
        const newAccentPhrases: AccentPhrase[] = JSON.parse(
          JSON.stringify(query.accentPhrases)
        );
        toggleAccentPhrase(newAccentPhrases, {
          accentPhraseIndex,
          moraIndex,
          isPause,
        });
        const resultAccentPhrases = await dispatch(FETCH_MORA_DATA, {
          accentPhrases: newAccentPhrases,
          characterIndex,
        }).catch((err) => {
          return newAccentPhrases;
        });
        commit(COMMAND_CHANGE_ACCENT_PHRASE_SPLIT, {
          audioKey,
          accentPhrases: resultAccentPhrases,
        });
      }
    },
    [COMMAND_SET_AUDIO_INTONATION_SCALE]: (
      { commit },
      payload: { audioKey: string; intonationScale: number }
    ) => {
      commit(COMMAND_SET_AUDIO_INTONATION_SCALE, payload);
    },
    [COMMAND_SET_AUDIO_PITCH_SCALE]: (
      { commit },
      payload: { audioKey: string; pitchScale: number }
    ) => {
      commit(COMMAND_SET_AUDIO_PITCH_SCALE, payload);
    },
    [COMMAND_SET_AUDIO_SPEED_SCALE]: (
      { commit },
      payload: { audioKey: string; speedScale: number }
    ) => {
      commit(COMMAND_SET_AUDIO_SPEED_SCALE, payload);
    },
    [COMMAND_SET_AUDIO_VOLUME_SCALE]: (
      { commit },
      payload: { audioKey: string; volumeScale: number }
    ) => {
      commit(COMMAND_SET_AUDIO_VOLUME_SCALE, payload);
    },
    [COMMAND_SET_AUDIO_MORA_DATA]: (
      { commit },
      payload: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        consonantLength: number | undefined;
        vowelLength: number | undefined;
        pitch: number | undefined;
      }
    ) => {
      commit(COMMAND_SET_AUDIO_MORA_DATA, payload);
    },
    [COMMAND_IMPORT_FROM_FILE]: createUILockAction(
      async (
        { state, dispatch, commit, getters },
        { filePath }: { filePath?: string }
      ) => {
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

        const audioKeys = await Promise.all(
          audioItems.map(
            async () => (await dispatch(ISSUE_AUDIO_KEY)) as string
          )
        );

        const isEngineReady: boolean = getters[IS_ENGINE_READY]();
        for (const audioItem of audioItems) {
          const text: string = audioItem.text;
          const characterIndex: number = audioItem.characterIndex ?? 0;
          const query: AudioQuery | undefined = isEngineReady
            ? await dispatch(FETCH_AUDIO_QUERY, {
                text,
                characterIndex,
              }).catch((err) => {
                return undefined;
              })
            : undefined;
          audioItem.query = query;
        }

        commit(COMMAND_IMPORT_FROM_FILE, { audioItems, audioKeys });
      }
    ),
    [COMMAND_PUT_TEXTS]: createUILockAction(
      async (
        { getters, dispatch, commit },
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
        const partialCharacterIndex: number = characterIndex ?? 0;
        const audioItems: AudioItem[] = texts
          .filter((text) => text != "")
          .map((text) => ({
            text,
            characterIndex: partialCharacterIndex,
          }));
        const audioKeys = await Promise.all(
          audioItems.map(
            async () => (await dispatch(ISSUE_AUDIO_KEY)) as string
          )
        );

        const isEngineReady: boolean = getters[IS_ENGINE_READY]();
        for (const audioItem of audioItems) {
          const text: string = audioItem.text;
          const characterIndex: number = audioItem.characterIndex ?? 0;
          const query: AudioQuery | undefined = isEngineReady
            ? await dispatch(FETCH_AUDIO_QUERY, {
                text,
                characterIndex,
              }).catch((err) => {
                return undefined;
              })
            : undefined;
          audioItem.query = query;
        }
        commit(COMMAND_PUT_TEXTS, { audioItems, audioKeys, prevAudioKey });
      }
    ),
  },
  mutations: commandMutationsCreator({
    [COMMAND_REGISTER_AUDIO_ITEM]: (
      draft,
      payload: { audioItem: AudioItem; audioKey: string; index: number }
    ) => {
      audioStore.mutations[INSERT_AUDIO_ITEM](draft, payload);
    },
    [COMMAND_UNREGISTER_AUDIO_ITEM]: (draft, payload: { audioKey: string }) => {
      audioStore.mutations[REMOVE_AUDIO_ITEM](draft, payload);
    },
    [COMMAND_UPDATE_AUDIO_TEXT]: (
      draft,
      payload: { audioKey: string; text: string } & (
        | {
            haveAudioQuery: true;
            accentPhrases: AccentPhrase[];
          }
        | {
            haveAudioQuery: false;
            query: AudioQuery | undefined;
          }
      )
    ) => {
      audioStore.mutations[SET_AUDIO_TEXT](draft, {
        audioKey: payload.audioKey,
        text: payload.text,
      });
      if (payload.haveAudioQuery) {
        audioStore.mutations[SET_ACCENT_PHRASES](draft, {
          audioKey: payload.audioKey,
          accentPhrases: payload.accentPhrases,
        });
      } else if (payload.query !== undefined) {
        audioStore.mutations[SET_AUDIO_QUERY](draft, {
          audioKey: payload.audioKey,
          audioQuery: payload.query,
        });
      }
    },
    [COMMAND_CHANGE_CHARACTER_INDEX]: (
      draft,
      payload: { characterIndex: number; audioKey: string } & (
        | {
            haveAudioQuery: true;
            accentPhrases: AccentPhrase[];
          }
        | {
            haveAudioQuery: false;
            query: AudioQuery;
          }
      )
    ) => {
      audioStore.mutations[SET_AUDIO_CHARACTER_INDEX](draft, {
        audioKey: payload.audioKey,
        characterIndex: payload.characterIndex,
      });
      if (payload.haveAudioQuery) {
        audioStore.mutations[SET_ACCENT_PHRASES](draft, {
          audioKey: payload.audioKey,
          accentPhrases: payload.accentPhrases,
        });
      } else {
        audioStore.mutations[SET_AUDIO_QUERY](draft, {
          audioKey: payload.audioKey,
          audioQuery: payload.query,
        });
      }
    },
    [COMMAND_CHANGE_ACCENT]: (
      draft,
      {
        audioKey,
        accentPhrases,
      }: {
        audioKey: string;
        accentPhrases: AccentPhrase[];
      }
    ) => {
      audioStore.mutations[SET_ACCENT_PHRASES](draft, {
        audioKey,
        accentPhrases,
      });
    },
    [COMMAND_CHANGE_ACCENT_PHRASE_SPLIT]: (
      draft,
      payload: {
        audioKey: string;
        accentPhrases: AccentPhrase[];
      }
    ) => {
      audioStore.mutations[SET_ACCENT_PHRASES](draft, payload);
    },
    [COMMAND_SET_AUDIO_INTONATION_SCALE]: (
      draft,
      payload: { audioKey: string; intonationScale: number }
    ) => {
      audioStore.mutations[SET_AUDIO_INTONATION_SCALE](draft, payload);
    },
    [COMMAND_SET_AUDIO_PITCH_SCALE]: (
      draft,
      payload: { audioKey: string; pitchScale: number }
    ) => {
      audioStore.mutations[SET_AUDIO_PITCH_SCALE](draft, payload);
    },
    [COMMAND_SET_AUDIO_SPEED_SCALE]: (
      draft,
      payload: { audioKey: string; speedScale: number }
    ) => {
      audioStore.mutations[SET_AUDIO_SPEED_SCALE](draft, payload);
    },
    [COMMAND_SET_AUDIO_VOLUME_SCALE]: (
      draft,
      payload: { audioKey: string; volumeScale: number }
    ) => {
      audioStore.mutations[SET_AUDIO_VOLUME_SCALE](draft, payload);
    },
    [COMMAND_SET_AUDIO_MORA_DATA]: (
      draft,
      payload: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        consonantLength: number | undefined;
        vowelLength: number | undefined;
        pitch: number | undefined;
      }
    ) => {
      audioStore.mutations[SET_AUDIO_MORA_DATA](draft, payload);
    },
    [COMMAND_IMPORT_FROM_FILE]: (
      draft,
      {
        audioItems,
        audioKeys,
      }: { audioItems: AudioItem[]; audioKeys: string[] }
    ) => {
      for (let i = 0; i < audioItems.length; i++)
        audioStore.mutations[INSERT_AUDIO_ITEM](draft, {
          index: draft.audioKeys.length,
          audioItem: audioItems[i],
          audioKey: audioKeys[i],
        });
    },
    [COMMAND_PUT_TEXTS]: (
      draft,
      {
        audioItems,
        audioKeys,
        prevAudioKey,
      }: {
        audioItems: AudioItem[];
        audioKeys: string[];
        prevAudioKey: string | undefined;
      }
    ) => {
      let prevIndex =
        prevAudioKey !== undefined
          ? draft.audioKeys.indexOf(prevAudioKey) + 1
          : draft.audioKeys.length;
      for (let i = 0; i < audioItems.length; i++) {
        audioStore.mutations[INSERT_AUDIO_ITEM](draft, {
          audioItem: audioItems[i],
          audioKey: audioKeys[i],
          index: prevIndex++,
        });
      }
    },
  } as const),
} as const);
