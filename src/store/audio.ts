import { AudioQuery, AccentPhrase, Speaker, SpeakerInfo } from "@/openapi";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  AudioItem,
  EngineState,
  SaveResultObject,
  State,
  commandMutationsCreator,
  AudioActions,
  AudioGetters,
  AudioMutations,
  AudioStoreState,
  AudioCommandActions,
  AudioCommandGetters,
  AudioCommandMutations,
  AudioCommandStoreState,
  VoiceVoxStoreOptions,
  IEngineConnectorFactoryActions,
} from "./type";
import { createUILockAction } from "./ui";
import {
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  MoraDataType,
  StyleInfo,
} from "@/type/preload";
import Encoding from "encoding-japanese";
import { PromiseType } from "./vuex";
import { buildProjectFileName, sanitizeFileName } from "./utility";

async function generateUniqueIdAndQuery(
  state: State,
  audioItem: AudioItem
): Promise<[string, AudioQuery | undefined]> {
  audioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = audioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate = state.savingSetting.outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
  }

  const data = new TextEncoder().encode(
    JSON.stringify([audioItem.text, audioQuery, audioItem.styleId])
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  const id = Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return [id, audioQuery];
}

function parseTextFile(
  body: string,
  defaultStyleIds: DefaultStyleId[],
  characterInfos?: CharacterInfo[]
): AudioItem[] {
  const characters = new Map<string, number>();
  {
    const uuid2StyleIds = new Map<string, number>();
    for (const defaultStyleId of defaultStyleIds || []) {
      const speakerUuid = defaultStyleId.speakerUuid;
      const styleId = defaultStyleId.defaultStyleId;
      uuid2StyleIds.set(speakerUuid, styleId);
    }
    for (const characterInfo of characterInfos || []) {
      const uuid = characterInfo.metas.speakerUuid;
      const styleId =
        uuid2StyleIds.get(uuid) ?? characterInfo.metas.styles[0].styleId;
      const speakerName = characterInfo.metas.speakerName;
      characters.set(speakerName, styleId);
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
  const index = state.audioKeys.indexOf(audioKey);
  const audioItem = state.audioItems[audioKey];
  let styleName: string | undefined = "";
  const character = state.characterInfos?.find((info) => {
    const result = info.metas.styles.findIndex(
      (style) => style.styleId === audioItem.styleId
    );

    if (result > -1) {
      styleName = info.metas.styles[result].styleName;
    }

    return result > -1;
  });

  if (character === undefined) {
    throw new Error();
  }

  const characterName = sanitizeFileName(character.metas.speakerName);
  let text = sanitizeFileName(audioItem.text);
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }

  const preFileName = (index + 1).toString().padStart(3, "0");
  // デフォルトのスタイルだとstyleIdが定義されていないのでundefinedになる。なのでファイル名に入れてしまうことを回避する目的で分岐させています。
  if (styleName === undefined) {
    return preFileName + `_${characterName}_${text}.wav`;
  }

  const sanitizedStyleName = sanitizeFileName(styleName);
  return preFileName + `_${characterName}（${sanitizedStyleName}）_${text}.wav`;
}

const audioBlobCache: Record<string, Blob> = {};
const audioElements: Record<string, HTMLAudioElement> = {};

export const audioStoreState: AudioStoreState = {
  engineState: "STARTING",
  audioItems: {},
  audioKeys: [],
  audioStates: {},
  nowPlayingContinuously: false,
};

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
    SET_AUDIO_KEYS(state, { audioKeys }: { audioKeys: string[] }) {
      state.audioKeys = audioKeys;
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
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.speedScale = speedScale;
    },
    SET_AUDIO_PITCH_SCALE(
      state,
      { audioKey, pitchScale }: { audioKey: string; pitchScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.pitchScale = pitchScale;
    },
    SET_AUDIO_INTONATION_SCALE(
      state,
      {
        audioKey,
        intonationScale,
      }: { audioKey: string; intonationScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.intonationScale = intonationScale;
    },
    SET_AUDIO_VOLUME_SCALE(
      state,
      { audioKey, volumeScale }: { audioKey: string; volumeScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.volumeScale = volumeScale;
    },
    SET_AUDIO_PRE_PHONEME_LENGTH(
      state,
      {
        audioKey,
        prePhonemeLength,
      }: { audioKey: string; prePhonemeLength: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.prePhonemeLength = prePhonemeLength;
    },
    SET_AUDIO_POST_PHONEME_LENGTH(
      state,
      {
        audioKey,
        postPhonemeLength,
      }: { audioKey: string; postPhonemeLength: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.postPhonemeLength = postPhonemeLength;
    },
    SET_AUDIO_PRESET(
      state,
      {
        audioKey,
        presetKey,
      }: { audioKey: string; presetKey: string | undefined }
    ) {
      if (presetKey === undefined) {
        delete state.audioItems[audioKey].presetKey;
      } else {
        state.audioItems[audioKey].presetKey = presetKey;
      }
    },
    APPLY_AUDIO_PRESET(state, { audioKey }: { audioKey: string }) {
      const audioItem = state.audioItems[audioKey];
      if (
        audioItem == undefined ||
        audioItem.presetKey == undefined ||
        audioItem.query == undefined
      )
        return;
      const presetItem = state.presetItems[audioItem.presetKey];
      if (presetItem == undefined) return;

      // Filter name property from presetItem in order to extract audioInfos.
      const { name: _, ...presetAudioInfos } = presetItem;

      // Type Assertion
      const audioInfos: Omit<
        AudioQuery,
        "accentPhrases" | "outputSamplingRate" | "outputStereo" | "kana"
      > = presetAudioInfos;

      audioItem.query = { ...audioItem.query, ...audioInfos };
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
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.accentPhrases = accentPhrases;
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
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.accentPhrases.splice(accentPhraseIndex, 1, ...accentPhrases);
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
        type: MoraDataType;
      }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
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
        case "pause": {
          const pauseMora = query.accentPhrases[accentPhraseIndex].pauseMora;
          if (pauseMora !== undefined && pauseMora !== null) {
            pauseMora.vowelLength = data;
          }
          break;
        }
        case "voicing": {
          query.accentPhrases[accentPhraseIndex].moras[moraIndex].pitch = data;
          if (data == 0) {
            query.accentPhrases[accentPhraseIndex].moras[moraIndex].vowel =
              query.accentPhrases[accentPhraseIndex].moras[
                moraIndex
              ].vowel.toUpperCase();
          } else {
            query.accentPhrases[accentPhraseIndex].moras[moraIndex].vowel =
              query.accentPhrases[accentPhraseIndex].moras[
                moraIndex
              ].vowel.toLowerCase();
          }
        }
      }
    },
  },

  actions: {
    START_WAITING_ENGINE: createUILockAction(
      async ({ state, commit, dispatch }) => {
        const engine = state.engines[0]; // TODO: 複数エンジン対応

        let engineState = state.engineState;
        for (let i = 0; i < 100; i++) {
          engineState = state.engineState;
          if (engineState === "FAILED_STARTING") {
            break;
          }

          try {
            await dispatch("INVOKE_ENGINE_CONNECTOR", {
              host: engine.host,
              action: "versionVersionGet",
              payload: [],
            }).then(toDispatchResponse("versionVersionGet"));
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // TODO: engineがundefinedの場合にログ出力されないためオプショナルチェーンにしている。複数エンジン対応が終わったら解除
            // TODO: URLには認証情報が載ることがある。将来的にはURLをそのままログ出力しないようにする
            window.electron.logInfo(`Waiting engine ${engine?.host}`);
            continue;
          }
          engineState = "READY";
          commit("SET_ENGINE_STATE", { engineState });
          break;
        }

        if (engineState !== "READY") {
          commit("SET_ENGINE_STATE", { engineState: "FAILED_STARTING" });
        }
      }
    ),
    LOAD_CHARACTER: createUILockAction(async ({ state, commit, dispatch }) => {
      const engine = state.engines[0]; // TODO: 複数エンジン対応

      const speakers = await dispatch("INVOKE_ENGINE_CONNECTOR", {
        host: engine.host,
        action: "speakersSpeakersGet",
        payload: [],
      })
        .then(toDispatchResponse("speakersSpeakersGet"))
        .catch((error) => {
          window.electron.logError(error, `Failed to get speakers.`);
          throw error;
        });
      const base64ToUrl = function (base64: string, type: string) {
        const buffer = Buffer.from(base64, "base64");
        const iconBlob = new Blob([buffer.buffer], { type: type });
        return URL.createObjectURL(iconBlob);
      };
      const getStyles = function (speaker: Speaker, speakerInfo: SpeakerInfo) {
        const styles: StyleInfo[] = new Array(speaker.styles.length);
        speaker.styles.forEach((style, i) => {
          const styleInfo = speakerInfo.styleInfos.find(
            (styleInfo) => style.id === styleInfo.id
          );
          if (!styleInfo)
            throw new Error(
              `Not found the style id "${style.id}" of "${speaker.name}". `
            );
          const voiceSamples = styleInfo.voiceSamples.map((voiceSample) => {
            return base64ToUrl(voiceSample, "audio/wav");
          });
          styles[i] = {
            styleName: style.name,
            styleId: style.id,
            iconPath: base64ToUrl(styleInfo.icon, "image/png"),
            voiceSamplePaths: voiceSamples,
          };
        });
        return styles;
      };
      const getSpeakerInfo = async function (speaker: Speaker) {
        const engine = state.engines[0]; // TODO: 複数エンジン対応

        const speakerInfo = await dispatch("INVOKE_ENGINE_CONNECTOR", {
          host: engine.host,
          action: "speakerInfoSpeakerInfoGet",
          payload: [{ speakerUuid: speaker.speakerUuid }],
        })
          .then(toDispatchResponse("speakerInfoSpeakerInfoGet"))
          .catch((error) => {
            window.electron.logError(error, `Failed to get speakers.`);
            throw error;
          });
        const styles = getStyles(speaker, speakerInfo);
        const characterInfo: CharacterInfo = {
          portraitPath: base64ToUrl(speakerInfo.portrait, "image/png"),
          metas: {
            speakerUuid: speaker.speakerUuid,
            speakerName: speaker.name,
            styles: styles,
            policy: speakerInfo.policy,
          },
        };
        return characterInfo;
      };
      const characterInfos: CharacterInfo[] = await Promise.all(
        speakers.map(async (speaker) => {
          return await getSpeakerInfo(speaker);
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
      payload: {
        text?: string;
        styleId?: number;
        presetKey?: string;
        baseAudioItem?: AudioItem;
      }
    ) {
      //引数にbaseAudioItemが与えられた場合、baseAudioItemから話速等のパラメータを引き継いだAudioItemを返す
      //baseAudioItem.queryのうち、accentPhrasesとkanaは基本設定パラメータではないので引き継がない
      //baseAudioItemのうち、textとstyleIdは別途与えられるので引き継がない
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      if (state.characterInfos == undefined)
        throw new Error("state.characterInfos == undefined");
      const characterInfos = state.characterInfos;

      const text = payload.text ?? "";
      const styleId =
        payload.styleId ??
        state.defaultStyleIds[
          state.defaultStyleIds.findIndex(
            (x) => x.speakerUuid === characterInfos[0].metas.speakerUuid // FIXME: defaultStyleIds内にspeakerUuidがない場合がある
          )
        ].defaultStyleId;
      const baseAudioItem = payload.baseAudioItem;
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
      if (payload.presetKey != undefined)
        audioItem.presetKey = payload.presetKey;

      if (baseAudioItem && baseAudioItem.query && audioItem.query) {
        //引数にbaseAudioItemがある場合、話速等のパラメータを引き継いだAudioItemを返す
        //baseAudioItem.queryが未設定の場合は引き継がない(起動直後等？)
        audioItem.query.speedScale = baseAudioItem.query.speedScale;
        audioItem.query.pitchScale = baseAudioItem.query.pitchScale;
        audioItem.query.intonationScale = baseAudioItem.query.intonationScale;
        audioItem.query.volumeScale = baseAudioItem.query.volumeScale;
        audioItem.query.prePhonemeLength = baseAudioItem.query.prePhonemeLength;
        audioItem.query.postPhonemeLength =
          baseAudioItem.query.postPhonemeLength;
        audioItem.query.outputSamplingRate =
          baseAudioItem.query.outputSamplingRate;
        audioItem.query.outputStereo = baseAudioItem.query.outputStereo;
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
      const [id] = await generateUniqueIdAndQuery(state, audioItem);

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
      { dispatch, state },
      {
        text,
        styleId,
        isKana,
      }: {
        text: string;
        styleId: number;
        isKana?: boolean;
      }
    ) {
      const engine = state.engines[0]; // TODO: 複数エンジン対応

      return dispatch("INVOKE_ENGINE_CONNECTOR", {
        host: engine.host,
        action: "accentPhrasesAccentPhrasesPost",
        payload: [
          {
            text,
            speaker: styleId,
            isKana,
            enableInterrogative: state.experimentalSetting.enableInterrogative,
          },
        ],
      })
        .then(toDispatchResponse("accentPhrasesAccentPhrasesPost"))
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AccentPhrases for the text "${text}".`
          );
          throw error;
        });
    },
    FETCH_MORA_DATA(
      { dispatch, state },
      {
        accentPhrases,
        styleId,
      }: { accentPhrases: AccentPhrase[]; styleId: number }
    ) {
      const engine = state.engines[0]; // TODO: 複数エンジン対応

      return dispatch("INVOKE_ENGINE_CONNECTOR", {
        host: engine.host,
        action: "moraDataMoraDataPost",
        payload: [{ accentPhrase: accentPhrases, speaker: styleId }],
      })
        .then(toDispatchResponse("moraDataMoraDataPost"))
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
    FETCH_AUDIO_QUERY(
      { dispatch, state },
      { text, styleId }: { text: string; styleId: number }
    ) {
      const engine = state.engines[0]; // TODO: 複数エンジン対応

      return dispatch("INVOKE_ENGINE_CONNECTOR", {
        host: engine.host,
        action: "audioQueryAudioQueryPost",
        payload: [
          {
            text,
            speaker: styleId,
            enableInterrogative: state.experimentalSetting.enableInterrogative,
          },
        ],
      })
        .then(toDispatchResponse("audioQueryAudioQueryPost"))
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AudioQuery for the text "${text}".`
          );
          throw error;
        });
    },
    GENERATE_LAB: createUILockAction(
      async (
        { state },
        { audioKey, offset }: { audioKey: string; offset?: number }
      ) => {
        const query = state.audioItems[audioKey].query;
        if (query == undefined) return;
        const speedScale = query.speedScale;

        let labString = "";
        let timestamp = offset !== undefined ? offset : 0;

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
          if (
            accentPhrase.pauseMora !== undefined &&
            accentPhrase.pauseMora !== null
          ) {
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

        return labString;
      }
    ),
    CONNECT_AUDIO: createUILockAction(
      async (
        { dispatch, state },
        { encodedBlobs }: { encodedBlobs: string[] }
      ) => {
        const engine = state.engines[0]; // TODO: 複数エンジン対応

        return dispatch("INVOKE_ENGINE_CONNECTOR", {
          host: engine.host,
          action: "connectWavesConnectWavesPost",
          payload: [
            {
              requestBody: encodedBlobs,
            },
          ],
        })
          .then(toDispatchResponse("connectWavesConnectWavesPost"))
          .then(async (blob) => {
            return blob;
          })
          .catch((e) => {
            window.electron.logError(e);
            return null;
          });
      }
    ),
    GENERATE_AUDIO: createUILockAction(
      async ({ dispatch, state }, { audioKey }: { audioKey: string }) => {
        const engine = state.engines[0]; // TODO: 複数エンジン対応

        const audioItem: AudioItem = JSON.parse(
          JSON.stringify(state.audioItems[audioKey])
        );

        const [id, audioQuery] = await generateUniqueIdAndQuery(
          state,
          audioItem
        );
        const speaker = audioItem.styleId;
        if (audioQuery == undefined || speaker == undefined) {
          return null;
        }

        return dispatch("INVOKE_ENGINE_CONNECTOR", {
          host: engine.host,
          action: "synthesisSynthesisPost",
          payload: [
            {
              audioQuery,
              speaker,
            },
          ],
        })
          .then(toDispatchResponse("synthesisSynthesisPost"))
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
            title: "音声を保存",
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
          const labString = await dispatch("GENERATE_LAB", { audioKey });
          if (labString === undefined)
            return { result: "WRITE_ERROR", path: filePath };

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
            title: "音声を全て保存",
          });
        }
        if (dirPath) {
          const _dirPath = dirPath;
          const promises = state.audioKeys.map((audioKey) => {
            const name = buildFileName(state, audioKey);
            return dispatch("GENERATE_AND_SAVE_AUDIO", {
              audioKey,
              filePath: path.join(_dirPath, name),
              encoding,
            });
          });
          return Promise.all(promises);
        }
      }
    ),
    GENERATE_AND_CONNECT_AND_SAVE_AUDIO: createUILockAction(
      async (
        { state, dispatch },
        { filePath, encoding }: { filePath?: string; encoding?: EncodingType }
      ): Promise<SaveResultObject> => {
        const defaultFileName = buildProjectFileName(state, "wav");

        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultFileName
          );
        } else {
          filePath ??= await window.electron.showAudioSaveDialog({
            title: "音声を全て繋げて保存",
            defaultPath: defaultFileName,
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

        const encodedBlobs: string[] = [];
        const labs: string[] = [];
        const texts: string[] = [];

        let labOffset = 0;

        const base64Encoder = (blob: Blob): Promise<string | undefined> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              // string/undefined以外が来ることはないと思うが、型定義的にArrayBufferも来るので、toStringする
              const result = reader.result?.toString();
              if (result) {
                // resultの中身は、"data:audio/wav;base64,<content>"という形なので、カンマ以降を抜き出す
                resolve(result.slice(result.indexOf(",") + 1));
              } else {
                reject();
              }
            };
            reader.readAsDataURL(blob);
          });
        };

        for (const audioKey of state.audioKeys) {
          let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
          if (!blob) {
            blob = await dispatch("GENERATE_AUDIO", { audioKey });
          }
          if (blob === null) {
            return { result: "ENGINE_ERROR", path: filePath };
          }
          const encodedBlob = await base64Encoder(blob);
          if (encodedBlob === undefined) {
            return { result: "WRITE_ERROR", path: filePath };
          }
          encodedBlobs.push(encodedBlob);
          // 大して処理能力を要しないので、生成設定のon/offにかかわらず生成してしまう
          const lab = await dispatch("GENERATE_LAB", {
            audioKey,
            offset: labOffset,
          });
          if (lab === undefined) {
            return { result: "WRITE_ERROR", path: filePath };
          }
          labs.push(lab);
          texts.push(state.audioItems[audioKey].text);
          // 最終音素の終了時刻を取得する
          const splitLab = lab.split(" ");
          labOffset = Number(splitLab[splitLab.length - 2]);
        }

        const connectedWav = await dispatch("CONNECT_AUDIO", {
          encodedBlobs,
        });
        if (!connectedWav) {
          return { result: "ENGINE_ERROR", path: filePath };
        }

        try {
          window.electron.writeFile({
            filePath,
            buffer: await connectedWav.arrayBuffer(),
          });
        } catch (e) {
          window.electron.logError(e);
          return { result: "WRITE_ERROR", path: filePath };
        }

        if (state.savingSetting.exportLab) {
          // GENERATE_LABで生成される文字列はすべて改行で終わるので、改行なしに結合する
          const labString = labs.join("");

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
            const text = texts.join("\n");
            if (!encoding || encoding === "UTF-8") {
              const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
              return new Blob([bom, text], {
                type: "text/plain;charset=UTF-8",
              });
            }
            const sjisArray = Encoding.convert(Encoding.stringToCode(text), {
              to: "SJIS",
              type: "arraybuffer",
            });
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
    PLAY_AUDIO: createUILockAction(
      async (
        { state, commit, dispatch },
        { audioKey }: { audioKey: string }
      ) => {
        const audioElem = audioElements[audioKey] as HTMLAudioElement & {
          setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
        };
        audioElem.pause();

        // 音声用意
        let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
        if (!blob) {
          commit("SET_AUDIO_NOW_GENERATING", {
            audioKey,
            nowGenerating: true,
          });
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

        audioElem
          .setSinkId(state.savingSetting.audioOutputDevice)
          .catch((err) => {
            const stop = () => {
              audioElem.pause();
              audioElem.removeEventListener("canplay", stop);
            };
            audioElem.addEventListener("canplay", stop);
            window.electron.showErrorDialog({
              title: "エラー",
              message: "再生デバイスが見つかりません",
            });
            throw new Error(err);
          });

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

export const audioCommandStoreState: AudioCommandStoreState = {};

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
    COMMAND_SET_AUDIO_KEYS({ commit }, payload: { audioKeys: string[] }) {
      commit("COMMAND_SET_AUDIO_KEYS", payload);
    },
    async COMMAND_CHANGE_AUDIO_TEXT(
      { state, commit, dispatch },
      { audioKey, text }: { audioKey: string; text: string }
    ) {
      const styleId = state.audioItems[audioKey].styleId;
      if (styleId == undefined) throw new Error("styleId != undefined");
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
          const styleId = state.audioItems[audioKey].styleId;
          if (styleId == undefined) throw new Error("styleId != undefined");
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
      const styleId = state.audioItems[audioKey].styleId;
      if (styleId == undefined) throw new Error("styleId != undefined");
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
      const styleId = state.audioItems[audioKey].styleId;
      if (styleId == undefined) throw new Error("styleId != undefined");

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

      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");

      const originAccentPhrases = query.accentPhrases;

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
        type: MoraDataType;
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
    COMMAND_SET_AUDIO_PRESET: (
      { commit },
      {
        audioKey,
        presetKey,
      }: {
        audioKey: string;
        presetKey: string | undefined;
      }
    ) => {
      commit("COMMAND_SET_AUDIO_PRESET", { audioKey, presetKey });
    },
    COMMAND_APPLY_AUDIO_PRESET: ({ commit }, payload: { audioKey: string }) => {
      commit("COMMAND_APPLY_AUDIO_PRESET", payload);
    },
    COMMAND_FULLY_APPLY_AUDIO_PRESET: (
      { commit },
      payload: { presetKey: string }
    ) => {
      commit("COMMAND_FULLY_APPLY_AUDIO_PRESET", payload);
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
        let baseAudioItem: AudioItem | undefined = undefined;
        if (state.inheritAudioInfo) {
          baseAudioItem = state._activeAudioKey
            ? state.audioItems[state._activeAudioKey]
            : undefined;
        }

        for (const { text, styleId } of parseTextFile(
          body,
          state.defaultStyleIds,
          state.characterInfos
        )) {
          //パラメータ引き継ぎがONの場合は話速等のパラメータを引き継いでテキスト欄を作成する
          //パラメータ引き継ぎがOFFの場合、baseAudioItemがundefinedになっているのでパラメータ引き継ぎは行われない
          audioItems.push(
            await dispatch("GENERATE_AUDIO_ITEM", {
              text,
              styleId,
              baseAudioItem,
            })
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
        { state, commit, dispatch },
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
        let baseAudioItem: AudioItem | undefined = undefined;
        if (state.inheritAudioInfo) {
          baseAudioItem = state._activeAudioKey
            ? state.audioItems[state._activeAudioKey]
            : undefined;
        }
        for (const text of texts.filter((value) => value != "")) {
          const audioKey: string = await dispatch("GENERATE_AUDIO_KEY");
          //パラメータ引き継ぎがONの場合は話速等のパラメータを引き継いでテキスト欄を作成する
          //パラメータ引き継ぎがOFFの場合、baseAudioItemがundefinedになっているのでパラメータ引き継ぎは行われない
          const audioItem = await dispatch("GENERATE_AUDIO_ITEM", {
            text,
            styleId,
            baseAudioItem,
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
      audioStore.mutations.APPLY_AUDIO_PRESET(draft, {
        audioKey: payload.audioKey,
      });
    },
    COMMAND_REMOVE_AUDIO_ITEM(draft, payload: { audioKey: string }) {
      audioStore.mutations.REMOVE_AUDIO_ITEM(draft, payload);
    },
    COMMAND_SET_AUDIO_KEYS(draft, payload: { audioKeys: string[] }) {
      audioStore.mutations.SET_AUDIO_KEYS(draft, payload);
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
        audioStore.mutations.APPLY_AUDIO_PRESET(draft, {
          audioKey: payload.audioKey,
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
        audioStore.mutations.APPLY_AUDIO_PRESET(draft, {
          audioKey: payload.audioKey,
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
        type: MoraDataType;
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
    COMMAND_SET_AUDIO_PRESET: (
      draft,
      {
        audioKey,
        presetKey,
      }: {
        audioKey: string;
        presetKey: string | undefined;
      }
    ) => {
      audioStore.mutations.SET_AUDIO_PRESET(draft, { audioKey, presetKey });
      audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
    },
    COMMAND_APPLY_AUDIO_PRESET(draft, payload: { audioKey: string }) {
      audioStore.mutations.APPLY_AUDIO_PRESET(draft, payload);
    },
    COMMAND_FULLY_APPLY_AUDIO_PRESET(
      draft,
      { presetKey }: { presetKey: string }
    ) {
      const targetAudioKeys = draft.audioKeys.filter(
        (audioKey) => draft.audioItems[audioKey].presetKey === presetKey
      );
      for (const audioKey of targetAudioKeys) {
        audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
      }
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

// FIXME: ProxyStoreのactionとVuexの組み合わせでReturnValueの型付けが中途半端になり、Promise<any>になってしまっている
const toDispatchResponse =
  <T extends keyof IEngineConnectorFactoryActions>(_: T) =>
  (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any
  ): PromiseType<ReturnType<IEngineConnectorFactoryActions[T]>> => {
    _; // Unused回避のため
    return response;
  };
