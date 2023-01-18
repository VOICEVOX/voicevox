import { AudioQuery, AccentPhrase, Speaker, SpeakerInfo } from "@/openapi";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  AudioItem,
  SaveResultObject,
  State,
  AudioStoreState,
  AudioCommandStoreState,
  EditorAudioQuery,
  AudioStoreTypes,
  AudioCommandStoreTypes,
  transformCommandStore,
} from "./type";
import { createUILockAction, withProgress } from "./ui";
import {
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  MoraDataType,
  MorphingInfo,
  StyleInfo,
  WriteFileErrorResult,
} from "@/type/preload";
import Encoding from "encoding-japanese";
import {
  buildFileNameFromRawData,
  buildProjectFileName,
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
  currentDateString,
} from "./utility";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import { createPartialStore } from "./vuex";
import { base64ImageToUri } from "@/helpers/imageHelper";

async function generateUniqueIdAndQuery(
  state: State,
  audioItem: AudioItem
): Promise<[string, EditorAudioQuery | undefined]> {
  audioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = audioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate = state.savingSetting.outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
  }

  const data = new TextEncoder().encode(
    JSON.stringify([
      audioItem.text,
      audioQuery,
      audioItem.engineId,
      audioItem.styleId,
      audioItem.morphingInfo,
      state.experimentalSetting.enableInterrogativeUpspeak, // このフラグが違うと、同じAudioQueryで違う音声が生成されるので追加
    ])
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
  userOrderedCharacterInfos: CharacterInfo[]
): AudioItem[] {
  const characters = new Map<string, { engineId: string; styleId: number }>();
  const uuid2StyleIds = new Map<
    string,
    { engineId: string; styleId: number }
  >();
  for (const defaultStyleId of defaultStyleIds) {
    const speakerUuid = defaultStyleId.speakerUuid;
    const engineId = defaultStyleId.engineId;
    const styleId = defaultStyleId.defaultStyleId;
    uuid2StyleIds.set(speakerUuid, { engineId, styleId });
  }
  // setup default characters
  for (const characterInfo of userOrderedCharacterInfos) {
    const uuid = characterInfo.metas.speakerUuid;
    const style = uuid2StyleIds.get(uuid);
    const speakerName = characterInfo.metas.speakerName;
    if (style == undefined)
      throw new Error(`styleId is undefined. speakerUuid: ${uuid}`);
    characters.set(speakerName, {
      engineId: style.engineId,
      styleId: style.styleId,
    });
  }
  // setup characters with style name
  for (const characterInfo of userOrderedCharacterInfos) {
    for (const style of characterInfo.metas.styles) {
      characters.set(
        `${characterInfo.metas.speakerName}(${style.styleName || "ノーマル"})`,
        { engineId: style.engineId, styleId: style.styleId }
      );
    }
  }
  if (!characters.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastStyle = uuid2StyleIds.get(
    userOrderedCharacterInfos[0].metas.speakerUuid
  );
  if (lastStyle == undefined) throw new Error(`lastStyle is undefined.`);
  for (const splitText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const styleId = characters.get(splitText);
    if (styleId !== undefined) {
      lastStyle = styleId;
      continue;
    }

    // FIXME: engineIdの追加
    audioItems.push({
      text: splitText,
      engineId: lastStyle.engineId,
      styleId: lastStyle.styleId,
    });
  }
  return audioItems;
}

// TODO: GETTERに移動する
function buildFileName(state: State, audioKey: string) {
  const fileNamePattern = state.savingSetting.fileNamePattern;

  const index = state.audioKeys.indexOf(audioKey);
  const audioItem = state.audioItems[audioKey];

  if (audioItem.engineId === undefined)
    throw new Error("asssrt audioItem.engineId !== undefined");
  if (audioItem.styleId === undefined)
    throw new Error("assert audioItem.styleId !== undefined");

  const character = getCharacterInfo(
    state,
    audioItem.engineId,
    audioItem.styleId
  );
  if (character === undefined)
    throw new Error("assert character !== undefined");

  const style = character.metas.styles.find(
    (style) => style.styleId === audioItem.styleId
  );
  if (style === undefined) throw new Error("assert style !== undefined");

  const styleName = style.styleName || "ノーマル";
  return buildFileNameFromRawData(fileNamePattern, {
    characterName: character.metas.speakerName,
    index,
    styleName,
    text: audioItem.text,
    date: currentDateString(),
  });
}

function generateWriteErrorMessage(writeFileErrorResult: WriteFileErrorResult) {
  if (writeFileErrorResult.code) {
    const code = writeFileErrorResult.code.toUpperCase();

    if (code.startsWith("ENOSPC")) {
      return "空き容量が足りません。";
    }

    if (code.startsWith("EACCES")) {
      return "ファイルにアクセスする許可がありません。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileErrorResult.message}`;
}

// TODO: GETTERに移動する。buildFileNameから参照されているので、そちらも一緒に移動する。
export function getCharacterInfo(
  state: State,
  engineId: string,
  styleId: number
): CharacterInfo | undefined {
  const engineCharacterInfos = state.characterInfos[engineId];

  // (engineId, styleId)で「スタイル付きキャラクター」は一意である
  return engineCharacterInfos.find((characterInfo) =>
    characterInfo.metas.styles.some(
      (characterStyle) => characterStyle.styleId === styleId
    )
  );
}

const audioBlobCache: Record<string, Blob> = {};
const audioElements: Record<string, HTMLAudioElement> = {};

export const audioStoreState: AudioStoreState = {
  characterInfos: {},
  audioItems: {},
  audioKeys: [],
  audioStates: {},
  // audio elementの再生オフセット
  audioPlayStartPoint: undefined,
  nowPlayingContinuously: false,
};

export const audioStore = createPartialStore<AudioStoreTypes>({
  ACTIVE_AUDIO_KEY: {
    getter(state) {
      return state._activeAudioKey !== undefined &&
        state.audioKeys.includes(state._activeAudioKey)
        ? state._activeAudioKey
        : undefined;
    },
  },

  HAVE_AUDIO_QUERY: {
    getter: (state) => (audioKey: string) => {
      return state.audioItems[audioKey]?.query != undefined;
    },
  },

  IS_ACTIVE: {
    getter: (state) => (audioKey: string) => {
      return state._activeAudioKey === audioKey;
    },
  },

  ACTIVE_AUDIO_ELEM_CURRENT_TIME: {
    getter: (state) => {
      return state._activeAudioKey !== undefined
        ? audioElements[state._activeAudioKey]?.currentTime
        : undefined;
    },
  },

  LOAD_CHARACTER: {
    action: createUILockAction(async ({ commit, dispatch }, { engineId }) => {
      const speakers = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) => instance.invoke("speakersSpeakersGet")({}))
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
            engineId,
            iconPath: base64ImageToUri(styleInfo.icon),
            portraitPath:
              styleInfo.portrait && base64ImageToUri(styleInfo.portrait),
            voiceSamplePaths: voiceSamples,
          };
        });
        return styles;
      };
      const getSpeakerInfo = async function (speaker: Speaker) {
        const speakerInfo = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
          .then((instance) =>
            instance.invoke("speakerInfoSpeakerInfoGet")({
              speakerUuid: speaker.speakerUuid,
            })
          )
          .catch((error) => {
            window.electron.logError(error, `Failed to get speakers.`);
            throw error;
          });
        const styles = getStyles(speaker, speakerInfo);
        const characterInfo: CharacterInfo = {
          portraitPath: base64ImageToUri(speakerInfo.portrait),
          metas: {
            speakerUuid: speaker.speakerUuid,
            speakerName: speaker.name,
            styles,
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

      commit("SET_CHARACTER_INFOS", { engineId, characterInfos });
    }),
  },

  SET_CHARACTER_INFOS: {
    mutation(
      state,
      {
        engineId,
        characterInfos,
      }: { engineId: string; characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos[engineId] = characterInfos;
    },
  },

  CHARACTER_INFO: {
    getter: (state) => (engineId, styleId) => {
      return getCharacterInfo(state, engineId, styleId);
    },
  },

  USER_ORDERED_CHARACTER_INFOS: {
    getter: (state, getters) => {
      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;
      return allCharacterInfos.size !== 0
        ? [...allCharacterInfos.values()].sort(
            (a, b) =>
              state.userCharacterOrder.indexOf(a.metas.speakerUuid) -
              state.userCharacterOrder.indexOf(b.metas.speakerUuid)
          )
        : undefined;
    },
  },

  GENERATE_AUDIO_KEY: {
    action() {
      const audioKey = uuidv4();
      audioElements[audioKey] = new Audio();
      return audioKey;
    },
  },

  SETUP_SPEAKER: {
    /**
     * AudioItemに設定される話者（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async action({ commit, dispatch }, { engineId, audioKey, styleId }) {
      const isInitialized = await dispatch("IS_INITIALIZED_ENGINE_SPEAKER", {
        engineId,
        styleId,
      });
      if (isInitialized) return;

      commit("SET_AUDIO_KEY_INITIALIZING_SPEAKER", {
        audioKey,
      });
      await dispatch("INITIALIZE_ENGINE_SPEAKER", {
        engineId,
        styleId,
      }).finally(() => {
        commit("SET_AUDIO_KEY_INITIALIZING_SPEAKER", {
          audioKey: undefined,
        });
      });
    },
  },

  SET_AUDIO_KEY_INITIALIZING_SPEAKER: {
    mutation(state, { audioKey }: { audioKey?: string }) {
      state.audioKeyInitializingSpeaker = audioKey;
    },
  },

  SET_ACTIVE_AUDIO_KEY: {
    mutation(state, { audioKey }: { audioKey?: string }) {
      state._activeAudioKey = audioKey;
    },
    action({ commit, dispatch }, { audioKey }: { audioKey?: string }) {
      commit("SET_ACTIVE_AUDIO_KEY", { audioKey });
      // reset audio play start point
      dispatch("SET_AUDIO_PLAY_START_POINT", { startPoint: undefined });
    },
  },

  SET_AUDIO_PLAY_START_POINT: {
    mutation(state, { startPoint }: { startPoint?: number }) {
      state.audioPlayStartPoint = startPoint;
    },
    action({ commit }, { startPoint }: { startPoint?: number }) {
      commit("SET_AUDIO_PLAY_START_POINT", { startPoint });
    },
  },

  SET_AUDIO_NOW_PLAYING: {
    mutation(
      state,
      { audioKey, nowPlaying }: { audioKey: string; nowPlaying: boolean }
    ) {
      state.audioStates[audioKey].nowPlaying = nowPlaying;
    },
  },

  SET_AUDIO_NOW_GENERATING: {
    mutation(
      state,
      { audioKey, nowGenerating }: { audioKey: string; nowGenerating: boolean }
    ) {
      state.audioStates[audioKey].nowGenerating = nowGenerating;
    },
  },

  SET_NOW_PLAYING_CONTINUOUSLY: {
    mutation(state, { nowPlaying }: { nowPlaying: boolean }) {
      state.nowPlayingContinuously = nowPlaying;
    },
  },

  GENERATE_AUDIO_ITEM: {
    async action(
      { state, getters, dispatch },
      payload: {
        text?: string;
        engineId?: string;
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
      if (getters.USER_ORDERED_CHARACTER_INFOS == undefined)
        throw new Error("state.characterInfos == undefined");
      const userOrderedCharacterInfos = getters.USER_ORDERED_CHARACTER_INFOS;

      const text = payload.text ?? "";

      const engineId = payload.engineId ?? state.engineIds[0];

      // FIXME: engineIdも含めて探査する
      const styleId =
        payload.styleId ??
        state.defaultStyleIds[
          state.defaultStyleIds.findIndex(
            (x) =>
              x.speakerUuid === userOrderedCharacterInfos[0].metas.speakerUuid // FIXME: defaultStyleIds内にspeakerUuidがない場合がある
          )
        ].defaultStyleId;
      const baseAudioItem = payload.baseAudioItem;

      const query = getters.IS_ENGINE_READY(engineId)
        ? await dispatch("FETCH_AUDIO_QUERY", {
            text,
            engineId,
            styleId,
          }).catch(() => undefined)
        : undefined;

      const audioItem: AudioItem = {
        text,
        engineId,
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
        audioItem.morphingInfo = baseAudioItem.morphingInfo;
      }
      return audioItem;
    },
  },

  REGISTER_AUDIO_ITEM: {
    async action(
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
  },

  INSERT_AUDIO_ITEM: {
    mutation(
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
  },

  INSERT_AUDIO_ITEMS: {
    mutation(
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
  },

  REMOVE_AUDIO_ITEM: {
    mutation(state, { audioKey }: { audioKey: string }) {
      state.audioKeys.splice(state.audioKeys.indexOf(audioKey), 1);
      delete state.audioItems[audioKey];
      delete state.audioStates[audioKey];
    },
  },

  SET_AUDIO_KEYS: {
    mutation(state, { audioKeys }: { audioKeys: string[] }) {
      state.audioKeys = audioKeys;
    },
  },

  REMOVE_ALL_AUDIO_ITEM: {
    action({ commit, state }) {
      for (const audioKey of [...state.audioKeys]) {
        commit("REMOVE_AUDIO_ITEM", { audioKey });
      }
    },
  },

  GET_AUDIO_CACHE: {
    async action({ state, dispatch }, { audioKey }: { audioKey: string }) {
      const audioItem = state.audioItems[audioKey];
      return dispatch("GET_AUDIO_CACHE_FROM_AUDIO_ITEM", { audioItem });
    },
  },

  GET_AUDIO_CACHE_FROM_AUDIO_ITEM: {
    async action({ state }, { audioItem }: { audioItem: AudioItem }) {
      const [id] = await generateUniqueIdAndQuery(state, audioItem);

      if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
        return audioBlobCache[id];
      } else {
        return null;
      }
    },
  },

  SET_AUDIO_TEXT: {
    mutation(state, { audioKey, text }: { audioKey: string; text: string }) {
      state.audioItems[audioKey].text = text;
    },
  },

  SET_AUDIO_SPEED_SCALE: {
    mutation(
      state,
      { audioKey, speedScale }: { audioKey: string; speedScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.speedScale = speedScale;
    },
  },

  SET_AUDIO_PITCH_SCALE: {
    mutation(
      state,
      { audioKey, pitchScale }: { audioKey: string; pitchScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.pitchScale = pitchScale;
    },
  },

  SET_AUDIO_INTONATION_SCALE: {
    mutation(
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
  },

  SET_AUDIO_VOLUME_SCALE: {
    mutation(
      state,
      { audioKey, volumeScale }: { audioKey: string; volumeScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.volumeScale = volumeScale;
    },
  },

  SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation(
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
  },

  SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation(
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
  },

  SET_MORPHING_INFO: {
    mutation(
      state,
      {
        audioKey,
        morphingInfo,
      }: { audioKey: string; morphingInfo: MorphingInfo | undefined }
    ) {
      const item = state.audioItems[audioKey];
      item.morphingInfo = morphingInfo;
    },
  },

  MORPHING_SUPPORTED_ENGINES: {
    getter: (state) =>
      state.engineIds.filter(
        (engineId) =>
          state.engineManifests[engineId].supportedFeatures?.synthesisMorphing
      ),
  },

  VALID_MOPHING_INFO: {
    getter: (_, getters) => (audioItem: AudioItem) => {
      if (
        audioItem.morphingInfo == undefined ||
        audioItem.engineId == undefined
      )
        return false;
      return (
        getters.MORPHING_SUPPORTED_ENGINES.includes(audioItem.engineId) &&
        audioItem.engineId === audioItem.morphingInfo.targetEngineId
      );
    },
  },

  SET_AUDIO_QUERY: {
    mutation(
      state,
      { audioKey, audioQuery }: { audioKey: string; audioQuery: AudioQuery }
    ) {
      state.audioItems[audioKey].query = audioQuery;
    },
    action({ commit }, payload: { audioKey: string; audioQuery: AudioQuery }) {
      commit("SET_AUDIO_QUERY", payload);
    },
  },

  FETCH_AUDIO_QUERY: {
    action(
      { dispatch },
      {
        text,
        engineId,
        styleId,
      }: { text: string; engineId: string; styleId: number }
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("audioQueryAudioQueryPost")({
            text,
            speaker: styleId,
          })
        )
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AudioQuery for the text "${text}".`
          );
          throw error;
        });
    },
  },

  SET_AUDIO_STYLE_ID: {
    mutation(
      state,
      {
        audioKey,
        engineId,
        styleId,
      }: { audioKey: string; engineId: string; styleId: number }
    ) {
      state.audioItems[audioKey].engineId = engineId;
      state.audioItems[audioKey].styleId = styleId;
    },
  },

  SET_ACCENT_PHRASES: {
    mutation(
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
  },

  FETCH_ACCENT_PHRASES: {
    action(
      { dispatch },
      {
        text,
        engineId,
        styleId,
        isKana,
      }: {
        text: string;
        engineId: string;
        styleId: number;
        isKana?: boolean;
      }
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("accentPhrasesAccentPhrasesPost")({
            text,
            speaker: styleId,
            isKana,
          })
        )
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed to fetch AccentPhrases for the text "${text}".`
          );
          throw error;
        });
    },
  },

  SET_SINGLE_ACCENT_PHRASE: {
    mutation(
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
  },

  SET_AUDIO_MORA_DATA: {
    mutation(
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

  APPLY_AUDIO_PRESET: {
    mutation(state, { audioKey }: { audioKey: string }) {
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
      const { name: _, morphingInfo, ...presetAudioInfos } = presetItem;

      // Type Assertion
      const audioInfos: Omit<
        AudioQuery,
        "accentPhrases" | "outputSamplingRate" | "outputStereo" | "kana"
      > = presetAudioInfos;

      audioItem.query = { ...audioItem.query, ...audioInfos };

      audioItem.morphingInfo = morphingInfo;
    },
  },

  FETCH_MORA_DATA: {
    action(
      { dispatch },
      {
        accentPhrases,
        engineId,
        styleId,
      }: { accentPhrases: AccentPhrase[]; engineId: string; styleId: number }
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("moraDataMoraDataPost")({
            accentPhrase: accentPhrases,
            speaker: styleId,
          })
        )
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
  },

  FETCH_AND_COPY_MORA_DATA: {
    async action(
      { dispatch },
      {
        accentPhrases,
        engineId,
        styleId,
        copyIndexes,
      }: {
        accentPhrases: AccentPhrase[];
        engineId: string;
        styleId: number;
        copyIndexes: number[];
      }
    ) {
      const fetchedAccentPhrases: AccentPhrase[] = await dispatch(
        "FETCH_MORA_DATA",
        {
          accentPhrases,
          engineId,
          styleId,
        }
      );
      for (const index of copyIndexes) {
        accentPhrases[index] = fetchedAccentPhrases[index];
      }
      return accentPhrases;
    },
  },

  GENERATE_LAB: {
    action: createUILockAction(
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
  },

  GET_AUDIO_PLAY_OFFSETS: {
    action({ state }, { audioKey }: { audioKey: string }) {
      const query = state.audioItems[audioKey].query;
      const accentPhrases = query?.accentPhrases;
      if (query === undefined || accentPhrases === undefined)
        throw Error("query === undefined or accentPhrases === undefined");

      const offsets: number[] = [];
      let length = 0;
      offsets.push(length);
      // pre phoneme lengthは最初のアクセント句の一部として扱う
      length += query.prePhonemeLength;
      let i = 0;
      for (const phrase of accentPhrases) {
        phrase.moras.forEach((m) => {
          length += m.consonantLength !== undefined ? m.consonantLength : 0;
          length += m.vowelLength;
        });
        length += phrase.pauseMora ? phrase.pauseMora.vowelLength : 0;
        // post phoneme lengthは最後のアクセント句の一部として扱う
        if (i === accentPhrases.length - 1) {
          length += query.postPhonemeLength;
        }
        offsets.push(length / query.speedScale);
        i++;
      }
      return offsets;
    },
  },

  GENERATE_AUDIO: {
    async action({ dispatch, state }, { audioKey }: { audioKey: string }) {
      const audioItem: AudioItem = JSON.parse(
        JSON.stringify(state.audioItems[audioKey])
      );
      return dispatch("GENERATE_AUDIO_FROM_AUDIO_ITEM", { audioItem });
    },
  },

  GENERATE_AUDIO_FROM_AUDIO_ITEM: {
    action: createUILockAction(
      async (
        { dispatch, getters, state },
        { audioItem }: { audioItem: AudioItem }
      ) => {
        const engineId = audioItem.engineId;
        if (engineId === undefined)
          throw new Error("engineId is not defined for audioItem");

        const [id, audioQuery] = await generateUniqueIdAndQuery(
          state,
          audioItem
        );
        if (audioQuery == undefined)
          throw new Error("audioQuery is not defined for audioItem");

        const speaker = audioItem.styleId;
        if (speaker == undefined)
          throw new Error("speaker is not defined for audioItem");

        const engineAudioQuery = convertAudioQueryFromEditorToEngine(
          audioQuery,
          state.engineManifests[engineId].defaultSamplingRate
        );

        return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        }).then(async (instance) => {
          let blob: Blob;
          // FIXME: モーフィングが設定で無効化されていてもモーフィングが行われるので気づけるUIを作成する
          if (audioItem.morphingInfo != undefined) {
            if (!getters.VALID_MOPHING_INFO(audioItem))
              throw new Error("VALID_MOPHING_ERROR"); //FIXME: エラーを変更した場合ハンドリング部分も修正する
            blob = await instance.invoke(
              "synthesisMorphingSynthesisMorphingPost"
            )({
              audioQuery: engineAudioQuery,
              baseSpeaker: speaker,
              targetSpeaker: audioItem.morphingInfo.targetStyleId,
              morphRate: audioItem.morphingInfo.rate,
            });
          } else {
            blob = await instance.invoke("synthesisSynthesisPost")({
              audioQuery: engineAudioQuery,
              speaker,
              enableInterrogativeUpspeak:
                state.experimentalSetting.enableInterrogativeUpspeak,
            });
          }
          audioBlobCache[id] = blob;
          return blob;
        });
      }
    ),
  },

  CONNECT_AUDIO: {
    action: createUILockAction(
      async (
        { dispatch, state },
        { encodedBlobs }: { encodedBlobs: string[] }
      ) => {
        const engineId: string | undefined = state.engineIds[0]; // TODO: 複数エンジン対応, 暫定的に音声結合機能は0番目のエンジンのみを使用する
        if (engineId === undefined)
          throw new Error(`No such engine registered: index == 0`);

        return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
          .then((instance) =>
            instance.invoke("connectWavesConnectWavesPost")({
              requestBody: encodedBlobs,
            })
          )
          .then(async (blob) => {
            return blob;
          })
          .catch((e) => {
            window.electron.logError(e);
            return null;
          });
      }
    ),
  },

  GENERATE_AND_SAVE_AUDIO: {
    action: createUILockAction(
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
          try {
            blob = await dispatch("GENERATE_AUDIO", { audioKey });
          } catch (e) {
            let errorMessage = undefined;
            // FIXME: GENERATE_AUDIO_FROM_AUDIO_ITEMのエラーを変えた場合変更する
            if (e instanceof Error && e.message === "VALID_MOPHING_ERROR") {
              errorMessage = "モーフィングの設定が無効です。";
            } else {
              window.electron.logError(e);
            }
            return {
              result: "ENGINE_ERROR",
              path: filePath,
              errorMessage,
            };
          }
        }

        let writeFileResult = await window.electron.writeFile({
          filePath,
          buffer: await blob.arrayBuffer(),
        }); // 失敗した場合、WriteFileErrorResultオブジェクトが返り、成功時はundefinedが反る
        if (writeFileResult) {
          window.electron.logError(new Error(writeFileResult.message));
          return {
            result: "WRITE_ERROR",
            path: filePath,
            errorMessage: generateWriteErrorMessage(writeFileResult),
          };
        }

        if (state.savingSetting.exportLab) {
          const labString = await dispatch("GENERATE_LAB", { audioKey });
          if (labString === undefined)
            return {
              result: "WRITE_ERROR",
              path: filePath,
              errorMessage: "labの生成に失敗しました。",
            };

          const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
          const labBlob = new Blob([bom, labString], {
            type: "text/plain;charset=UTF-8",
          });

          writeFileResult = await window.electron.writeFile({
            filePath: filePath.replace(/\.wav$/, ".lab"),
            buffer: await labBlob.arrayBuffer(),
          });
          if (writeFileResult) {
            window.electron.logError(new Error(writeFileResult.message));
            return {
              result: "WRITE_ERROR",
              path: filePath,
              errorMessage: generateWriteErrorMessage(writeFileResult),
            };
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

          writeFileResult = await window.electron.writeFile({
            filePath: filePath.replace(/\.wav$/, ".txt"),
            buffer: await textBlob.arrayBuffer(),
          });
          if (writeFileResult) {
            window.electron.logError(new Error(writeFileResult.message));
            return {
              result: "WRITE_ERROR",
              path: filePath,
              errorMessage: generateWriteErrorMessage(writeFileResult),
            };
          }
        }

        return { result: "SUCCESS", path: filePath };
      }
    ),
  },

  GENERATE_AND_SAVE_ALL_AUDIO: {
    action: createUILockAction(
      async (
        { state, dispatch },
        {
          dirPath,
          encoding,
          callback,
        }: {
          dirPath?: string;
          encoding?: EncodingType;
          callback?: (finishedCount: number, totalCount: number) => void;
        }
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

          const totalCount = state.audioKeys.length;
          let finishedCount = 0;

          const promises = state.audioKeys.map((audioKey) => {
            const name = buildFileName(state, audioKey);
            return dispatch("GENERATE_AND_SAVE_AUDIO", {
              audioKey,
              filePath: path.join(_dirPath, name),
              encoding,
            }).then((value) => {
              callback?.(++finishedCount, totalCount);
              return value;
            });
          });
          return Promise.all(promises);
        }
      }
    ),
  },

  GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
    action: createUILockAction(
      async (
        { state, dispatch },
        {
          filePath,
          encoding,
          callback,
        }: {
          filePath?: string;
          encoding?: EncodingType;
          callback?: (finishedCount: number, totalCount: number) => void;
        }
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

        const totalCount = state.audioKeys.length;
        let finishedCount = 0;

        for (const audioKey of state.audioKeys) {
          let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
          if (!blob) {
            try {
              blob = await dispatch("GENERATE_AUDIO", { audioKey });
            } catch (e) {
              let errorMessage = undefined;
              // FIXME: GENERATE_AUDIO_FROM_AUDIO_ITEMのエラーを変えた場合変更する
              if (e instanceof Error && e.message === "VALID_MOPHING_ERROR") {
                errorMessage = "モーフィングの設定が無効です。";
              } else {
                window.electron.logError(e);
              }
              return {
                result: "ENGINE_ERROR",
                path: filePath,
                errorMessage,
              };
            } finally {
              callback?.(++finishedCount, totalCount);
            }
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
  },

  CONNECT_AND_EXPORT_TEXT: {
    action: createUILockAction(
      async (
        { state, dispatch, getters },
        { filePath, encoding }: { filePath?: string; encoding?: EncodingType }
      ): Promise<SaveResultObject> => {
        const defaultFileName = buildProjectFileName(state, "txt");
        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultFileName
          );
        } else {
          filePath ??= await window.electron.showTextSaveDialog({
            title: "文章を全て繋げてテキストファイルに保存",
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

        const characters = new Map<string, string>();

        if (!getters.USER_ORDERED_CHARACTER_INFOS)
          throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

        for (const characterInfo of getters.USER_ORDERED_CHARACTER_INFOS) {
          for (const style of characterInfo.metas.styles) {
            characters.set(
              `${style.engineId}:${style.styleId}`, // FIXME: 入れ子のMapにする
              `${characterInfo.metas.speakerName}(${
                style.styleName || "ノーマル"
              })`
            );
          }
        }

        const texts: string[] = [];
        for (const audioKey of state.audioKeys) {
          const styleId = state.audioItems[audioKey].styleId;
          const engineId = state.audioItems[audioKey].engineId;
          if (!engineId) {
            throw new Error("engineId is undefined");
          }
          const speakerName =
            styleId !== undefined
              ? characters.get(`${engineId}:${styleId}`) + ","
              : "";

          texts.push(speakerName + state.audioItems[audioKey].text);
        }

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
            filePath: filePath,
            buffer: await textBlob.arrayBuffer(),
          });
        } catch (e) {
          window.electron.logError(e);
          return { result: "WRITE_ERROR", path: filePath };
        }

        return { result: "SUCCESS", path: filePath };
      }
    ),
  },

  PLAY_AUDIO: {
    action: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: string }) => {
        const audioElem = audioElements[audioKey];
        audioElem.pause();

        // 音声用意
        let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
        if (!blob) {
          commit("SET_AUDIO_NOW_GENERATING", {
            audioKey,
            nowGenerating: true,
          });
          try {
            blob = await withProgress(
              dispatch("GENERATE_AUDIO", { audioKey }),
              dispatch
            );
          } finally {
            commit("SET_AUDIO_NOW_GENERATING", {
              audioKey,
              nowGenerating: false,
            });
          }
        }

        return dispatch("PLAY_AUDIO_BLOB", {
          audioBlob: blob,
          audioElem,
          audioKey,
        });
      }
    ),
  },

  PLAY_AUDIO_BLOB: {
    action: createUILockAction(
      async (
        { state, commit, dispatch },
        {
          audioBlob,
          audioElem,
          audioKey,
        }: { audioBlob: Blob; audioElem: HTMLAudioElement; audioKey?: string }
      ) => {
        audioElem.src = URL.createObjectURL(audioBlob);
        // 途中再生用の処理
        if (audioKey) {
          const accentPhraseOffsets = await dispatch("GET_AUDIO_PLAY_OFFSETS", {
            audioKey,
          });
          if (accentPhraseOffsets.length === 0) {
            audioElem.currentTime = 0;
          } else {
            const startTime =
              accentPhraseOffsets[state.audioPlayStartPoint ?? 0];
            if (startTime === undefined) throw Error("startTime === undefined");
            // 小さい値が切り捨てられることでフォーカスされるアクセントフレーズが一瞬元に戻るので、
            // 再生に影響のない程度かつ切り捨てられない値を加算する
            audioElem.currentTime = startTime + 10e-6;
          }
        }

        audioElem
          .setSinkId(state.savingSetting.audioOutputDevice)
          .catch((err) => {
            const stop = () => {
              audioElem.pause();
              audioElem.removeEventListener("canplay", stop);
            };
            audioElem.addEventListener("canplay", stop);
            window.electron.showMessageDialog({
              type: "error",
              title: "エラー",
              message: "再生デバイスが見つかりません",
            });
            throw new Error(err);
          });

        // 再生終了時にresolveされるPromiseを返す
        const played = async () => {
          if (audioKey) {
            commit("SET_AUDIO_NOW_PLAYING", { audioKey, nowPlaying: true });
          }
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
          if (audioKey) {
            commit("SET_AUDIO_NOW_PLAYING", { audioKey, nowPlaying: false });
          }
        });

        audioElem.play();

        return audioPlayPromise;
      }
    ),
  },

  STOP_AUDIO: {
    action(_, { audioKey }: { audioKey: string }) {
      const audioElem = audioElements[audioKey];
      audioElem.pause();
    },
  },

  SET_AUDIO_PRESET_KEY: {
    mutation(
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
  },

  PLAY_CONTINUOUSLY_AUDIO: {
    action: createUILockAction(async ({ state, commit, dispatch }) => {
      const currentAudioKey = state._activeAudioKey;
      const currentAudioPlayStartPoint = state.audioPlayStartPoint;

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
        commit("SET_AUDIO_PLAY_START_POINT", {
          startPoint: currentAudioPlayStartPoint,
        });
        commit("SET_NOW_PLAYING_CONTINUOUSLY", { nowPlaying: false });
      }
    }),
  },

  STOP_CONTINUOUSLY_AUDIO: {
    action({ state, dispatch }) {
      for (const audioKey of state.audioKeys) {
        if (state.audioStates[audioKey].nowPlaying) {
          dispatch("STOP_AUDIO", { audioKey });
        }
      }
    },
  },

  OPEN_TEXT_EDIT_CONTEXT_MENU: {
    action() {
      window.electron.openTextEditContextMenu();
    },
  },

  CHECK_FILE_EXISTS: {
    action(_, { file }: { file: string }) {
      return window.electron.checkFileExists(file);
    },
  },
});

export const audioCommandStoreState: AudioCommandStoreState = {};

export const audioCommandStore = transformCommandStore(
  createPartialStore<AudioCommandStoreTypes>({
    COMMAND_REGISTER_AUDIO_ITEM: {
      mutation(
        draft,
        payload: {
          audioItem: AudioItem;
          audioKey: string;
          prevAudioKey: string | undefined;
          applyPreset: boolean;
        }
      ) {
        audioStore.mutations.INSERT_AUDIO_ITEM(draft, payload);
        if (payload.applyPreset) {
          audioStore.mutations.APPLY_AUDIO_PRESET(draft, {
            audioKey: payload.audioKey,
          });
        }
      },
      async action(
        { dispatch, commit },
        {
          audioItem,
          prevAudioKey,
          applyPreset,
        }: {
          audioItem: AudioItem;
          prevAudioKey: string | undefined;
          applyPreset: boolean;
        }
      ) {
        const audioKey = await dispatch("GENERATE_AUDIO_KEY");
        commit("COMMAND_REGISTER_AUDIO_ITEM", {
          audioItem,
          audioKey,
          prevAudioKey,
          applyPreset,
        });
        return audioKey;
      },
    },

    COMMAND_REMOVE_AUDIO_ITEM: {
      mutation(draft, payload: { audioKey: string }) {
        audioStore.mutations.REMOVE_AUDIO_ITEM(draft, payload);
      },
      action({ commit }, payload: { audioKey: string }) {
        commit("COMMAND_REMOVE_AUDIO_ITEM", payload);
      },
    },

    COMMAND_SET_AUDIO_KEYS: {
      mutation(draft, payload: { audioKeys: string[] }) {
        audioStore.mutations.SET_AUDIO_KEYS(draft, payload);
      },
      action({ commit }, payload: { audioKeys: string[] }) {
        commit("COMMAND_SET_AUDIO_KEYS", payload);
      },
    },

    COMMAND_CHANGE_AUDIO_TEXT: {
      mutation(
        draft,
        payload: { audioKey: string; text: string } & (
          | { update: "Text" }
          | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
          | { update: "AudioQuery"; query: AudioQuery }
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
      async action(
        { state, commit, dispatch },
        { audioKey, text }: { audioKey: string; text: string }
      ) {
        const engineId = state.audioItems[audioKey].engineId;
        if (engineId === undefined)
          throw new Error("assert engineId !== undefined");

        const styleId = state.audioItems[audioKey].styleId;
        if (styleId === undefined)
          throw new Error("assert styleId !== undefined");

        const query = state.audioItems[audioKey].query;
        try {
          if (query !== undefined) {
            const accentPhrases: AccentPhrase[] = await dispatch(
              "FETCH_ACCENT_PHRASES",
              {
                text,
                engineId,
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
              engineId,
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
    },

    COMMAND_CHANGE_STYLE_ID: {
      mutation(
        draft,
        payload: { engineId: string; styleId: number; audioKey: string } & (
          | { update: "StyleId" }
          | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
          | { update: "AudioQuery"; query: AudioQuery }
        )
      ) {
        audioStore.mutations.SET_AUDIO_STYLE_ID(draft, {
          audioKey: payload.audioKey,
          engineId: payload.engineId,
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
      async action(
        { state, dispatch, commit },
        {
          audioKey,
          engineId,
          styleId,
        }: { audioKey: string; engineId: string; styleId: number }
      ) {
        const query = state.audioItems[audioKey].query;
        try {
          await dispatch("SETUP_SPEAKER", { audioKey, engineId, styleId });

          if (query !== undefined) {
            const accentPhrases = query.accentPhrases;
            const newAccentPhrases: AccentPhrase[] = await dispatch(
              "FETCH_MORA_DATA",
              {
                accentPhrases,
                engineId,
                styleId,
              }
            );
            commit("COMMAND_CHANGE_STYLE_ID", {
              engineId,
              styleId,
              audioKey,
              update: "AccentPhrases",
              accentPhrases: newAccentPhrases,
            });
          } else {
            const text = state.audioItems[audioKey].text;
            const query: AudioQuery = await dispatch("FETCH_AUDIO_QUERY", {
              text: text,
              engineId,
              styleId,
            });
            commit("COMMAND_CHANGE_STYLE_ID", {
              engineId,
              styleId,
              audioKey,
              update: "AudioQuery",
              query,
            });
          }
        } catch (error) {
          commit("COMMAND_CHANGE_STYLE_ID", {
            engineId,
            styleId,
            audioKey,
            update: "StyleId",
          });
          throw error;
        }
      },
    },

    COMMAND_CHANGE_ACCENT: {
      mutation(
        draft,
        {
          audioKey,
          accentPhrases,
        }: { audioKey: string; accentPhrases: AccentPhrase[] }
      ) {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, {
          audioKey,
          accentPhrases,
        });
      },
      async action(
        { state, dispatch, commit },
        {
          audioKey,
          accentPhraseIndex,
          accent,
        }: { audioKey: string; accentPhraseIndex: number; accent: number }
      ) {
        const query = state.audioItems[audioKey].query;
        if (query !== undefined) {
          const newAccentPhrases: AccentPhrase[] = JSON.parse(
            JSON.stringify(query.accentPhrases)
          );
          newAccentPhrases[accentPhraseIndex].accent = accent;

          try {
            const engineId = state.audioItems[audioKey].engineId;
            if (engineId === undefined)
              throw new Error("assert engineId !== undefined");

            const styleId = state.audioItems[audioKey].styleId;
            if (styleId === undefined)
              throw new Error("assert styleId !== undefined");

            const resultAccentPhrases: AccentPhrase[] = await dispatch(
              "FETCH_AND_COPY_MORA_DATA",
              {
                accentPhrases: newAccentPhrases,
                engineId,
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
    },

    COMMAND_CHANGE_ACCENT_PHRASE_SPLIT: {
      mutation(
        draft,
        payload: {
          audioKey: string;
          accentPhrases: AccentPhrase[];
        }
      ) {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
      },
      async action(
        { state, dispatch, commit },
        payload: {
          audioKey: string;
          accentPhraseIndex: number;
        } & ({ isPause: false; moraIndex: number } | { isPause: true })
      ) {
        const { audioKey, accentPhraseIndex } = payload;
        const query = state.audioItems[audioKey].query;

        const engineId = state.audioItems[audioKey].engineId;
        if (engineId === undefined)
          throw new Error("assert engineId !== undefined");

        const styleId = state.audioItems[audioKey].styleId;
        if (styleId === undefined)
          throw new Error("assert styleId !== undefined");

        if (query === undefined) {
          throw Error(
            "`COMMAND_CHANGE_ACCENT_PHRASE_SPLIT` should not be called if the query does not exist."
          );
        }
        const newAccentPhrases: AccentPhrase[] = JSON.parse(
          JSON.stringify(query.accentPhrases)
        );
        const changeIndexes = [accentPhraseIndex];
        // toggleAccentPhrase to newAccentPhrases and record changeIndexes
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
              moras: accentPhrases[accentPhraseIndex].moras.slice(
                moraIndex + 1
              ),
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
              engineId,
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
    },

    COMMAND_CHANGE_SINGLE_ACCENT_PHRASE: {
      mutation(
        draft,
        payload: {
          audioKey: string;
          accentPhrases: AccentPhrase[];
        }
      ) {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
      },
      async action(
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
        const engineId = state.audioItems[audioKey].engineId;
        if (engineId === undefined)
          throw new Error("assert engineId !== undefined");

        const styleId = state.audioItems[audioKey].styleId;
        if (styleId === undefined)
          throw new Error("assert styleId !== undefined");

        let newAccentPhrasesSegment: AccentPhrase[] | undefined = undefined;

        const kanaRegex = createKanaRegex(true);
        if (kanaRegex.test(newPronunciation)) {
          // ひらがなが混ざっている場合はカタカナに変換
          const katakana = convertHiraToKana(newPronunciation);
          // 長音を適切な音に変換
          const pureKatakana = convertLongVowel(katakana);

          // アクセントを各句の末尾につける
          // 文中に「？、」「、」がある場合は、そこで句切りとみなす
          const pureKatakanaWithAccent = pureKatakana.replace(
            /(？、|、|(?<=[^？、])$|？$)/g,
            "'$1"
          );

          // accent phraseの生成をリクエスト
          // 判別できない読み仮名が混じっていた場合400エラーが帰るのでfallback
          newAccentPhrasesSegment = await dispatch("FETCH_ACCENT_PHRASES", {
            text: pureKatakanaWithAccent,
            engineId,
            styleId,
            isKana: true,
          }).catch(
            // fallback
            () =>
              dispatch("FETCH_ACCENT_PHRASES", {
                text: newPronunciation,
                engineId,
                styleId,
                isKana: false,
              })
          );
        } else {
          newAccentPhrasesSegment = await dispatch("FETCH_ACCENT_PHRASES", {
            text: newPronunciation,
            engineId,
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

        // https://github.com/VOICEVOX/voicevox/issues/248
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
              engineId,
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
    },

    COMMAND_RESET_MORA_PITCH_AND_LENGTH: {
      async action({ state, dispatch, commit }, { audioKey }) {
        const engineId = state.audioItems[audioKey].engineId;
        if (engineId === undefined)
          throw new Error("assert engineId !== undefined");

        const styleId = state.audioItems[audioKey].styleId;
        if (styleId === undefined)
          throw new Error("assert styleId !== undefined");

        const query = state.audioItems[audioKey].query;
        if (query === undefined) throw new Error("assert query !== undefined");

        const newAccentPhases = await dispatch("FETCH_MORA_DATA", {
          accentPhrases: query.accentPhrases,
          engineId,
          styleId,
        });

        commit("COMMAND_CHANGE_ACCENT", {
          audioKey,
          accentPhrases: newAccentPhases,
        });
      },
    },

    COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH: {
      async action(
        { state, dispatch, commit },
        { audioKey, accentPhraseIndex }
      ) {
        const engineId = state.audioItems[audioKey].engineId;
        if (engineId == undefined) throw new Error("engineId == undefined");

        const styleId = state.audioItems[audioKey].styleId;
        if (styleId == undefined) throw new Error("styleId == undefined");

        const query = state.audioItems[audioKey].query;
        if (query == undefined) throw new Error("query == undefined");

        const newAccentPhases = await dispatch("FETCH_AND_COPY_MORA_DATA", {
          accentPhrases: [...query.accentPhrases],
          engineId,
          styleId,
          copyIndexes: [accentPhraseIndex],
        });

        commit("COMMAND_CHANGE_ACCENT", {
          audioKey,
          accentPhrases: newAccentPhases,
        });
      },
    },

    COMMAND_SET_AUDIO_MORA_DATA: {
      mutation(
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
      action(
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
    },

    COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE: {
      mutation(
        draft,
        payload: {
          audioKey: string;
          accentPhraseIndex: number;
          moraIndex: number;
          data: number;
          type: MoraDataType;
        }
      ) {
        const maxPitch = 6.5;
        const minPitch = 3;
        const maxMoraLength = 0.3;
        const minMoraLength = 0;
        const { audioKey, accentPhraseIndex, moraIndex, data, type } = payload;
        const audioItem = draft.audioItems[audioKey];
        if (audioItem.query === undefined) {
          throw Error("draft.audioItems[audioKey].query === undefined");
        }
        const accentPhrase = audioItem.query.accentPhrases[accentPhraseIndex];
        const targetMora = accentPhrase.moras[moraIndex];

        let diffData = data;
        switch (type) {
          case "pitch":
            diffData -= targetMora.pitch;
            break;
          case "consonant":
            if (targetMora.consonantLength !== undefined) {
              diffData -= targetMora.consonantLength;
            }
            break;
          case "vowel":
            diffData -= targetMora.vowelLength;
            break;
        }

        accentPhrase.moras.forEach((mora, moraIndex) => {
          switch (type) {
            case "pitch":
              if (mora.pitch > 0) {
                const newData = Math.max(
                  minPitch,
                  Math.min(maxPitch, mora.pitch + diffData)
                );
                audioStore.mutations.SET_AUDIO_MORA_DATA(draft, {
                  audioKey,
                  accentPhraseIndex,
                  moraIndex,
                  data: newData,
                  type,
                });
              }
              break;
            case "consonant":
            case "vowel":
              if (mora.consonantLength !== undefined) {
                audioStore.mutations.SET_AUDIO_MORA_DATA(draft, {
                  audioKey,
                  accentPhraseIndex,
                  moraIndex,
                  data: Math.max(
                    minMoraLength,
                    Math.min(maxMoraLength, mora.consonantLength + diffData)
                  ),
                  type: "consonant",
                });
              }
              audioStore.mutations.SET_AUDIO_MORA_DATA(draft, {
                audioKey,
                accentPhraseIndex,
                moraIndex,
                data: Math.max(
                  minMoraLength,
                  Math.min(maxMoraLength, mora.vowelLength + diffData)
                ),
                type: "vowel",
              });
              break;
          }
        });
      },
      action(
        { commit },
        payload: {
          audioKey: string;
          accentPhraseIndex: number;
          moraIndex: number;
          data: number;
          type: MoraDataType;
        }
      ) {
        commit("COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE", payload);
      },
    },

    COMMAND_SET_AUDIO_SPEED_SCALE: {
      mutation(draft, payload: { audioKey: string; speedScale: number }) {
        audioStore.mutations.SET_AUDIO_SPEED_SCALE(draft, payload);
      },
      action({ commit }, payload: { audioKey: string; speedScale: number }) {
        commit("COMMAND_SET_AUDIO_SPEED_SCALE", payload);
      },
    },

    COMMAND_SET_AUDIO_PITCH_SCALE: {
      mutation(draft, payload: { audioKey: string; pitchScale: number }) {
        audioStore.mutations.SET_AUDIO_PITCH_SCALE(draft, payload);
      },
      action({ commit }, payload: { audioKey: string; pitchScale: number }) {
        commit("COMMAND_SET_AUDIO_PITCH_SCALE", payload);
      },
    },

    COMMAND_SET_AUDIO_INTONATION_SCALE: {
      mutation(draft, payload: { audioKey: string; intonationScale: number }) {
        audioStore.mutations.SET_AUDIO_INTONATION_SCALE(draft, payload);
      },
      action(
        { commit },
        payload: { audioKey: string; intonationScale: number }
      ) {
        commit("COMMAND_SET_AUDIO_INTONATION_SCALE", payload);
      },
    },

    COMMAND_SET_AUDIO_VOLUME_SCALE: {
      mutation(draft, payload: { audioKey: string; volumeScale: number }) {
        audioStore.mutations.SET_AUDIO_VOLUME_SCALE(draft, payload);
      },
      action({ commit }, payload: { audioKey: string; volumeScale: number }) {
        commit("COMMAND_SET_AUDIO_VOLUME_SCALE", payload);
      },
    },

    COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH: {
      mutation(draft, payload: { audioKey: string; prePhonemeLength: number }) {
        audioStore.mutations.SET_AUDIO_PRE_PHONEME_LENGTH(draft, payload);
      },
      action(
        { commit },
        payload: { audioKey: string; prePhonemeLength: number }
      ) {
        commit("COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH", payload);
      },
    },

    COMMAND_SET_AUDIO_POST_PHONEME_LENGTH: {
      mutation(
        draft,
        payload: { audioKey: string; postPhonemeLength: number }
      ) {
        audioStore.mutations.SET_AUDIO_POST_PHONEME_LENGTH(draft, payload);
      },
      action(
        { commit },
        payload: { audioKey: string; postPhonemeLength: number }
      ) {
        commit("COMMAND_SET_AUDIO_POST_PHONEME_LENGTH", payload);
      },
    },

    COMMAND_SET_MORPHING_INFO: {
      mutation(
        draft,
        payload: {
          audioKey: string;
          morphingInfo: MorphingInfo | undefined;
        }
      ) {
        audioStore.mutations.SET_MORPHING_INFO(draft, payload);
      },
      action(
        { commit },
        payload: {
          audioKey: string;
          morphingInfo: MorphingInfo | undefined;
        }
      ) {
        commit("COMMAND_SET_MORPHING_INFO", payload);
      },
    },

    COMMAND_SET_AUDIO_PRESET: {
      mutation(
        draft,
        {
          audioKey,
          presetKey,
        }: { audioKey: string; presetKey: string | undefined }
      ) {
        audioStore.mutations.SET_AUDIO_PRESET_KEY(draft, {
          audioKey,
          presetKey,
        });
        audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
      },
      action(
        { commit },
        {
          audioKey,
          presetKey,
        }: { audioKey: string; presetKey: string | undefined }
      ) {
        commit("COMMAND_SET_AUDIO_PRESET", { audioKey, presetKey });
      },
    },

    COMMAND_APPLY_AUDIO_PRESET: {
      mutation(draft, payload: { audioKey: string }) {
        audioStore.mutations.APPLY_AUDIO_PRESET(draft, payload);
      },
      action({ commit }, payload: { audioKey: string }) {
        commit("COMMAND_APPLY_AUDIO_PRESET", payload);
      },
    },

    COMMAND_FULLY_APPLY_AUDIO_PRESET: {
      mutation(draft, { presetKey }: { presetKey: string }) {
        const targetAudioKeys = draft.audioKeys.filter(
          (audioKey) => draft.audioItems[audioKey].presetKey === presetKey
        );
        for (const audioKey of targetAudioKeys) {
          audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
        }
      },
      action({ commit }, payload: { presetKey: string }) {
        commit("COMMAND_FULLY_APPLY_AUDIO_PRESET", payload);
      },
    },

    COMMAND_IMPORT_FROM_FILE: {
      mutation(
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
      action: createUILockAction(
        async (
          { state, commit, dispatch, getters },
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

          if (!getters.USER_ORDERED_CHARACTER_INFOS)
            throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
          for (const { text, engineId, styleId } of parseTextFile(
            body,
            state.defaultStyleIds,
            getters.USER_ORDERED_CHARACTER_INFOS
          )) {
            //パラメータ引き継ぎがONの場合は話速等のパラメータを引き継いでテキスト欄を作成する
            //パラメータ引き継ぎがOFFの場合、baseAudioItemがundefinedになっているのでパラメータ引き継ぎは行われない
            audioItems.push(
              await dispatch("GENERATE_AUDIO_ITEM", {
                text,
                engineId,
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
    },

    COMMAND_PUT_TEXTS: {
      mutation(
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
      action: createUILockAction(
        async (
          { state, commit, dispatch },
          {
            prevAudioKey,
            texts,
            engineId,
            styleId,
          }: {
            prevAudioKey: string;
            texts: string[];
            engineId: string;
            styleId: number;
          }
        ) => {
          const audioKeyItemPairs: {
            audioKey: string;
            audioItem: AudioItem;
          }[] = [];
          let baseAudioItem: AudioItem | undefined = undefined;
          let basePresetKey: string | undefined = undefined;
          if (state.inheritAudioInfo && state._activeAudioKey) {
            baseAudioItem = state.audioItems[state._activeAudioKey];
            basePresetKey = baseAudioItem.presetKey;
          }
          for (const text of texts.filter((value) => value != "")) {
            const audioKey: string = await dispatch("GENERATE_AUDIO_KEY");
            //パラメータ引き継ぎがONの場合は話速等のパラメータを引き継いでテキスト欄を作成する
            //パラメータ引き継ぎがOFFの場合、baseAudioItemがundefinedになっているのでパラメータ引き継ぎは行われない
            const audioItem = await dispatch("GENERATE_AUDIO_ITEM", {
              text,
              engineId,
              styleId,
              baseAudioItem,
              presetKey: basePresetKey,
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
  })
);
