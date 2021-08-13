import { AudioQuery, AccentPhrase, Configuration, DefaultApi } from "@/openapi";
import { StoreOptions } from "vuex";
import path from "path";
import { createCommandAction } from "./command";
import { v4 as uuidv4 } from "uuid";
import { AudioItem, State } from "./type";
import { createUILockAction } from "./ui";
import { CharactorInfo } from "@/type/preload";

const api = new DefaultApi(
  new Configuration({ basePath: process.env.VUE_APP_ENGINE_URL })
);

async function generateUniqueId(audioItem: AudioItem) {
  const data = new TextEncoder().encode(
    JSON.stringify([audioItem.text, audioItem.query, audioItem.charactorIndex])
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

function parseTextFile(
  body: string,
  charactorInfos?: CharactorInfo[]
): AudioItem[] {
  const charactors = new Map(
    charactorInfos?.map((info, index) => [info.metas.name, index])
  );
  if (!charactors.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastCharactorIndex = 0;
  for (const splittedText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const charactorIndex = charactors.get(splittedText);
    if (charactorIndex !== undefined) {
      lastCharactorIndex = charactorIndex;
      continue;
    }

    audioItems.push({ text: splittedText, charactorIndex: lastCharactorIndex });
  }
  return audioItems;
}

function buildFileName(state: State, audioKey: string) {
  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;
  const index = state.audioKeys.indexOf(audioKey);
  const audioItem = state.audioItems[audioKey];
  const character = state.charactorInfos![audioItem.charactorIndex!];
  const characterName = character.metas.name.replace(sanitizer, "");
  let text = audioItem.text.replace(sanitizer, "");
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }
  return (
    (index + 1).toString().padStart(3, "0") + `_${characterName}_${text}.wav`
  );
}

export const SET_ENGINE_READY = "SET_ENGINE_READY";
export const START_WAITING_ENGINE = "START_WAITING_ENGINE";
export const ACTIVE_AUDIO_KEY = "ACTIVE_AUDIO_KEY";
export const SET_ACTIVE_AUDIO_KEY = "SET_ACTIVE_AUDIO_KEY";
export const IS_ACTIVE = "IS_ACTIVE";
export const SET_CHARACTOR_INFOS = "SET_CHARACTOR_INFOS";
export const LOAD_CHARACTOR = "LOAD_CHARACTOR";
export const SET_AUDIO_TEXT = "SET_AUDIO_TEXT";
export const SET_AUDIO_CHARACTOR_INDEX = "SET_AUDIO_CHARACTOR_INDEX";
export const CHANGE_CHARACTOR_INDEX = "CHANGE_CHARACTOR_INDEX";
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
    [SET_ENGINE_READY](state, { isEngineReady }: { isEngineReady: boolean }) {
      state.isEngineReady = isEngineReady;
    },
    [SET_CHARACTOR_INFOS](
      state,
      { charactorInfos }: { charactorInfos: CharactorInfo[] }
    ) {
      state.charactorInfos = charactorInfos;
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
  },

  actions: {
    [START_WAITING_ENGINE]: createUILockAction(async ({ state }, _) => {
      for (let i = 0; i < 100; i++) {
        try {
          await api.versionVersionGet();
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("waiting engine...");
          continue;
        }
        state.isEngineReady = true;
        break;
      }
    }),
    [LOAD_CHARACTOR]: createUILockAction(async ({ commit }) => {
      const charactorInfos = await window.electron.getCharactorInfos();

      await Promise.all(
        charactorInfos.map(async (charactorInfo) => {
          const buffer = await window.electron.readFile({
            filePath: charactorInfo.iconPath,
          });
          charactorInfo.iconBlob = new Blob([buffer]);
        })
      );

      commit(SET_CHARACTOR_INFOS, { charactorInfos });
    }),
    [SET_AUDIO_TEXT]: createCommandAction(
      (draft, { audioKey, text }: { audioKey: string; text: string }) => {
        draft.audioItems[audioKey].text = text;
      }
    ),
    [SET_AUDIO_CHARACTOR_INDEX]: createCommandAction<
      State,
      { audioKey: string; charactorIndex: number }
    >((draft, { audioKey, charactorIndex }) => {
      draft.audioItems[audioKey].charactorIndex = charactorIndex;
    }),
    async [CHANGE_CHARACTOR_INDEX](
      { getters, dispatch },
      { audioKey, charactorIndex }: { audioKey: string; charactorIndex: number }
    ) {
      const haveAudioQuery = getters[HAVE_AUDIO_QUERY](audioKey);
      await dispatch(SET_AUDIO_CHARACTOR_INDEX, { audioKey, charactorIndex });
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
            state.charactorInfos![audioItem.charactorIndex!].metas.speaker,
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
            state.charactorInfos![audioItem.charactorIndex!].metas.speaker,
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
            state.charactorInfos![audioItem.charactorIndex!].metas.speaker,
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
              state.charactorInfos![audioItem.charactorIndex!].metas.speaker,
          })
          .then(async (blob) => {
            audioBlobCache[id] = blob;
            return blob;
          });
      }
    ),
    [GENERATE_AND_SAVE_AUDIO]: createUILockAction(
      async (
        { state, dispatch },
        { audioKey, filePath }: { audioKey: string; filePath?: string }
      ) => {
        const blob: Blob = await dispatch(GENERATE_AUDIO, { audioKey });
        filePath ??= await window.electron.showAudioSaveDialog({
          title: "Save",
          defaultPath: buildFileName(state, audioKey),
        });
        if (filePath) {
          window.electron.writeFile({
            filePath,
            buffer: await blob.arrayBuffer(),
          });
          const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
          const textBlob = new Blob([bom, state.audioItems[audioKey].text], {
            type: "text/plain",
          });
          window.electron.writeFile({
            filePath: filePath.replace(/\.wav$/, ".txt"),
            buffer: await textBlob.arrayBuffer(),
          });
        }
      }
    ),
    [GENERATE_AND_SAVE_ALL_AUDIO]: createUILockAction(
      async ({ state, dispatch }, { dirPath }: { dirPath?: string }) => {
        dirPath ??= await window.electron.showOpenDirectoryDialog({
          title: "Save ALL",
        });
        if (dirPath) {
          const promises = state.audioKeys.map((audioKey, index) => {
            const name = buildFileName(state, audioKey);
            return dispatch(GENERATE_AND_SAVE_AUDIO, {
              audioKey,
              filePath: path.join(dirPath!, name),
            });
          });
          return Promise.all(promises);
        }
      }
    ),
    [IMPORT_FROM_FILE]: createUILockAction(async ({ state, dispatch }) => {
      const filePath = await window.electron.showImportFileDialog({
        title: "セリフ読み込み",
      });
      if (filePath) {
        let body = new TextDecoder("utf-8").decode(
          await window.electron.readFile({ filePath })
        );
        if (body.indexOf("\ufffd") > -1) {
          body = new TextDecoder("shift-jis").decode(
            await window.electron.readFile({ filePath })
          );
        }
        const audioItems = parseTextFile(body, state.charactorInfos);
        return Promise.all(
          audioItems.map((item) =>
            dispatch(REGISTER_AUDIO_ITEM, { audioItem: item })
          )
        );
      }
    }),
    [PLAY_AUDIO]: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: string }) => {
        const audioElem = audioElements[audioKey];
        audioElem.pause();

        // 音声用意
        let blob = await dispatch(GET_AUDIO_CACHE, { audioKey });
        if (!blob) {
          commit(SET_AUDIO_NOW_GENERATING, { audioKey, nowGenerating: true });
          try {
            blob = await dispatch(GENERATE_AUDIO, { audioKey });
          } finally {
            commit(SET_AUDIO_NOW_GENERATING, {
              audioKey,
              nowGenerating: false,
            });
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
        commit(SET_NOW_PLAYING_CONTINUOUSLY, { nowPlaying: true });
        try {
          for (const audioKey of state.audioKeys) {
            const isEnded = await dispatch(PLAY_AUDIO, { audioKey });
            if (!isEnded) {
              break;
            }
          }
        } finally {
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
  },
} as StoreOptions<State>;
