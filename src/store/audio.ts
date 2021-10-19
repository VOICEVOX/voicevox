import { AudioQuery, AccentPhrase, Configuration, DefaultApi } from "@/openapi";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  AudioItem,
  EngineState,
  SaveResultObject,
  State,
  commandMutationsCreator,
  AudioGetters,
  AudioActions,
  AudioMutations,
  AudioCommandActions,
  AudioCommandGetters,
  AudioCommandMutations,
  VoiceVoxStoreOptions,
} from "./type";
import { createUILockAction } from "./ui";
import { CharacterInfo, Encoding as EncodingType } from "@/type/preload";
import Encoding from "encoding-japanese";

const api = new DefaultApi(
  new Configuration({ basePath: process.env.VUE_APP_ENGINE_URL })
);

async function generateUniqueId(audioItem: AudioItem) {
  const data = new TextEncoder().encode(
    JSON.stringify([audioItem.text, audioItem.query, audioItem.styleId])
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
  const characters = new Map<string, number>();
  for (const info of characterInfos || []) {
    for (const style of info.metas.styles) {
      characters.set(info.metas.speakerName, style.styleId);
    }
  }
  if (!characters.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastStyleId = 0;
  for (const splittedText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const styleId = characters.get(splittedText);
    if (styleId !== undefined) {
      lastStyleId = styleId;
      continue;
    }

    audioItems.push({ text: splittedText, styleId: lastStyleId });
  }
  return audioItems;
}

function buildFileName(state: State, audioKey: string) {
  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;
  const index = state.audioKeys.indexOf(audioKey);
  const audioItem = state.audioItems[audioKey];
  const character = state.characterInfos?.find((info, _) => {
    const result = info.metas.styles.findIndex(
      (style) => style.styleId === audioItem.styleId
    );
    return result > -1 ? true : false;
  });
  const characterName = character!.metas.speakerName.replace(sanitizer, "");
  let text = audioItem.text.replace(sanitizer, "");
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }
  return (
    (index + 1).toString().padStart(3, "0") + `_${characterName}_${text}.wav`
  );
}

const audioBlobCache: Record<string, Blob> = {};
const audioElements: Record<string, HTMLAudioElement> = {};

export const audioStore: VoiceVoxStoreOptions<
  AudioGetters,
  AudioActions,
  AudioMutations
> = {
  getters: {
    ACTIVE_AUDIO_KEY(state) {
      return state._activeAudioKey !== undefined &&
        state.audioKeys.includes(state._activeAudioKey)
        ? state._activeAudioKey
        : undefined;
    },
    HAVE_AUDIO_QUERY: (state) => (audioKey: string) => {
      return state.audioItems[audioKey]?.query != undefined;
    },
    IS_ACTIVE: (state) => (audioKey: string) => {
      return state._activeAudioKey === audioKey;
    },
    IS_ENGINE_READY: (state) => {
      return state.engineState === "READY";
    },
  },

  mutations: {
    SET_ENGINE_STATE(state, { engineState }: { engineState: EngineState }) {
      state.engineState = engineState;
    },
    SET_CHARACTER_INFOS(
      state,
      { characterInfos }: { characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos = characterInfos;
    },
    SET_ACTIVE_AUDIO_KEY(state, { audioKey }: { audioKey?: string }) {
      state._activeAudioKey = audioKey;
    },
    SET_AUDIO_NOW_PLAYING(
      state,
      { audioKey, nowPlaying }: { audioKey: string; nowPlaying: boolean }
    ) {
      state.audioStates[audioKey].nowPlaying = nowPlaying;
    },
    SET_AUDIO_NOW_GENERATING(
      state,
      { audioKey, nowGenerating }: { audioKey: string; nowGenerating: boolean }
    ) {
      state.audioStates[audioKey].nowGenerating = nowGenerating;
    },
    SET_NOW_PLAYING_CONTINUOUSLY(
      state,
      { nowPlaying }: { nowPlaying: boolean }
    ) {
      state.nowPlayingContinuously = nowPlaying;
    },
    INSERT_AUDIO_ITEM(
      state,
      {
        audioItem,
        audioKey,
        prevAudioKey,
      }: {
        audioItem: AudioItem;
        audioKey: string;
        prevAudioKey: string | undefined;
      }
    ) {
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      state.audioKeys.splice(index, 0, audioKey);
      state.audioItems[audioKey] = audioItem;
      state.audioStates[audioKey] = {
        nowPlaying: false,
        nowGenerating: false,
      };
    },
    INSERT_AUDIO_ITEMS(
      state,
      {
        prevAudioKey,
        audioKeyItemPairs,
      }: {
        audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
        prevAudioKey: string | undefined;
      }
    ) {
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      const audioKeys = audioKeyItemPairs.map((pair) => pair.audioKey);
      state.audioKeys.splice(index, 0, ...audioKeys);
      for (const { audioKey, audioItem } of audioKeyItemPairs) {
        state.audioItems[audioKey] = audioItem;
        state.audioStates[audioKey] = {
          nowPlaying: false,
          nowGenerating: false,
        };
      }
    },
    REMOVE_AUDIO_ITEM(state, { audioKey }: { audioKey: string }) {
      state.audioKeys.splice(state.audioKeys.indexOf(audioKey), 1);
      delete state.audioItems[audioKey];
      delete state.audioStates[audioKey];
    },
    SET_AUDIO_TEXT(
      state,
      { audioKey, text }: { audioKey: string; text: string }
    ) {
      state.audioItems[audioKey].text = text;
    },
    SET_AUDIO_SPEED_SCALE(
      state,
      { audioKey, speedScale }: { audioKey: string; speedScale: number }
    ) {
      state.audioItems[audioKey].query!.speedScale = speedScale;
    },
    SET_AUDIO_PITCH_SCALE(
      state,
      { audioKey, pitchScale }: { audioKey: string; pitchScale: number }
    ) {
      state.audioItems[audioKey].query!.pitchScale = pitchScale;
    },
    SET_AUDIO_INTONATION_SCALE(
      state,
      {
        audioKey,
        intonationScale,
      }: { audioKey: string; intonationScale: number }
    ) {
      state.audioItems[audioKey].query!.intonationScale = intonationScale;
    },
    SET_AUDIO_VOLUME_SCALE(
      state,
      { audioKey, volumeScale }: { audioKey: string; volumeScale: number }
    ) {
      state.audioItems[audioKey].query!.volumeScale = volumeScale;
    },
    SET_AUDIO_PRE_PHONEME_LENGTH(
      state,
      {
        audioKey,
        prePhonemeLength,
      }: { audioKey: string; prePhonemeLength: number }
    ) {
      state.audioItems[audioKey].query!.prePhonemeLength = prePhonemeLength;
    },
    SET_AUDIO_POST_PHONEME_LENGTH(
      state,
      {
        audioKey,
        postPhonemeLength,
      }: { audioKey: string; postPhonemeLength: number }
    ) {
      state.audioItems[audioKey].query!.postPhonemeLength = postPhonemeLength;
    },
    SET_AUDIO_QUERY(
      state,
      { audioKey, audioQuery }: { audioKey: string; audioQuery: AudioQuery }
    ) {
      state.audioItems[audioKey].query = audioQuery;
    },
    SET_AUDIO_STYLE_ID(
      state,
      { audioKey, styleId }: { audioKey: string; styleId: number }
    ) {
      state.audioItems[audioKey].styleId = styleId;
    },
    SET_ACCENT_PHRASES(
      state,
      {
        audioKey,
        accentPhrases,
      }: { audioKey: string; accentPhrases: AccentPhrase[] }
    ) {
      state.audioItems[audioKey].query!.accentPhrases = accentPhrases;
    },
    SET_SINGLE_ACCENT_PHRASE(
      state,
      {
        audioKey,
        accentPhraseIndex,
        accentPhrases,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        accentPhrases: AccentPhrase[];
      }
    ) {
      state.audioItems[audioKey].query!.accentPhrases.splice(
        accentPhraseIndex,
        1,
        ...accentPhrases
      );
    },
    SET_AUDIO_MORA_DATA(
      state,
      {
        audioKey,
        accentPhraseIndex,
        moraIndex,
        data,
        type,
      }: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        data: number;
        type: string;
      }
    ) {
      const query = state.audioItems[audioKey].query!;
      switch (type) {
        case "pitch":
          query.accentPhrases[accentPhraseIndex].moras[moraIndex].pitch = data;
          break;
        case "consonant":
          query.accentPhrases[accentPhraseIndex].moras[
            moraIndex
          ].consonantLength = data;
          break;
        case "vowel":
          query.accentPhrases[accentPhraseIndex].moras[moraIndex].vowelLength =
            data;
          break;
        case "pause":
          query.accentPhrases[accentPhraseIndex].pauseMora!.vowelLength = data;
          break;
      }
    },
  },

  actions: {
    START_WAITING_ENGINE: createUILockAction(async ({ state, commit }) => {
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
          window.electron.logInfo("waiting engine...");
          continue;
        }
        engineState = "READY";
        commit("SET_ENGINE_STATE", { engineState });
        break;
      }

      if (engineState !== "READY") {
        commit("SET_ENGINE_STATE", { engineState: "FAILED_STARTING" });
      }
    }),
    LOAD_CHARACTER: createUILockAction(async ({ commit }) => {
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

      commit("SET_CHARACTER_INFOS", { characterInfos });
    }),
    GENERATE_AUDIO_KEY() {
      const audioKey = uuidv4();
      audioElements[audioKey] = new Audio();
      return audioKey;
    },
    REMOVE_ALL_AUDIO_ITEM({ commit, state }) {
      for (const audioKey of [...state.audioKeys]) {
        commit("REMOVE_AUDIO_ITEM", { audioKey });
      }
    },
    async GENERATE_AUDIO_ITEM(
      { state, getters, dispatch },
      payload: { text?: string; styleId?: number }
    ) {
      const text = payload.text ?? "";
      const styleId =
        payload.styleId ?? state.characterInfos![0].metas.styles[0].styleId;
      const query = getters.IS_ENGINE_READY
        ? await dispatch("FETCH_AUDIO_QUERY", {
            text,
            styleId,
          }).catch(() => undefined)
        : undefined;

      const audioItem: AudioItem = {
        text,
        styleId,
      };
      if (query != undefined) {
        audioItem.query = query;
      }
      return audioItem;
    },
    async REGISTER_AUDIO_ITEM(
      { dispatch, commit },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey?: string }
    ) {
      const audioKey = await dispatch("GENERATE_AUDIO_KEY");
      commit("INSERT_AUDIO_ITEM", { audioItem, audioKey, prevAudioKey });
      return audioKey;
    },
    SET_ACTIVE_AUDIO_KEY({ commit }, { audioKey }: { audioKey?: string }) {
      commit("SET_ACTIVE_AUDIO_KEY", { audioKey });
    },
    async GET_AUDIO_CACHE({ state }, { audioKey }: { audioKey: string }) {
      const audioItem = state.audioItems[audioKey];
      const id = await generateUniqueId(audioItem);

      if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
        return audioBlobCache[id];
      } else {
        return null;
      }
    },
    SET_AUDIO_QUERY(
      { commit },
      payload: { audioKey: string; audioQuery: AudioQuery }
    ) {
      commit("SET_AUDIO_QUERY", payload);
    },
    FETCH_ACCENT_PHRASES(
      _,
      {
        text,
        styleId,
        isKana,
      }: { text: string; styleId: number; isKana?: boolean }
    ) {
      return api
        .accentPhrasesAccentPhrasesPost({
          text,
          speaker: styleId,
          isKana,
        })
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AccentPhrases for the text "${text}".`
          );
          throw error;
        });
    },
    FETCH_MORA_DATA(
      _,
      {
        accentPhrases,
        styleId,
      }: { accentPhrases: AccentPhrase[]; styleId: number }
    ) {
      return api
        .moraDataMoraDataPost({
          accentPhrase: accentPhrases,
          speaker: styleId,
        })
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch MoraData for the accentPhrases "${JSON.stringify(
              accentPhrases
            )}".`
          );
          throw error;
        });
    },
    async FETCH_AND_COPY_MORA_DATA(
      { dispatch },
      {
        accentPhrases,
        styleId,
        copyIndexes,
      }: {
        accentPhrases: AccentPhrase[];
        styleId: number;
        copyIndexes: number[];
      }
    ) {
      const fetchedAccentPhrases: AccentPhrase[] = await dispatch(
        "FETCH_MORA_DATA",
        {
          accentPhrases,
          styleId,
        }
      );
      for (const index of copyIndexes) {
        accentPhrases[index] = fetchedAccentPhrases[index];
      }
      return accentPhrases;
    },
    FETCH_AUDIO_QUERY(_, { text, styleId }: { text: string; styleId: number }) {
      return api
        .audioQueryAudioQueryPost({
          text,
          speaker: styleId,
        })
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AudioQuery for the text "${text}".`
          );
          throw error;
        });
    },
    FETCH_AND_SET_AUDIO_QUERY(
      { state, dispatch },
      { audioKey }: { audioKey: string }
    ) {
      const audioItem = state.audioItems[audioKey];

      return dispatch("FETCH_AUDIO_QUERY", {
        text: audioItem.text,
        styleId: audioItem.styleId!,
      }).then((audioQuery) =>
        dispatch("SET_AUDIO_QUERY", { audioKey, audioQuery })
      );
    },
    GENERATE_AUDIO: createUILockAction(
      async ({ state }, { audioKey }: { audioKey: string }) => {
        const audioItem = state.audioItems[audioKey];
        const id = await generateUniqueId(audioItem);

        return api
          .synthesisSynthesisPost({
            audioQuery: audioItem.query!,
            speaker: audioItem.styleId!,
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
    GENERATE_AND_SAVE_AUDIO: createUILockAction(
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
          while (await dispatch("CHECK_FILE_EXISTS", { file: filePath })) {
            filePath = name + "[" + tail.toString() + "]" + ".wav";
            tail += 1;
          }
        }

        let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
        if (!blob) {
          blob = await dispatch("GENERATE_AUDIO", { audioKey });
          if (!blob) {
            return { result: "ENGINE_ERROR", path: filePath };
          }
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

        if (state.savingSetting.exportLab) {
          const query = state.audioItems[audioKey].query!;
          const speedScale = query.speedScale;

          let labString = "";
          let timestamp = 0;

          labString += timestamp.toFixed() + " ";
          timestamp += (query.prePhonemeLength * 10000000) / speedScale;
          labString += timestamp.toFixed() + " ";
          labString += "pau" + "\n";

          query.accentPhrases.forEach((accentPhrase) => {
            accentPhrase.moras.forEach((mora) => {
              if (
                mora.consonantLength !== undefined &&
                mora.consonant !== undefined
              ) {
                labString += timestamp.toFixed() + " ";
                timestamp += (mora.consonantLength * 10000000) / speedScale;
                labString += timestamp.toFixed() + " ";
                labString += mora.consonant + "\n";
              }
              labString += timestamp.toFixed() + " ";
              timestamp += (mora.vowelLength * 10000000) / speedScale;
              labString += timestamp.toFixed() + " ";
              if (mora.vowel != "N") {
                labString += mora.vowel.toLowerCase() + "\n";
              } else {
                labString += mora.vowel + "\n";
              }
            });
            if (accentPhrase.pauseMora !== undefined) {
              labString += timestamp.toFixed() + " ";
              timestamp +=
                (accentPhrase.pauseMora.vowelLength * 10000000) / speedScale;
              labString += timestamp.toFixed() + " ";
              labString += accentPhrase.pauseMora.vowel + "\n";
            }
          });

          labString += timestamp.toFixed() + " ";
          timestamp += (query.postPhonemeLength * 10000000) / speedScale;
          labString += timestamp.toFixed() + " ";
          labString += "pau" + "\n";

          const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
          const labBlob = new Blob([bom, labString], {
            type: "text/plain;charset=UTF-8",
          });

          try {
            window.electron.writeFile({
              filePath: filePath.replace(/\.wav$/, ".lab"),
              buffer: await labBlob.arrayBuffer(),
            });
          } catch (e) {
            window.electron.logError(e);

            return { result: "WRITE_ERROR", path: filePath };
          }
        }

        if (state.savingSetting.exportText) {
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
          } catch (e) {
            window.electron.logError(e);

            return { result: "WRITE_ERROR", path: filePath };
          }
        }

        return { result: "SUCCESS", path: filePath };
      }
    ),
    GENERATE_AND_SAVE_ALL_AUDIO: createUILockAction(
      async (
        { state, dispatch },
        { dirPath, encoding }: { dirPath?: string; encoding?: EncodingType }
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
            return dispatch("GENERATE_AND_SAVE_AUDIO", {
              audioKey,
              filePath: path.join(dirPath!, name),
              encoding,
            });
          });
          return Promise.all(promises);
        }
      }
    ),
    PLAY_AUDIO: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: string }) => {
        const audioElem = audioElements[audioKey];
        audioElem.pause();

        // 音声用意
        let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
        if (!blob) {
          commit("SET_AUDIO_NOW_GENERATING", { audioKey, nowGenerating: true });
          blob = await dispatch("GENERATE_AUDIO", { audioKey });
          commit("SET_AUDIO_NOW_GENERATING", {
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
          commit("SET_AUDIO_NOW_PLAYING", { audioKey, nowPlaying: true });
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
          commit("SET_AUDIO_NOW_PLAYING", { audioKey, nowPlaying: false });
        });

        audioElem.play();
        return audioPlayPromise;
      }
    ),
    STOP_AUDIO(_, { audioKey }: { audioKey: string }) {
      const audioElem = audioElements[audioKey];
      audioElem.pause();
    },
    PLAY_CONTINUOUSLY_AUDIO: createUILockAction(
      async ({ state, commit, dispatch }) => {
        const currentAudioKey = state._activeAudioKey;

        let index = 0;
        if (currentAudioKey !== undefined) {
          index = state.audioKeys.findIndex((v) => v === currentAudioKey);
        }

        commit("SET_NOW_PLAYING_CONTINUOUSLY", { nowPlaying: true });
        try {
          for (let i = index; i < state.audioKeys.length; ++i) {
            const audioKey = state.audioKeys[i];
            commit("SET_ACTIVE_AUDIO_KEY", { audioKey });
            const isEnded = await dispatch("PLAY_AUDIO", { audioKey });
            if (!isEnded) {
              break;
            }
          }
        } finally {
          commit("SET_ACTIVE_AUDIO_KEY", { audioKey: currentAudioKey });
          commit("SET_NOW_PLAYING_CONTINUOUSLY", { nowPlaying: false });
        }
      }
    ),
    STOP_CONTINUOUSLY_AUDIO({ state, dispatch }) {
      for (const audioKey of state.audioKeys) {
        if (state.audioStates[audioKey].nowPlaying) {
          dispatch("STOP_AUDIO", { audioKey });
        }
      }
    },
    OPEN_TEXT_EDIT_CONTEXT_MENU() {
      window.electron.openTextEditContextMenu();
    },
    DETECTED_ENGINE_ERROR({ state, commit }) {
      switch (state.engineState) {
        case "STARTING":
          commit("SET_ENGINE_STATE", { engineState: "FAILED_STARTING" });
          break;
        case "READY":
          commit("SET_ENGINE_STATE", { engineState: "ERROR" });
          break;
        default:
          commit("SET_ENGINE_STATE", { engineState: "ERROR" });
      }
    },
    async RESTART_ENGINE({ dispatch, commit }) {
      await commit("SET_ENGINE_STATE", { engineState: "STARTING" });
      window.electron
        .restartEngine()
        .then(() => dispatch("START_WAITING_ENGINE"))
        .catch(() => dispatch("DETECTED_ENGINE_ERROR"));
    },
    CHECK_FILE_EXISTS(_, { file }: { file: string }) {
      return window.electron.checkFileExists(file);
    },
  },
};

export const audioCommandStore: VoiceVoxStoreOptions<
  AudioCommandGetters,
  AudioCommandActions,
  AudioCommandMutations
> = {
  getters: {},
  actions: {
    async COMMAND_REGISTER_AUDIO_ITEM(
      { dispatch, commit },
      {
        audioItem,
        prevAudioKey,
      }: {
        audioItem: AudioItem;
        prevAudioKey: string | undefined;
      }
    ) {
      const audioKey = await dispatch("GENERATE_AUDIO_KEY");
      commit("COMMAND_REGISTER_AUDIO_ITEM", {
        audioItem,
        audioKey,
        prevAudioKey,
      });
      return audioKey;
    },
    COMMAND_REMOVE_AUDIO_ITEM({ commit }, payload: { audioKey: string }) {
      commit("COMMAND_REMOVE_AUDIO_ITEM", payload);
    },
    async COMMAND_CHANGE_AUDIO_TEXT(
      { state, commit, dispatch },
      { audioKey, text }: { audioKey: string; text: string }
    ) {
      const styleId = state.audioItems[audioKey].styleId!;
      const query: AudioQuery | undefined = state.audioItems[audioKey].query;
      try {
        if (query !== undefined) {
          const accentPhrases: AccentPhrase[] = await dispatch(
            "FETCH_ACCENT_PHRASES",
            {
              text,
              styleId,
            }
          );
          commit("COMMAND_CHANGE_AUDIO_TEXT", {
            audioKey,
            text,
            update: "AccentPhrases",
            accentPhrases,
          });
        } else {
          const newAudioQuery = await dispatch("FETCH_AUDIO_QUERY", {
            text,
            styleId,
          });
          commit("COMMAND_CHANGE_AUDIO_TEXT", {
            audioKey,
            text,
            update: "AudioQuery",
            query: newAudioQuery,
          });
        }
      } catch (error) {
        commit("COMMAND_CHANGE_AUDIO_TEXT", {
          audioKey,
          text,
          update: "Text",
        });
        throw error;
      }
    },
    async COMMAND_CHANGE_STYLE_ID(
      { state, dispatch, commit },
      { audioKey, styleId }: { audioKey: string; styleId: number }
    ) {
      const query = state.audioItems[audioKey].query;
      try {
        if (query !== undefined) {
          const accentPhrases = query.accentPhrases;
          const newAccentPhrases: AccentPhrase[] = await dispatch(
            "FETCH_MORA_DATA",
            {
              accentPhrases,
              styleId,
            }
          );
          commit("COMMAND_CHANGE_STYLE_ID", {
            styleId,
            audioKey: audioKey,
            update: "AccentPhrases",
            accentPhrases: newAccentPhrases,
          });
        } else {
          const text = state.audioItems[audioKey].text;
          const query: AudioQuery = await dispatch("FETCH_AUDIO_QUERY", {
            text: text,
            styleId,
          });
          commit("COMMAND_CHANGE_STYLE_ID", {
            styleId,
            audioKey,
            update: "AudioQuery",
            query,
          });
        }
      } catch (error) {
        commit("COMMAND_CHANGE_STYLE_ID", {
          styleId,
          audioKey,
          update: "StyleId",
        });
        throw error;
      }
    },
    async COMMAND_CHANGE_ACCENT(
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
    ) {
      const query = state.audioItems[audioKey].query;
      if (query !== undefined) {
        const newAccentPhrases: AccentPhrase[] = JSON.parse(
          JSON.stringify(query.accentPhrases)
        );
        newAccentPhrases[accentPhraseIndex].accent = accent;

        try {
          const styleId: number = state.audioItems[audioKey].styleId!;
          const resultAccentPhrases: AccentPhrase[] = await dispatch(
            "FETCH_AND_COPY_MORA_DATA",
            {
              accentPhrases: newAccentPhrases,
              styleId,
              copyIndexes: [accentPhraseIndex],
            }
          );

          commit("COMMAND_CHANGE_ACCENT", {
            audioKey,
            accentPhrases: resultAccentPhrases,
          });
        } catch (error) {
          commit("COMMAND_CHANGE_ACCENT", {
            audioKey,
            accentPhrases: newAccentPhrases,
          });
          throw error;
        }
      }
    },
    async COMMAND_CHANGE_ACCENT_PHRASE_SPLIT(
      { state, dispatch, commit },
      payload: {
        audioKey: string;
        accentPhraseIndex: number;
      } & (
        | {
            isPause: false;
            moraIndex: number;
          }
        | {
            isPause: true;
          }
      )
    ) {
      const { audioKey, accentPhraseIndex } = payload;
      const query: AudioQuery | undefined = state.audioItems[audioKey].query;
      const styleId: number = state.audioItems[audioKey].styleId!;
      if (query === undefined) {
        throw Error(
          "`COMMAND_CHANGE_ACCENT_PHRASE_SPLIT` should not be called if the query does not exist."
        );
      }
      const newAccentPhrases: AccentPhrase[] = JSON.parse(
        JSON.stringify(query.accentPhrases)
      );
      const changeIndexes = [accentPhraseIndex];
      // toggleAccentPhrase to newAccentPhrases and recored changeIndexes
      {
        const mergeAccent = (
          accentPhrases: AccentPhrase[],
          accentPhraseIndex: number
        ) => {
          const newAccentPhrase: AccentPhrase = {
            moras: [
              ...accentPhrases[accentPhraseIndex].moras,
              ...accentPhrases[accentPhraseIndex + 1].moras,
            ],
            accent: accentPhrases[accentPhraseIndex].accent,
            pauseMora: accentPhrases[accentPhraseIndex + 1].pauseMora,
          };
          accentPhrases.splice(accentPhraseIndex, 2, newAccentPhrase);
        };
        const splitAccent = (
          accentPhrases: AccentPhrase[],
          accentPhraseIndex: number,
          moraIndex: number
        ) => {
          const newAccentPhrase1: AccentPhrase = {
            moras: accentPhrases[accentPhraseIndex].moras.slice(
              0,
              moraIndex + 1
            ),
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
        };

        if (payload.isPause) {
          mergeAccent(newAccentPhrases, accentPhraseIndex);
        } else {
          const moraIndex: number = payload.moraIndex;
          if (
            moraIndex ===
            newAccentPhrases[accentPhraseIndex].moras.length - 1
          ) {
            mergeAccent(newAccentPhrases, accentPhraseIndex);
          } else {
            splitAccent(newAccentPhrases, accentPhraseIndex, moraIndex);
            changeIndexes.push(accentPhraseIndex + 1);
          }
        }
      }

      try {
        const resultAccentPhrases: AccentPhrase[] = await dispatch(
          "FETCH_AND_COPY_MORA_DATA",
          {
            accentPhrases: newAccentPhrases,
            styleId,
            copyIndexes: changeIndexes,
          }
        );
        commit("COMMAND_CHANGE_ACCENT_PHRASE_SPLIT", {
          audioKey,
          accentPhrases: resultAccentPhrases,
        });
      } catch (error) {
        commit("COMMAND_CHANGE_ACCENT_PHRASE_SPLIT", {
          audioKey,
          accentPhrases: newAccentPhrases,
        });
        throw error;
      }
    },
    async COMMAND_CHANGE_SINGLE_ACCENT_PHRASE(
      { state, dispatch, commit },
      {
        audioKey,
        newPronunciation,
        accentPhraseIndex,
        popUntilPause,
      }: {
        audioKey: string;
        newPronunciation: string;
        accentPhraseIndex: number;
        popUntilPause: boolean;
      }
    ) {
      const styleId = state.audioItems[audioKey].styleId!;

      let newAccentPhrasesSegment: AccentPhrase[] | undefined = undefined;

      // ひらがな(U+3041~U+3094)とカタカナ(U+30A1~U+30F4)と全角長音(U+30FC)のみで構成される場合、
      // 「読み仮名」としてこれを処理する
      const kanaRegex = /^[\u3041-\u3094\u30A1-\u30F4\u30FC]+$/;
      if (kanaRegex.test(newPronunciation)) {
        // ひらがなが混ざっている場合はカタカナに変換
        const katakana = newPronunciation.replace(/[\u3041-\u3094]/g, (s) => {
          return String.fromCharCode(s.charCodeAt(0) + 0x60);
        });
        // 長音を適切な音に変換
        const pureKatakana = katakana
          .replace(/(?<=[アカサタナハマヤラワャァガザダバパ]ー*)ー/g, "ア")
          .replace(/(?<=[イキシチニヒミリィギジヂビピ]ー*)ー/g, "イ")
          .replace(/(?<=[ウクスツヌフムユルュゥヴグズヅブプ]ー*)ー/g, "ウ")
          .replace(/(?<=[エケセテネヘメレェゲゼデベペ]ー*)ー/g, "エ")
          .replace(/(?<=[オコソトノホモヨロヲョォゴゾドボポ]ー*)ー/g, "オ")
          .replace(/(?<=[ン]ー*)ー/g, "ン")
          .replace(/(?<=[ッ]ー*)ー/g, "ッ");

        // アクセントを末尾につけaccent phraseの生成をリクエスト
        // 判別できない読み仮名が混じっていた場合400エラーが帰るのでfallback
        newAccentPhrasesSegment = await dispatch("FETCH_ACCENT_PHRASES", {
          text: pureKatakana + "'",
          styleId,
          isKana: true,
        }).catch(
          // fallback
          () =>
            dispatch("FETCH_ACCENT_PHRASES", {
              text: newPronunciation,
              styleId,
              isKana: false,
            })
        );
      } else {
        newAccentPhrasesSegment = await dispatch("FETCH_ACCENT_PHRASES", {
          text: newPronunciation,
          styleId,
        });
      }

      if (popUntilPause) {
        while (
          newAccentPhrasesSegment[newAccentPhrasesSegment.length - 1]
            .pauseMora === undefined
        ) {
          newAccentPhrasesSegment.pop();
        }
      }

      const originAccentPhrases =
        state.audioItems[audioKey].query!.accentPhrases;

      // https://github.com/Hiroshiba/voicevox/issues/248
      // newAccentPhrasesSegmentは1つの文章として合成されているためMoraDataが不自然になる。
      // MoraDataを正しく計算する為MoraDataだけを文章全体で再計算する。
      const newAccentPhrases = [
        ...originAccentPhrases.slice(0, accentPhraseIndex),
        ...newAccentPhrasesSegment,
        ...originAccentPhrases.slice(accentPhraseIndex + 1),
      ];
      const copyIndexes = newAccentPhrasesSegment.map(
        (_, i) => accentPhraseIndex + i
      );

      try {
        const resultAccentPhrases: AccentPhrase[] = await dispatch(
          "FETCH_AND_COPY_MORA_DATA",
          {
            accentPhrases: newAccentPhrases,
            styleId,
            copyIndexes,
          }
        );
        commit("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
          audioKey,
          accentPhrases: resultAccentPhrases,
        });
      } catch (error) {
        commit("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
          audioKey,
          accentPhrases: newAccentPhrases,
        });
      }
    },
    COMMAND_SET_AUDIO_MORA_DATA(
      { commit },
      payload: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        data: number;
        type: string;
      }
    ) {
      commit("COMMAND_SET_AUDIO_MORA_DATA", payload);
    },
    COMMAND_SET_AUDIO_SPEED_SCALE(
      { commit },
      payload: { audioKey: string; speedScale: number }
    ) {
      commit("COMMAND_SET_AUDIO_SPEED_SCALE", payload);
    },
    COMMAND_SET_AUDIO_PITCH_SCALE(
      { commit },
      payload: { audioKey: string; pitchScale: number }
    ) {
      commit("COMMAND_SET_AUDIO_PITCH_SCALE", payload);
    },
    COMMAND_SET_AUDIO_INTONATION_SCALE(
      { commit },
      payload: { audioKey: string; intonationScale: number }
    ) {
      commit("COMMAND_SET_AUDIO_INTONATION_SCALE", payload);
    },
    COMMAND_SET_AUDIO_VOLUME_SCALE(
      { commit },
      payload: { audioKey: string; volumeScale: number }
    ) {
      commit("COMMAND_SET_AUDIO_VOLUME_SCALE", payload);
    },
    COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH(
      { commit },
      payload: { audioKey: string; prePhonemeLength: number }
    ) {
      commit("COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH", payload);
    },
    COMMAND_SET_AUDIO_POST_PHONEME_LENGTH(
      { commit },
      payload: { audioKey: string; postPhonemeLength: number }
    ) {
      commit("COMMAND_SET_AUDIO_POST_PHONEME_LENGTH", payload);
    },
    COMMAND_IMPORT_FROM_FILE: createUILockAction(
      async (
        { state, commit, dispatch },
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
        const audioItems: AudioItem[] = [];
        for (const { text, styleId } of parseTextFile(
          body,
          state.characterInfos
        )) {
          audioItems.push(
            await dispatch("GENERATE_AUDIO_ITEM", { text, styleId })
          );
        }
        const audioKeys: string[] = await Promise.all(
          audioItems.map(() => dispatch("GENERATE_AUDIO_KEY"))
        );
        const audioKeyItemPairs = audioItems.map((audioItem, index) => ({
          audioItem,
          audioKey: audioKeys[index],
        }));
        commit("COMMAND_IMPORT_FROM_FILE", {
          audioKeyItemPairs,
        });
        return audioKeys;
      }
    ),
    COMMAND_PUT_TEXTS: createUILockAction(
      async (
        { commit, dispatch },
        {
          prevAudioKey,
          texts,
          styleId,
        }: {
          prevAudioKey: string;
          texts: string[];
          styleId: number;
        }
      ) => {
        const audioKeyItemPairs: { audioKey: string; audioItem: AudioItem }[] =
          [];
        for (const text of texts.filter((value) => value != "")) {
          const audioKey: string = await dispatch("GENERATE_AUDIO_KEY");
          const audioItem: AudioItem = await dispatch("GENERATE_AUDIO_ITEM", {
            text,
            styleId,
          });
          audioKeyItemPairs.push({
            audioKey,
            audioItem,
          });
        }
        const audioKeys = audioKeyItemPairs.map((value) => value.audioKey);
        commit("COMMAND_PUT_TEXTS", {
          prevAudioKey,
          audioKeyItemPairs,
        });
        return audioKeys;
      }
    ),
  },
  mutations: commandMutationsCreator({
    COMMAND_REGISTER_AUDIO_ITEM(
      draft,
      payload: {
        audioItem: AudioItem;
        audioKey: string;
        prevAudioKey: string | undefined;
      }
    ) {
      audioStore.mutations.INSERT_AUDIO_ITEM(draft, payload);
    },
    COMMAND_REMOVE_AUDIO_ITEM(draft, payload: { audioKey: string }) {
      audioStore.mutations.REMOVE_AUDIO_ITEM(draft, payload);
    },
    COMMAND_CHANGE_AUDIO_TEXT(
      draft,
      payload: { audioKey: string; text: string } & (
        | {
            update: "Text";
          }
        | {
            update: "AccentPhrases";
            accentPhrases: AccentPhrase[];
          }
        | {
            update: "AudioQuery";
            query: AudioQuery;
          }
      )
    ) {
      audioStore.mutations.SET_AUDIO_TEXT(draft, {
        audioKey: payload.audioKey,
        text: payload.text,
      });
      if (payload.update == "AccentPhrases") {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, {
          audioKey: payload.audioKey,
          accentPhrases: payload.accentPhrases,
        });
      } else if (payload.update == "AudioQuery") {
        audioStore.mutations.SET_AUDIO_QUERY(draft, {
          audioKey: payload.audioKey,
          audioQuery: payload.query,
        });
      }
    },
    COMMAND_CHANGE_STYLE_ID(
      draft,
      payload: { styleId: number; audioKey: string } & (
        | {
            update: "StyleId";
          }
        | {
            update: "AccentPhrases";
            accentPhrases: AccentPhrase[];
          }
        | {
            update: "AudioQuery";
            query: AudioQuery;
          }
      )
    ) {
      audioStore.mutations.SET_AUDIO_STYLE_ID(draft, {
        audioKey: payload.audioKey,
        styleId: payload.styleId,
      });
      if (payload.update == "AccentPhrases") {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, {
          audioKey: payload.audioKey,
          accentPhrases: payload.accentPhrases,
        });
      } else if (payload.update == "AudioQuery") {
        audioStore.mutations.SET_AUDIO_QUERY(draft, {
          audioKey: payload.audioKey,
          audioQuery: payload.query,
        });
      }
    },
    COMMAND_CHANGE_ACCENT(
      draft,
      {
        audioKey,
        accentPhrases,
      }: {
        audioKey: string;
        accentPhrases: AccentPhrase[];
      }
    ) {
      audioStore.mutations.SET_ACCENT_PHRASES(draft, {
        audioKey,
        accentPhrases,
      });
    },
    COMMAND_CHANGE_ACCENT_PHRASE_SPLIT(
      draft,
      payload: {
        audioKey: string;
        accentPhrases: AccentPhrase[];
      }
    ) {
      audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
    },
    COMMAND_CHANGE_SINGLE_ACCENT_PHRASE(
      draft,
      payload: {
        audioKey: string;
        accentPhrases: AccentPhrase[];
      }
    ) {
      audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
    },
    COMMAND_SET_AUDIO_MORA_DATA(
      draft,
      payload: {
        audioKey: string;
        accentPhraseIndex: number;
        moraIndex: number;
        data: number;
        type: string;
      }
    ) {
      audioStore.mutations.SET_AUDIO_MORA_DATA(draft, payload);
    },
    COMMAND_SET_AUDIO_SPEED_SCALE(
      draft,
      payload: { audioKey: string; speedScale: number }
    ) {
      audioStore.mutations.SET_AUDIO_SPEED_SCALE(draft, payload);
    },
    COMMAND_SET_AUDIO_PITCH_SCALE(
      draft,
      payload: { audioKey: string; pitchScale: number }
    ) {
      audioStore.mutations.SET_AUDIO_PITCH_SCALE(draft, payload);
    },
    COMMAND_SET_AUDIO_INTONATION_SCALE(
      draft,
      payload: { audioKey: string; intonationScale: number }
    ) {
      audioStore.mutations.SET_AUDIO_INTONATION_SCALE(draft, payload);
    },
    COMMAND_SET_AUDIO_VOLUME_SCALE(
      draft,
      payload: { audioKey: string; volumeScale: number }
    ) {
      audioStore.mutations.SET_AUDIO_VOLUME_SCALE(draft, payload);
    },
    COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH(
      draft,
      payload: { audioKey: string; prePhonemeLength: number }
    ) {
      audioStore.mutations.SET_AUDIO_PRE_PHONEME_LENGTH(draft, payload);
    },
    COMMAND_SET_AUDIO_POST_PHONEME_LENGTH(
      draft,
      payload: { audioKey: string; postPhonemeLength: number }
    ) {
      audioStore.mutations.SET_AUDIO_POST_PHONEME_LENGTH(draft, payload);
    },
    COMMAND_IMPORT_FROM_FILE(
      draft,
      {
        audioKeyItemPairs,
      }: { audioKeyItemPairs: { audioKey: string; audioItem: AudioItem }[] }
    ) {
      audioStore.mutations.INSERT_AUDIO_ITEMS(draft, {
        audioKeyItemPairs,
        prevAudioKey: undefined,
      });
    },
    COMMAND_PUT_TEXTS(
      draft,
      {
        audioKeyItemPairs,
        prevAudioKey,
      }: {
        audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
        prevAudioKey: string;
      }
    ) {
      audioStore.mutations.INSERT_AUDIO_ITEMS(draft, {
        audioKeyItemPairs,
        prevAudioKey,
      });
    },
  }),
};
