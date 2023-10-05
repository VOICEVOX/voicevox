import path from "path";
import { v4 as uuidv4 } from "uuid";
import Encoding from "encoding-japanese";
import { diffArrays } from "diff";
import { toRaw } from "vue";
import { createUILockAction, withProgress } from "./ui";
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
import {
  buildAudioFileNameFromRawData,
  isAccentPhrasesTextDifferent,
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
  currentDateString,
  extractExportText,
  extractYomiText,
  sanitizeFileName,
  DEFAULT_STYLE_NAME,
  formatCharacterStyleName,
  joinTextsInAccentPhrases,
} from "./utility";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import { createPartialStore } from "./vuex";
import { determineNextPresetKey } from "./preset";
import {
  AudioKey,
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  EngineId,
  MoraDataType,
  MorphingInfo,
  Preset,
  PresetKey,
  SpeakerId,
  StyleId,
  StyleInfo,
  Voice,
} from "@/type/preload";
import { AudioQuery, AccentPhrase, Speaker, SpeakerInfo } from "@/openapi";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { getValueOrThrow, ResultError } from "@/type/result";

function generateAudioKey() {
  return AudioKey(uuidv4());
}

async function generateUniqueIdAndQuery(
  state: State,
  audioItem: AudioItem
): Promise<[string, EditorAudioQuery | undefined]> {
  audioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = audioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate =
      state.engineSettings[audioItem.voice.engineId].outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
  }

  const data = new TextEncoder().encode(
    JSON.stringify([
      audioItem.text,
      audioQuery,
      audioItem.voice,
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
  userOrderedCharacterInfos: CharacterInfo[],
  initVoice?: Voice
): AudioItem[] {
  const name2Voice = new Map<string, Voice>();
  const uuid2Voice = new Map<SpeakerId, Voice>();
  for (const defaultStyleId of defaultStyleIds) {
    const speakerId = defaultStyleId.speakerUuid;
    const engineId = defaultStyleId.engineId;
    const styleId = defaultStyleId.defaultStyleId;
    uuid2Voice.set(speakerId, { engineId, speakerId, styleId });
  }
  // setup default characters
  for (const characterInfo of userOrderedCharacterInfos) {
    const uuid = characterInfo.metas.speakerUuid;
    const voice = uuid2Voice.get(uuid);
    const speakerName = characterInfo.metas.speakerName;
    if (voice == undefined)
      throw new Error(`style is undefined. speakerUuid: ${uuid}`);
    name2Voice.set(speakerName, voice);
  }
  // setup characters with style name
  for (const characterInfo of userOrderedCharacterInfos) {
    const characterName = characterInfo.metas.speakerName;
    for (const style of characterInfo.metas.styles) {
      const styleName = style.styleName;
      const voice = {
        engineId: style.engineId,
        speakerId: characterInfo.metas.speakerUuid,
        styleId: style.styleId,
      };
      name2Voice.set(formatCharacterStyleName(characterName, styleName), voice);
      // 古いフォーマットにも対応するため
      name2Voice.set(
        `${characterName}(${styleName || DEFAULT_STYLE_NAME})`,
        voice
      );
    }
  }
  if (!name2Voice.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastVoice =
    initVoice ?? uuid2Voice.get(userOrderedCharacterInfos[0].metas.speakerUuid);
  if (lastVoice == undefined) throw new Error(`lastStyle is undefined.`);
  for (const splitText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const voice = name2Voice.get(splitText);
    if (voice !== undefined) {
      lastVoice = voice;
      continue;
    }

    audioItems.push({ text: splitText, voice: lastVoice });
  }
  return audioItems;
}

async function changeFileTailToNonExistent(
  filePath: string,
  extension: string
) {
  let tail = 1;
  const name = filePath.slice(0, filePath.length - 1 - extension.length);
  while (await window.electron.checkFileExists(filePath)) {
    filePath = `${name}[${tail}].${extension}`;
    tail += 1;
  }
  return filePath;
}

export async function writeTextFile(obj: {
  filePath: string;
  text: string;
  encoding?: EncodingType;
}) {
  obj.encoding ??= "UTF-8";

  const textBlob = {
    "UTF-8": (text: string) => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      return new Blob([bom, text], {
        type: "text/plain;charset=UTF-8",
      });
    },
    Shift_JIS: (text: string) => {
      const sjisArray = Encoding.convert(Encoding.stringToCode(text), {
        to: "SJIS",
        type: "arraybuffer",
      });
      return new Blob([new Uint8Array(sjisArray)], {
        type: "text/plain;charset=Shift_JIS",
      });
    },
  }[obj.encoding](obj.text);

  return window.electron.writeFile({
    filePath: obj.filePath,
    buffer: await textBlob.arrayBuffer(),
  });
}

function generateWriteErrorMessage(writeFileResult: ResultError) {
  if (writeFileResult.code) {
    const code = writeFileResult.code.toUpperCase();

    if (code.startsWith("ENOSPC")) {
      return "空き容量が足りません。";
    }

    if (code.startsWith("EACCES")) {
      return "ファイルにアクセスする許可がありません。";
    }

    if (code.startsWith("EBUSY")) {
      return "ファイルが開かれています。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
}

// TODO: GETTERに移動する。
export function getCharacterInfo(
  state: State,
  engineId: EngineId,
  styleId: StyleId
): CharacterInfo | undefined {
  const engineCharacterInfos = state.characterInfos[engineId];

  // (engineId, styleId)で「スタイル付きキャラクター」は一意である
  return engineCharacterInfos.find((characterInfo) =>
    characterInfo.metas.styles.some(
      (characterStyle) => characterStyle.styleId === styleId
    )
  );
}

/**
 * 与えたAudioItemを元に、Presetを適用した新しいAudioItemを返す
 */
export function applyAudioPresetToAudioItem(
  audioItem: AudioItem,
  presetItem: Preset
): AudioItem {
  if (audioItem.query == undefined) {
    throw new Error("audioItem.query is undefined");
  }

  // Filter name property from presetItem in order to extract audioInfos.
  const { name: _, morphingInfo, ...presetAudioInfos } = presetItem;

  // Type Assertion
  const audioInfos: Omit<
    AudioQuery,
    "accentPhrases" | "outputSamplingRate" | "outputStereo" | "kana"
  > = presetAudioInfos;

  const newAudioItem = { ...audioItem };
  newAudioItem.query = { ...audioItem.query, ...audioInfos };
  newAudioItem.morphingInfo = morphingInfo ? { ...morphingInfo } : undefined;

  return newAudioItem;
}

const audioBlobCache: Record<string, Blob> = {};

export const audioStoreState: AudioStoreState = {
  characterInfos: {},
  audioKeysWithInitializingSpeaker: [],
  morphableTargetsInfo: {},
  audioItems: {},
  audioKeys: [],
  audioStates: {},
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

  SELECTED_AUDIO_KEYS: {
    getter(state) {
      return (
        //  undo/redoで消えていることがあるためフィルタする
        state._selectedAudioKeys?.filter((audioKey) =>
          state.audioKeys.includes(audioKey)
        ) || []
      );
    },
  },

  /**
   * audio elementの再生オフセット。
   * 選択+削除 や 挿入+選択+元に戻す などを行った場合でも範囲外にならないようにクランプする。
   * ACTIVE_AUDIO_KEYがundefinedのときはundefinedを返す。
   */
  AUDIO_PLAY_START_POINT: {
    getter(state, getters) {
      const audioPlayStartPoint = state._audioPlayStartPoint;
      if (
        audioPlayStartPoint == undefined ||
        getters.ACTIVE_AUDIO_KEY == undefined
      ) {
        return undefined;
      }
      const length =
        state.audioItems[getters.ACTIVE_AUDIO_KEY].query?.accentPhrases.length;
      if (length == undefined) {
        return undefined;
      }
      return Math.max(0, Math.min(length - 1, audioPlayStartPoint));
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
            styleId: StyleId(style.id),
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
            speakerUuid: SpeakerId(speaker.speakerUuid),
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
      }: { engineId: EngineId; characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos[engineId] = characterInfos;
    },
  },

  LOAD_MORPHABLE_TARGETS: {
    async action({ state, dispatch, commit }, { engineId, baseStyleId }) {
      if (!state.engineManifests[engineId].supportedFeatures?.synthesisMorphing)
        return;

      if (state.morphableTargetsInfo[engineId]?.[baseStyleId]) return;

      const rawMorphableTargets = (
        await (
          await dispatch("INSTANTIATE_ENGINE_CONNECTOR", { engineId })
        ).invoke("morphableTargetsMorphableTargetsPost")({
          requestBody: [baseStyleId],
        })
      )[0];

      // FIXME: 何故かis_morphableがCamelCaseに変換されないので変換する必要がある
      const morphableTargets = Object.fromEntries(
        Object.entries(rawMorphableTargets).map(([key, value]) => {
          const isMorphable = (value as unknown as { is_morphable: boolean })
            .is_morphable;
          if (isMorphable === undefined || typeof isMorphable !== "boolean") {
            throw Error(
              "The is_morphable property does not exist, it is either CamelCase or the engine type is wrong."
            );
          }
          return [
            parseInt(key),
            {
              ...value,
              isMorphable,
            },
          ];
        })
      );

      commit("SET_MORPHABLE_TARGETS", {
        engineId,
        baseStyleId,
        morphableTargets,
      });
    },
  },

  SET_MORPHABLE_TARGETS: {
    mutation(state, { engineId, baseStyleId, morphableTargets }) {
      if (!state.morphableTargetsInfo[engineId]) {
        state.morphableTargetsInfo[engineId] = {};
      }
      state.morphableTargetsInfo[engineId][baseStyleId] = morphableTargets;
    },
  },

  CHARACTER_INFO: {
    getter: (state) => (engineId, styleId) => {
      return getCharacterInfo(state, engineId, styleId);
    },
  },

  VOICE_NAME: {
    getter: (_state, getters) => (voice: Voice) => {
      const characterInfo = getters.CHARACTER_INFO(
        voice.engineId,
        voice.styleId
      );
      if (characterInfo === undefined)
        throw new Error("assert characterInfo !== undefined");

      const style = characterInfo.metas.styles.find(
        (style) => style.styleId === voice.styleId
      );
      if (style === undefined) throw new Error("assert style !== undefined");

      const speakerName = characterInfo.metas.speakerName;
      const styleName = style.styleName;
      return formatCharacterStyleName(speakerName, styleName);
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

  SETUP_SPEAKER: {
    /**
     * AudioItemに設定される話者（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async action({ commit, dispatch }, { engineId, audioKeys, styleId }) {
      const isInitialized = await dispatch("IS_INITIALIZED_ENGINE_SPEAKER", {
        engineId,
        styleId,
      });
      if (isInitialized) return;

      commit("SET_AUDIO_KEYS_WITH_INITIALIZING_SPEAKER", {
        audioKeys,
      });
      await dispatch("INITIALIZE_ENGINE_SPEAKER", {
        engineId,
        styleId,
      }).finally(() => {
        commit("SET_AUDIO_KEYS_WITH_INITIALIZING_SPEAKER", {
          audioKeys: [],
        });
      });
    },
  },

  SET_AUDIO_KEYS_WITH_INITIALIZING_SPEAKER: {
    mutation(state, { audioKeys }: { audioKeys: AudioKey[] }) {
      state.audioKeysWithInitializingSpeaker = audioKeys;
    },
  },

  SET_ACTIVE_AUDIO_KEY: {
    mutation(state, { audioKey }: { audioKey?: AudioKey }) {
      state._activeAudioKey = audioKey;
    },
    action({ commit, dispatch }, { audioKey }: { audioKey?: AudioKey }) {
      commit("SET_ACTIVE_AUDIO_KEY", { audioKey });
      // reset audio play start point
      dispatch("SET_AUDIO_PLAY_START_POINT", { startPoint: undefined });
    },
  },

  SET_SELECTED_AUDIO_KEYS: {
    mutation(state, { audioKeys }: { audioKeys?: AudioKey[] }) {
      state._selectedAudioKeys = audioKeys;
    },
    action(
      { state, commit, getters },
      { audioKeys }: { audioKeys?: AudioKey[] }
    ) {
      const uniqueAudioKeys = new Set(audioKeys);
      if (
        getters.ACTIVE_AUDIO_KEY &&
        !uniqueAudioKeys.has(getters.ACTIVE_AUDIO_KEY)
      ) {
        throw new Error("selectedAudioKeys must include activeAudioKey");
      }
      const sortedAudioKeys = state.audioKeys.filter((audioKey) =>
        uniqueAudioKeys.has(audioKey)
      );
      commit("SET_SELECTED_AUDIO_KEYS", { audioKeys: sortedAudioKeys });
    },
  },

  SET_AUDIO_PLAY_START_POINT: {
    mutation(state, { startPoint }: { startPoint?: number }) {
      state._audioPlayStartPoint = startPoint;
    },
    action({ commit }, { startPoint }: { startPoint?: number }) {
      commit("SET_AUDIO_PLAY_START_POINT", { startPoint });
    },
  },

  SET_AUDIO_NOW_GENERATING: {
    mutation(
      state,
      {
        audioKey,
        nowGenerating,
      }: { audioKey: AudioKey; nowGenerating: boolean }
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
        voice?: Voice;
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

      const text = payload.text ?? "";

      const defaultSpeakerId =
        getters.USER_ORDERED_CHARACTER_INFOS[0].metas.speakerUuid;
      const defaultStyleId = state.defaultStyleIds.find(
        (styleId) => styleId.speakerUuid === defaultSpeakerId
      );
      if (defaultStyleId == undefined)
        throw new Error("defaultStyleId == undefined");

      const voice = payload.voice ?? {
        engineId: defaultStyleId.engineId,
        speakerId: defaultStyleId.speakerUuid,
        styleId: defaultStyleId.defaultStyleId,
      };

      const baseAudioItem = payload.baseAudioItem;

      const query = getters.IS_ENGINE_READY(voice.engineId)
        ? await dispatch("FETCH_AUDIO_QUERY", {
            text,
            engineId: voice.engineId,
            styleId: voice.styleId,
          }).catch(() => undefined)
        : undefined;

      const newAudioItem: AudioItem = { text, voice };
      if (query != undefined) {
        newAudioItem.query = query;
      }

      const presetKeyCandidate = payload.baseAudioItem?.presetKey;

      const { nextPresetKey, shouldApplyPreset } = determineNextPresetKey(
        state,
        voice,
        presetKeyCandidate,
        baseAudioItem ? "copy" : "generate"
      );
      newAudioItem.presetKey = nextPresetKey;

      // audioItemに対してプリセットを適用する
      if (shouldApplyPreset) {
        if (nextPresetKey) {
          const preset = state.presetItems[nextPresetKey];
          return applyAudioPresetToAudioItem(newAudioItem, preset);
        }
      }

      // プリセットを適用しないならパラメータを引き継ぐ
      if (
        state.inheritAudioInfo &&
        baseAudioItem &&
        baseAudioItem.query &&
        newAudioItem.query
      ) {
        //引数にbaseAudioItemがある場合、話速等のパラメータを引き継いだAudioItemを返す
        //baseAudioItem.queryが未設定の場合は引き継がない(起動直後等？)
        newAudioItem.query.speedScale = baseAudioItem.query.speedScale;
        newAudioItem.query.pitchScale = baseAudioItem.query.pitchScale;
        newAudioItem.query.intonationScale =
          baseAudioItem.query.intonationScale;
        newAudioItem.query.volumeScale = baseAudioItem.query.volumeScale;
        newAudioItem.query.prePhonemeLength =
          baseAudioItem.query.prePhonemeLength;
        newAudioItem.query.postPhonemeLength =
          baseAudioItem.query.postPhonemeLength;
        newAudioItem.query.outputSamplingRate =
          baseAudioItem.query.outputSamplingRate;
        newAudioItem.query.outputStereo = baseAudioItem.query.outputStereo;
        newAudioItem.morphingInfo = baseAudioItem.morphingInfo
          ? { ...baseAudioItem.morphingInfo }
          : undefined;
      }

      return newAudioItem;
    },
  },

  REGISTER_AUDIO_ITEM: {
    async action(
      { commit },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey?: AudioKey }
    ) {
      const audioKey = generateAudioKey();
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
        audioKey: AudioKey;
        prevAudioKey: AudioKey | undefined;
      }
    ) {
      const index =
        prevAudioKey !== undefined
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      state.audioKeys.splice(index, 0, audioKey);
      state.audioItems[audioKey] = audioItem;
      state.audioStates[audioKey] = {
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
        audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
        prevAudioKey: AudioKey | undefined;
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
          nowGenerating: false,
        };
      }
    },
  },

  REMOVE_AUDIO_ITEM: {
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      state.audioKeys.splice(state.audioKeys.indexOf(audioKey), 1);
      delete state.audioItems[audioKey];
      delete state.audioStates[audioKey];
    },
  },

  SET_AUDIO_KEYS: {
    mutation(state, { audioKeys }: { audioKeys: AudioKey[] }) {
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
    async action({ state, dispatch }, { audioKey }: { audioKey: AudioKey }) {
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
    mutation(state, { audioKey, text }: { audioKey: AudioKey; text: string }) {
      state.audioItems[audioKey].text = text;
    },
  },

  SET_AUDIO_SPEED_SCALE: {
    mutation(
      state,
      { audioKey, speedScale }: { audioKey: AudioKey; speedScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.speedScale = speedScale;
    },
  },

  SET_AUDIO_PITCH_SCALE: {
    mutation(
      state,
      { audioKey, pitchScale }: { audioKey: AudioKey; pitchScale: number }
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
      }: { audioKey: AudioKey; intonationScale: number }
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.intonationScale = intonationScale;
    },
  },

  SET_AUDIO_VOLUME_SCALE: {
    mutation(
      state,
      { audioKey, volumeScale }: { audioKey: AudioKey; volumeScale: number }
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
      }: { audioKey: AudioKey; prePhonemeLength: number }
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
      }: { audioKey: AudioKey; postPhonemeLength: number }
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
      }: { audioKey: AudioKey; morphingInfo: MorphingInfo | undefined }
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

  VALID_MORPHING_INFO: {
    getter: (state) => (audioItem: AudioItem) => {
      if (audioItem.morphingInfo?.targetStyleId == undefined) return false;
      const { engineId, styleId } = audioItem.voice;
      const info =
        state.morphableTargetsInfo[engineId]?.[styleId]?.[
          audioItem.morphingInfo.targetStyleId
        ];
      if (info == undefined) return false;
      return info.isMorphable;
    },
  },

  SET_AUDIO_QUERY: {
    mutation(
      state,
      { audioKey, audioQuery }: { audioKey: AudioKey; audioQuery: AudioQuery }
    ) {
      state.audioItems[audioKey].query = audioQuery;
    },
    action(
      { commit },
      payload: { audioKey: AudioKey; audioQuery: AudioQuery }
    ) {
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
      }: { text: string; engineId: EngineId; styleId: StyleId }
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

  SET_AUDIO_VOICE: {
    mutation(state, { audioKey, voice }: { audioKey: AudioKey; voice: Voice }) {
      state.audioItems[audioKey].voice = voice;
    },
  },

  SET_ACCENT_PHRASES: {
    mutation(
      state,
      {
        audioKey,
        accentPhrases,
      }: { audioKey: AudioKey; accentPhrases: AccentPhrase[] }
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
        engineId: EngineId;
        styleId: StyleId;
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
        audioKey: AudioKey;
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
        audioKey: AudioKey;
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
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      const audioItem = state.audioItems[audioKey];

      if (!audioItem.presetKey) return;

      const presetItem = state.presetItems[audioItem.presetKey];
      const newAudioItem = applyAudioPresetToAudioItem(audioItem, presetItem);

      state.audioItems[audioKey] = newAudioItem;
    },
  },

  FETCH_MORA_DATA: {
    action(
      { dispatch },
      {
        accentPhrases,
        engineId,
        styleId,
      }: { accentPhrases: AccentPhrase[]; engineId: EngineId; styleId: StyleId }
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
        engineId: EngineId;
        styleId: StyleId;
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

  DEFAULT_PROJECT_FILE_BASE_NAME: {
    getter: (state) => {
      const headItemText = state.audioItems[state.audioKeys[0]].text;

      const tailItemText =
        state.audioItems[state.audioKeys[state.audioKeys.length - 1]].text;

      const headTailItemText =
        state.audioKeys.length === 1
          ? headItemText
          : headItemText + "..." + tailItemText;

      const defaultFileBaseName = sanitizeFileName(headTailItemText);

      return defaultFileBaseName === "" ? "Untitled" : defaultFileBaseName;
    },
  },

  DEFAULT_AUDIO_FILE_NAME: {
    getter: (state) => (audioKey) => {
      const fileNamePattern = state.savingSetting.fileNamePattern;

      const index = state.audioKeys.indexOf(audioKey);
      const audioItem = state.audioItems[audioKey];

      const character = getCharacterInfo(
        state,
        audioItem.voice.engineId,
        audioItem.voice.styleId
      );
      if (character === undefined)
        throw new Error("assert character !== undefined");

      const style = character.metas.styles.find(
        (style) => style.styleId === audioItem.voice.styleId
      );
      if (style === undefined) throw new Error("assert style !== undefined");

      const styleName = style.styleName || DEFAULT_STYLE_NAME;
      return buildAudioFileNameFromRawData(fileNamePattern, {
        characterName: character.metas.speakerName,
        index,
        styleName,
        text: audioItem.text,
        date: currentDateString(),
      });
    },
  },

  GENERATE_LAB: {
    action: createUILockAction(
      async (
        { state },
        { audioKey, offset }: { audioKey: AudioKey; offset?: number }
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
    action({ state }, { audioKey }: { audioKey: AudioKey }) {
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
    async action({ dispatch, state }, { audioKey }: { audioKey: AudioKey }) {
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
        const engineId = audioItem.voice.engineId;

        const [id, audioQuery] = await generateUniqueIdAndQuery(
          state,
          audioItem
        );
        if (audioQuery == undefined)
          throw new Error("audioQuery is not defined for audioItem");

        const speaker = audioItem.voice.styleId;

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
            if (!getters.VALID_MORPHING_INFO(audioItem))
              throw new Error("VALID_MORPHING_ERROR"); //FIXME: エラーを変更した場合ハンドリング部分も修正する
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
        const engineId: EngineId | undefined = state.engineIds[0]; // TODO: 複数エンジン対応, 暫定的に音声結合機能は0番目のエンジンのみを使用する
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
        { state, getters, dispatch },
        {
          audioKey,
          filePath,
        }: {
          audioKey: AudioKey;
          filePath?: string;
        }
      ): Promise<SaveResultObject> => {
        const defaultAudioFileName = getters.DEFAULT_AUDIO_FILE_NAME(audioKey);
        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultAudioFileName
          );
        } else {
          filePath ??= await window.electron.showAudioSaveDialog({
            title: "音声を保存",
            defaultPath: defaultAudioFileName,
          });
        }

        if (!filePath) {
          return { result: "CANCELED", path: "" };
        }

        if (state.savingSetting.avoidOverwrite) {
          filePath = await changeFileTailToNonExistent(filePath, "wav");
        }

        let blob = await dispatch("GET_AUDIO_CACHE", { audioKey });
        if (!blob) {
          try {
            blob = await dispatch("GENERATE_AUDIO", { audioKey });
          } catch (e) {
            let errorMessage = undefined;
            // FIXME: GENERATE_AUDIO_FROM_AUDIO_ITEMのエラーを変えた場合変更する
            if (e instanceof Error && e.message === "VALID_MORPHING_ERROR") {
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

        try {
          await window.electron
            .writeFile({
              filePath,
              buffer: await blob.arrayBuffer(),
            })
            .then(getValueOrThrow);

          if (state.savingSetting.exportLab) {
            const labString = await dispatch("GENERATE_LAB", { audioKey });
            if (labString === undefined)
              return {
                result: "WRITE_ERROR",
                path: filePath,
                errorMessage: "labの生成に失敗しました。",
              };

            await writeTextFile({
              text: labString,
              filePath: filePath.replace(/\.wav$/, ".lab"),
            }).then(getValueOrThrow);
          }

          if (state.savingSetting.exportText) {
            await writeTextFile({
              text: extractExportText(state.audioItems[audioKey].text),
              filePath: filePath.replace(/\.wav$/, ".txt"),
              encoding: state.savingSetting.fileEncoding,
            }).then(getValueOrThrow);
          }

          return { result: "SUCCESS", path: filePath };
        } catch (e) {
          window.electron.logError(e);
          if (e instanceof ResultError) {
            return {
              result: "WRITE_ERROR",
              path: filePath,
              errorMessage: generateWriteErrorMessage(e),
            };
          }
          return {
            result: "UNKNOWN_ERROR",
            path: filePath,
            errorMessage:
              (e instanceof Error ? e.message : String(e)) ||
              "不明なエラーが発生しました。",
          };
        }
      }
    ),
  },

  GENERATE_AND_SAVE_ALL_AUDIO: {
    action: createUILockAction(
      async (
        { state, getters, dispatch },
        {
          dirPath,
          callback,
        }: {
          dirPath?: string;
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
            const name = getters.DEFAULT_AUDIO_FILE_NAME(audioKey);
            return dispatch("GENERATE_AND_SAVE_AUDIO", {
              audioKey,
              filePath: path.join(_dirPath, name),
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
        { state, getters, dispatch },
        {
          filePath,
          callback,
        }: {
          filePath?: string;
          callback?: (finishedCount: number, totalCount: number) => void;
        }
      ): Promise<SaveResultObject> => {
        const defaultFileName = `${getters.DEFAULT_PROJECT_FILE_BASE_NAME}.wav`;

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
          filePath = await changeFileTailToNonExistent(filePath, "wav");
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
              if (e instanceof Error && e.message === "VALID_MORPHING_ERROR") {
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
          texts.push(extractExportText(state.audioItems[audioKey].text));
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

        const writeFileResult = await window.electron.writeFile({
          filePath,
          buffer: await connectedWav.arrayBuffer(),
        });
        if (!writeFileResult.ok) {
          window.electron.logError(writeFileResult.error);
          return { result: "WRITE_ERROR", path: filePath };
        }

        if (state.savingSetting.exportLab) {
          const labResult = await writeTextFile({
            // GENERATE_LABで生成される文字列はすべて改行で終わるので、追加で改行を挟む必要はない
            text: labs.join(""),
            filePath: filePath.replace(/\.wav$/, ".lab"),
          });
          if (!labResult.ok) {
            window.electron.logError(labResult.error);
            return { result: "WRITE_ERROR", path: filePath };
          }
        }

        if (state.savingSetting.exportText) {
          const textResult = await writeTextFile({
            text: texts.join("\n"),
            filePath: filePath.replace(/\.wav$/, ".txt"),
            encoding: state.savingSetting.fileEncoding,
          });
          if (!textResult.ok) {
            window.electron.logError(textResult.error);
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
        { state, getters },
        { filePath }: { filePath?: string }
      ): Promise<SaveResultObject> => {
        const defaultFileName = `${getters.DEFAULT_PROJECT_FILE_BASE_NAME}.txt`;
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
          filePath = await changeFileTailToNonExistent(filePath, "txt");
        }

        const characters = new Map<string, string>();

        if (!getters.USER_ORDERED_CHARACTER_INFOS)
          throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

        for (const characterInfo of getters.USER_ORDERED_CHARACTER_INFOS) {
          const speakerName = characterInfo.metas.speakerName;
          for (const style of characterInfo.metas.styles) {
            characters.set(
              `${style.engineId}:${style.styleId}`, // FIXME: 入れ子のMapにする
              formatCharacterStyleName(speakerName, style.styleName)
            );
          }
        }

        const texts: string[] = [];
        for (const audioKey of state.audioKeys) {
          const styleId = state.audioItems[audioKey].voice.styleId;
          const engineId = state.audioItems[audioKey].voice.engineId;
          if (!engineId) {
            throw new Error("engineId is undefined");
          }
          const speakerName =
            styleId !== undefined
              ? characters.get(`${engineId}:${styleId}`) + ","
              : "";

          const skippedText = extractExportText(
            state.audioItems[audioKey].text
          );
          texts.push(speakerName + skippedText);
        }

        const result = await writeTextFile({
          text: texts.join("\n"),
          encoding: state.savingSetting.fileEncoding,
          filePath,
        });
        if (!result.ok) {
          window.electron.logError(result.error);
          return { result: "WRITE_ERROR", path: filePath };
        }

        return { result: "SUCCESS", path: filePath };
      }
    ),
  },

  PLAY_AUDIO: {
    action: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: AudioKey }) => {
        await dispatch("STOP_AUDIO");

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
          audioKey,
        });
      }
    ),
  },

  PLAY_AUDIO_BLOB: {
    action: createUILockAction(
      async (
        { getters, commit, dispatch },
        { audioBlob, audioKey }: { audioBlob: Blob; audioKey?: AudioKey }
      ) => {
        commit("SET_AUDIO_SOURCE", { audioBlob });
        let offset: number | undefined;
        // 途中再生用の処理
        if (audioKey) {
          const accentPhraseOffsets = await dispatch("GET_AUDIO_PLAY_OFFSETS", {
            audioKey,
          });
          if (accentPhraseOffsets.length === 0)
            throw new Error("accentPhraseOffsets.length === 0");
          const startTime =
            accentPhraseOffsets[getters.AUDIO_PLAY_START_POINT ?? 0];
          if (startTime === undefined) throw Error("startTime === undefined");
          // 小さい値が切り捨てられることでフォーカスされるアクセントフレーズが一瞬元に戻るので、
          // 再生に影響のない程度かつ切り捨てられない値を加算する
          offset = startTime + 10e-6;
        }

        return dispatch("PLAY_AUDIO_PLAYER", { offset, audioKey });
      }
    ),
  },

  SET_AUDIO_PRESET_KEY: {
    mutation(
      state,
      {
        audioKey,
        presetKey,
      }: { audioKey: AudioKey; presetKey: PresetKey | undefined }
    ) {
      if (presetKey === undefined) {
        delete state.audioItems[audioKey].presetKey;
      } else {
        state.audioItems[audioKey].presetKey = presetKey;
      }
    },
  },

  PLAY_CONTINUOUSLY_AUDIO: {
    action: createUILockAction(async ({ state, getters, commit, dispatch }) => {
      const currentAudioKey = state._activeAudioKey;
      const currentAudioPlayStartPoint = getters.AUDIO_PLAY_START_POINT;

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
});

export const audioCommandStoreState: AudioCommandStoreState = {};

export const audioCommandStore = transformCommandStore(
  createPartialStore<AudioCommandStoreTypes>({
    COMMAND_REGISTER_AUDIO_ITEM: {
      mutation(
        draft,
        payload: {
          audioItem: AudioItem;
          audioKey: AudioKey;
          prevAudioKey: AudioKey | undefined;
        }
      ) {
        audioStore.mutations.INSERT_AUDIO_ITEM(draft, payload);
      },
      async action(
        { commit },
        {
          audioItem,
          prevAudioKey,
        }: {
          audioItem: AudioItem;
          prevAudioKey: AudioKey | undefined;
        }
      ) {
        const audioKey = generateAudioKey();
        commit("COMMAND_REGISTER_AUDIO_ITEM", {
          audioItem,
          audioKey,
          prevAudioKey,
        });
        return audioKey;
      },
    },

    COMMAND_REMOVE_AUDIO_ITEM: {
      mutation(draft, payload: { audioKey: AudioKey }) {
        audioStore.mutations.REMOVE_AUDIO_ITEM(draft, payload);
      },
      action({ commit }, payload: { audioKey: AudioKey }) {
        commit("COMMAND_REMOVE_AUDIO_ITEM", payload);
      },
    },

    COMMAND_SET_AUDIO_KEYS: {
      mutation(draft, payload: { audioKeys: AudioKey[] }) {
        audioStore.mutations.SET_AUDIO_KEYS(draft, payload);
      },
      action({ commit }, payload: { audioKeys: AudioKey[] }) {
        commit("COMMAND_SET_AUDIO_KEYS", payload);
      },
    },

    COMMAND_CHANGE_DISPLAY_TEXT: {
      /**
       * 読みを変えずにテキストだけを変える
       */
      action({ commit }, payload: { audioKey: AudioKey; text: string }) {
        commit("COMMAND_CHANGE_AUDIO_TEXT", {
          audioKey: payload.audioKey,
          text: payload.text,
          update: "Text",
        });
      },
    },

    COMMAND_CHANGE_AUDIO_TEXT: {
      mutation(
        draft,
        payload: { audioKey: AudioKey; text: string } & (
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
        { audioKey, text }: { audioKey: AudioKey; text: string }
      ) {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;
        const query = state.audioItems[audioKey].query;
        const skippedText = extractYomiText(text);

        try {
          if (query !== undefined) {
            const accentPhrases: AccentPhrase[] = await dispatch(
              "FETCH_ACCENT_PHRASES",
              {
                text: skippedText,
                engineId,
                styleId,
              }
            );

            // 読みの内容が変わっていなければテキストだけ変更
            const isSameText = !isAccentPhrasesTextDifferent(
              query.accentPhrases,
              accentPhrases
            );
            let newAccentPhrases: AccentPhrase[] = [];
            if (isSameText) {
              newAccentPhrases = query.accentPhrases;
            } else {
              if (!state.experimentalSetting.shouldKeepTuningOnTextChange) {
                newAccentPhrases = accentPhrases;
              } else {
                /*
                 * # 調整結果の保持の仕組み
                 * 1. 新しいAccentPhraseと古いAccentPhraseのテキスト（モーラのカタカナを結合したもの）を比較する。読点は無視する。（diffからflatDiff）
                 * 例えば、
                 * 旧：[ズ ン ダ モ ン ノ] [チョ ウ ショ ク]
                 * 新：[ズ ン ダ モ ン ノ] [ユ ウ ショ ク]
                 * という場合、
                 *   [ズ ン ダ モ ン ノ]
                 * + [ユ ウ ショ ク]
                 * - [チョ ウ ショ ク]
                 * のような変更なしのdiff・追加のdiff・削除のdiffが得られる。
                 *
                 * 2. それぞれのdiffにインデックスを振る。（indexedDiff）
                 * 3. diffのインデックスと古いAccentPhraseの対応表を作る。（indexToOldAccentPhrase）
                 * 追加のdiffを抜くと古いAccentPhraseになるので、残ったAccentPhraseのIDを対応させる。
                 *   [ズ ン ダ モ ン ノ] #0 -> query.accentPhrases[0]
                 * + [ユ ウ ショ ク]     #1 -> （無視）
                 * - [チョ ウ ショ ク]   #2 -> query.accentPhrases[1]
                 *
                 * 4. 新しいAccentPhraseの配列を作る。（newAccentPhrases）
                 * 変更なしのdiffは上の対応表を使って古いAccentPhrase、追加のdiffは新しいAccentPhraseを使い、削除のdiffは無視する。
                 *   [ズ ン ダ モ ン ノ] #0 -> query.accentPhrases[0]
                 * + [ユ ウ ショ ク]     #1 -> accentPhrases[1]
                 * - [チョ ウ ショ ク]   #2 -> （無視）
                 */
                const diff = diffArrays(
                  query.accentPhrases.map(joinTextsInAccentPhrases),
                  accentPhrases.map(joinTextsInAccentPhrases)
                );
                const flatDiff = diff.flatMap((d) =>
                  d.value.map((v) => ({ ...d, value: v }))
                );
                const indexedDiff = flatDiff.map((d, i) => ({
                  ...d,
                  index: i,
                }));
                const indexToOldAccentPhrase = indexedDiff
                  .filter((d) => !d.added)
                  .reduce(
                    (acc, d, i) => ({
                      ...acc,
                      [d.index]: toRaw(query.accentPhrases[i]),
                    }),
                    {} as { [index: number]: AccentPhrase }
                  );
                newAccentPhrases = indexedDiff
                  .filter((d) => !d.removed)
                  .map((d, i) => {
                    const ap = structuredClone(
                      indexToOldAccentPhrase[d.index] ?? accentPhrases[i]
                    );
                    if (accentPhrases[i].pauseMora !== undefined) {
                      ap.pauseMora = accentPhrases[i].pauseMora;
                    } else {
                      delete ap.pauseMora;
                    }
                    ap.isInterrogative = accentPhrases[i].isInterrogative;

                    return ap;
                  });
              }
            }
            commit("COMMAND_CHANGE_AUDIO_TEXT", {
              audioKey,
              text,
              update: "AccentPhrases",
              accentPhrases: newAccentPhrases,
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

    COMMAND_MULTI_CHANGE_VOICE: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; voice: Voice } & (
          | { update: "RollbackStyleId" }
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
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_VOICE(draft, {
            audioKey,
            voice: payload.voice,
          });
        }

        if (payload.update === "RollbackStyleId") return;

        for (const audioKey of payload.audioKeys) {
          const presetKey = draft.audioItems[audioKey].presetKey;

          const { nextPresetKey, shouldApplyPreset } = determineNextPresetKey(
            draft,
            payload.voice,
            presetKey,
            "changeVoice"
          );

          audioStore.mutations.SET_AUDIO_PRESET_KEY(draft, {
            audioKey,
            presetKey: nextPresetKey,
          });

          if (payload.update == "AccentPhrases") {
            audioStore.mutations.SET_ACCENT_PHRASES(draft, {
              audioKey,
              accentPhrases: payload.accentPhrases,
            });
          } else if (payload.update == "AudioQuery") {
            audioStore.mutations.SET_AUDIO_QUERY(draft, {
              audioKey,
              audioQuery: payload.query,
            });
          }

          if (shouldApplyPreset) {
            audioStore.mutations.APPLY_AUDIO_PRESET(draft, {
              audioKey,
            });
          }
        }
      },
      async action(
        { state, dispatch, commit },
        { audioKeys, voice }: { audioKeys: AudioKey[]; voice: Voice }
      ) {
        const engineId = voice.engineId;
        const styleId = voice.styleId;
        await dispatch("SETUP_SPEAKER", { audioKeys, engineId, styleId });
        await Promise.all(
          audioKeys.map(async (audioKey) => {
            try {
              const query = state.audioItems[audioKey].query;
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
                commit("COMMAND_MULTI_CHANGE_VOICE", {
                  audioKeys,
                  voice,
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
                commit("COMMAND_MULTI_CHANGE_VOICE", {
                  audioKeys,
                  voice,
                  update: "AudioQuery",
                  query,
                });
              }
            } catch (error) {
              commit("COMMAND_MULTI_CHANGE_VOICE", {
                audioKeys,
                voice,
                update: "RollbackStyleId",
              });
              throw error;
            }
          })
        );
      },
    },

    COMMAND_CHANGE_ACCENT: {
      mutation(
        draft,
        {
          audioKey,
          accentPhrases,
        }: { audioKey: AudioKey; accentPhrases: AccentPhrase[] }
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
        }: { audioKey: AudioKey; accentPhraseIndex: number; accent: number }
      ) {
        const query = state.audioItems[audioKey].query;
        if (query !== undefined) {
          const newAccentPhrases: AccentPhrase[] = JSON.parse(
            JSON.stringify(query.accentPhrases)
          );
          newAccentPhrases[accentPhraseIndex].accent = accent;

          try {
            const engineId = state.audioItems[audioKey].voice.engineId;
            const styleId = state.audioItems[audioKey].voice.styleId;

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
          audioKey: AudioKey;
          accentPhrases: AccentPhrase[];
        }
      ) {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
      },
      async action(
        { state, dispatch, commit },
        payload: {
          audioKey: AudioKey;
          accentPhraseIndex: number;
        } & ({ isPause: false; moraIndex: number } | { isPause: true })
      ) {
        const { audioKey, accentPhraseIndex } = payload;
        const query = state.audioItems[audioKey].query;

        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;

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

    COMMAND_DELETE_ACCENT_PHRASE: {
      async action(
        { state, commit },
        {
          audioKey,
          accentPhraseIndex,
        }: {
          audioKey: AudioKey;
          accentPhraseIndex: number;
        }
      ) {
        const query = state.audioItems[audioKey].query;
        if (query == undefined) throw new Error("query == undefined");

        const originAccentPhrases = query.accentPhrases;

        const newAccentPhrases = [
          ...originAccentPhrases.slice(0, accentPhraseIndex),
          ...originAccentPhrases.slice(accentPhraseIndex + 1),
        ];

        // 自動再調整は行わない
        commit("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
          audioKey,
          accentPhrases: newAccentPhrases,
        });
      },
    },

    COMMAND_CHANGE_SINGLE_ACCENT_PHRASE: {
      mutation(
        draft,
        payload: {
          audioKey: AudioKey;
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
          audioKey: AudioKey;
          newPronunciation: string;
          accentPhraseIndex: number;
          popUntilPause: boolean;
        }
      ) {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;

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
        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;

        const query = state.audioItems[audioKey].query;
        if (query === undefined) throw new Error("assert query !== undefined");

        const newAccentPhrases = await dispatch("FETCH_MORA_DATA", {
          accentPhrases: query.accentPhrases,
          engineId,
          styleId,
        });

        commit("COMMAND_CHANGE_ACCENT", {
          audioKey,
          accentPhrases: newAccentPhrases,
        });
      },
    },

    COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH: {
      async action(
        { state, dispatch, commit },
        { audioKey, accentPhraseIndex }
      ) {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;

        const query = state.audioItems[audioKey].query;
        if (query == undefined) throw new Error("query == undefined");

        const newAccentPhrases = await dispatch("FETCH_AND_COPY_MORA_DATA", {
          accentPhrases: [...query.accentPhrases],
          engineId,
          styleId,
          copyIndexes: [accentPhraseIndex],
        });

        commit("COMMAND_CHANGE_ACCENT", {
          audioKey,
          accentPhrases: newAccentPhrases,
        });
      },
    },

    COMMAND_SET_AUDIO_MORA_DATA: {
      mutation(
        draft,
        payload: {
          audioKey: AudioKey;
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
          audioKey: AudioKey;
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
          audioKey: AudioKey;
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
          audioKey: AudioKey;
          accentPhraseIndex: number;
          moraIndex: number;
          data: number;
          type: MoraDataType;
        }
      ) {
        commit("COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_SPEED_SCALE: {
      mutation(draft, payload: { audioKeys: AudioKey[]; speedScale: number }) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_SPEED_SCALE(draft, {
            audioKey,
            speedScale: payload.speedScale,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; speedScale: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_SPEED_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_PITCH_SCALE: {
      mutation(draft, payload: { audioKeys: AudioKey[]; pitchScale: number }) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_PITCH_SCALE(draft, {
            audioKey,
            pitchScale: payload.pitchScale,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; pitchScale: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_PITCH_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_INTONATION_SCALE: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; intonationScale: number }
      ) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_INTONATION_SCALE(draft, {
            audioKey,
            intonationScale: payload.intonationScale,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; intonationScale: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_INTONATION_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_VOLUME_SCALE: {
      mutation(draft, payload: { audioKeys: AudioKey[]; volumeScale: number }) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_VOLUME_SCALE(draft, {
            audioKey,
            volumeScale: payload.volumeScale,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; volumeScale: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_VOLUME_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; prePhonemeLength: number }
      ) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_PRE_PHONEME_LENGTH(draft, {
            audioKey,
            prePhonemeLength: payload.prePhonemeLength,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; prePhonemeLength: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_POST_PHONEME_LENGTH: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; postPhonemeLength: number }
      ) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_AUDIO_POST_PHONEME_LENGTH(draft, {
            audioKey,
            postPhonemeLength: payload.postPhonemeLength,
          });
        }
      },
      action(
        { commit },
        payload: { audioKeys: AudioKey[]; postPhonemeLength: number }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_POST_PHONEME_LENGTH", payload);
      },
    },

    COMMAND_MULTI_SET_MORPHING_INFO: {
      mutation(
        draft,
        payload: {
          audioKeys: AudioKey[];
          morphingInfo: MorphingInfo | undefined;
        }
      ) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.SET_MORPHING_INFO(draft, {
            audioKey,
            morphingInfo: payload.morphingInfo,
          });
        }
      },
      action(
        { commit },
        payload: {
          audioKeys: AudioKey[];
          morphingInfo: MorphingInfo | undefined;
        }
      ) {
        commit("COMMAND_MULTI_SET_MORPHING_INFO", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_PRESET: {
      mutation(
        draft,
        {
          audioKeys,
          presetKey,
        }: { audioKeys: AudioKey[]; presetKey: PresetKey | undefined }
      ) {
        for (const audioKey of audioKeys) {
          audioStore.mutations.SET_AUDIO_PRESET_KEY(draft, {
            audioKey,
            presetKey,
          });
          audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
        }
      },
      action(
        { commit },
        {
          audioKeys,
          presetKey,
        }: { audioKeys: AudioKey[]; presetKey: PresetKey | undefined }
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_PRESET", { audioKeys, presetKey });
      },
    },

    COMMAND_MULTI_APPLY_AUDIO_PRESET: {
      mutation(draft, payload: { audioKeys: AudioKey[] }) {
        for (const audioKey of payload.audioKeys) {
          audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
        }
      },
      action({ commit }, payload: { audioKeys: AudioKey[] }) {
        commit("COMMAND_MULTI_APPLY_AUDIO_PRESET", payload);
      },
    },

    COMMAND_FULLY_APPLY_AUDIO_PRESET: {
      mutation(draft, { presetKey }: { presetKey: PresetKey }) {
        const targetAudioKeys = draft.audioKeys.filter(
          (audioKey) => draft.audioItems[audioKey].presetKey === presetKey
        );
        for (const audioKey of targetAudioKeys) {
          audioStore.mutations.APPLY_AUDIO_PRESET(draft, { audioKey });
        }
      },
      action({ commit }, payload: { presetKey: PresetKey }) {
        commit("COMMAND_FULLY_APPLY_AUDIO_PRESET", payload);
      },
    },

    COMMAND_IMPORT_FROM_FILE: {
      mutation(
        draft,
        {
          audioKeyItemPairs,
        }: { audioKeyItemPairs: { audioKey: AudioKey; audioItem: AudioItem }[] }
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
            await window.electron.readFile({ filePath }).then(getValueOrThrow)
          );
          if (body.includes("\ufffd")) {
            body = new TextDecoder("shift-jis").decode(
              await window.electron.readFile({ filePath }).then(getValueOrThrow)
            );
          }
          const audioItems: AudioItem[] = [];
          let baseAudioItem: AudioItem | undefined = undefined;
          if (state._activeAudioKey !== undefined) {
            baseAudioItem = state.audioItems[state._activeAudioKey];
          }

          if (!getters.USER_ORDERED_CHARACTER_INFOS)
            throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
          for (const { text, voice } of parseTextFile(
            body,
            state.defaultStyleIds,
            getters.USER_ORDERED_CHARACTER_INFOS,
            baseAudioItem?.voice
          )) {
            audioItems.push(
              await dispatch("GENERATE_AUDIO_ITEM", {
                text,
                voice,
                baseAudioItem,
              })
            );
          }
          const audioKeyItemPairs = audioItems.map((audioItem) => ({
            audioItem,
            audioKey: generateAudioKey(),
          }));
          commit("COMMAND_IMPORT_FROM_FILE", {
            audioKeyItemPairs,
          });
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
          audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
          prevAudioKey: AudioKey;
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
            voice,
          }: {
            prevAudioKey: AudioKey;
            texts: string[];
            voice: Voice;
          }
        ) => {
          const audioKeyItemPairs: {
            audioKey: AudioKey;
            audioItem: AudioItem;
          }[] = [];
          let baseAudioItem: AudioItem | undefined = undefined;
          if (state._activeAudioKey) {
            baseAudioItem = state.audioItems[state._activeAudioKey];
          }

          for (const text of texts.filter((value) => value != "")) {
            const audioKey = generateAudioKey();
            const audioItem = await dispatch("GENERATE_AUDIO_ITEM", {
              text,
              voice,
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
  })
);
