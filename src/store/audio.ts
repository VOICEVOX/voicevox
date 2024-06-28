import path from "path";
import Encoding from "encoding-japanese";
import { createUILockAction, withProgress } from "./ui";
import {
  AudioItem,
  SaveResultObject,
  State,
  AudioStoreState,
  AudioCommandStoreState,
  AudioStoreTypes,
  AudioCommandStoreTypes,
  transformCommandStore,
  FetchAudioResult,
} from "./type";
import {
  buildAudioFileNameFromRawData,
  isAccentPhrasesTextDifferent,
  currentDateString,
  extractExportText,
  extractYomiText,
  sanitizeFileName,
  DEFAULT_STYLE_NAME,
  formatCharacterStyleName,
  TuningTranscription,
  filterCharacterInfosByStyleType,
} from "./utility";
import { createPartialStore } from "./vuex";
import { determineNextPresetKey } from "./preset";
import {
  fetchAudioFromAudioItem,
  generateLabFromAudioQuery,
  handlePossiblyNotMorphableError,
  isMorphable,
} from "./audioGenerate";
import { ContinuousPlayer } from "./audioContinuousPlayer";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";
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
import { base64ImageToUri, base64ToUri } from "@/helpers/base64Helper";
import { getValueOrThrow, ResultError } from "@/type/result";

function generateAudioKey() {
  return AudioKey(crypto.randomUUID());
}

function parseTextFile(
  body: string,
  defaultStyleIds: DefaultStyleId[],
  userOrderedCharacterInfos: CharacterInfo[],
  initVoice?: Voice,
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
        voice,
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
    if (voice != undefined) {
      lastVoice = voice;
      continue;
    }

    audioItems.push({ text: splitText, voice: lastVoice });
  }
  return audioItems;
}

async function changeFileTailToNonExistent(
  filePath: string,
  extension: string,
) {
  let tail = 1;
  const name = filePath.slice(0, filePath.length - 1 - extension.length);
  while (await window.backend.checkFileExists(filePath)) {
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

  return window.backend.writeFile({
    filePath: obj.filePath,
    buffer: await textBlob.arrayBuffer(),
  });
}

function generateWriteErrorMessage(writeFileResult: ResultError) {
  if (!writeFileResult.code) {
    return `何らかの理由で失敗しました。${writeFileResult.message}`;
  }
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

// TODO: GETTERに移動する。
export function getCharacterInfo(
  state: State,
  engineId: EngineId,
  styleId: StyleId,
): CharacterInfo | undefined {
  const engineCharacterInfos = state.characterInfos[engineId];

  // (engineId, styleId)で「スタイル付きキャラクター」は一意である
  return engineCharacterInfos.find((characterInfo) =>
    characterInfo.metas.styles.some(
      (characterStyle) => characterStyle.styleId === styleId,
    ),
  );
}

/**
 * 与えたAudioItemを元に、Presetを適用した新しいAudioItemを返す
 */
export function applyAudioPresetToAudioItem(
  audioItem: AudioItem,
  presetItem: Preset,
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
      return state._activeAudioKey != undefined &&
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
          state.audioKeys.includes(audioKey),
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
      const activeAudioKey = getters.ACTIVE_AUDIO_KEY;
      if (audioPlayStartPoint == undefined || activeAudioKey == undefined) {
        return undefined;
      }
      const length =
        state.audioItems[activeAudioKey].query?.accentPhrases.length;

      return length == 0 || length == undefined
        ? undefined
        : Math.min(length - 1, audioPlayStartPoint);
    },
  },

  /**
   * CharacterInfoをエンジンから取得する。
   * GETクエリとBASE64のデコードがそこそこ重いため並行処理をしている。
   */
  LOAD_CHARACTER: {
    action: createUILockAction(
      async ({ commit, dispatch, state }, { engineId }) => {
        const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        });

        // リソースをURLで取得するかどうか。falseの場合はbase64文字列。
        const useResourceUrl =
          state.engineManifests[engineId].supportedFeatures.returnResourceUrl ??
          false;
        const getResourceSrc = async function (
          resource: string,
          type: "image" | "wav",
        ) {
          return useResourceUrl
            ? resource
            : type == "image"
              ? await base64ImageToUri(resource)
              : await base64ToUri(resource, "audio/wav");
        };

        const getStyles = async function (
          speaker: Speaker,
          speakerInfo: SpeakerInfo,
        ) {
          const styles: StyleInfo[] = new Array(speaker.styles.length);
          for (const [i, style] of speaker.styles.entries()) {
            const styleInfo = speakerInfo.styleInfos.find(
              (styleInfo) => style.id === styleInfo.id,
            );
            if (!styleInfo)
              throw new Error(
                `Not found the style id "${style.id}" of "${speaker.name}". `,
              );
            const voiceSamples = await Promise.all(
              styleInfo.voiceSamples.map((voiceSample) =>
                getResourceSrc(voiceSample, "wav"),
              ),
            );
            styles[i] = {
              styleName: style.name,
              styleId: StyleId(style.id),
              styleType: style.type,
              engineId,
              iconPath: await getResourceSrc(styleInfo.icon, "image"),
              portraitPath:
                styleInfo.portrait &&
                (await getResourceSrc(styleInfo.portrait, "image")),
              voiceSamplePaths: voiceSamples,
            };
          }
          return styles;
        };
        const getCharacterInfo = async (
          speaker: Speaker | undefined,
          singer: Speaker | undefined,
        ) => {
          // 同じIDの歌手がいる場合は歌手情報を取得し、スタイルをマージする
          let speakerInfoPromise: Promise<SpeakerInfo> | undefined = undefined;
          let speakerStylePromise: Promise<StyleInfo[]> | undefined = undefined;
          if (speaker != undefined) {
            speakerInfoPromise = instance
              .invoke("speakerInfoSpeakerInfoGet")({
                speakerUuid: speaker.speakerUuid,
                ...(useResourceUrl && { resourceFormat: "url" }),
              })
              .catch((error) => {
                window.backend.logError(error, `Failed to get speakerInfo.`);
                throw error;
              });
            speakerStylePromise = speakerInfoPromise.then((speakerInfo) =>
              getStyles(speaker, speakerInfo),
            );
          }

          let singerInfoPromise: Promise<SpeakerInfo> | undefined = undefined;
          let singerStylePromise: Promise<StyleInfo[]> | undefined = undefined;
          if (singer != undefined) {
            singerInfoPromise = instance
              .invoke("singerInfoSingerInfoGet")({
                speakerUuid: singer.speakerUuid,
                ...(useResourceUrl && { resourceFormat: "url" }),
              })
              .catch((error) => {
                window.backend.logError(error, `Failed to get singerInfo.`);
                throw error;
              });
            singerStylePromise = singerInfoPromise.then((singerInfo) =>
              getStyles(singer, singerInfo),
            );
          }

          const baseSpeaker = speaker ?? singer;
          if (baseSpeaker == undefined) {
            throw new Error("assert baseSpeaker != undefined");
          }
          const baseCharacterInfo = await (speakerInfoPromise ??
            singerInfoPromise);
          if (baseCharacterInfo == undefined) {
            throw new Error("assert baseSpeakerInfo != undefined");
          }

          const stylesPromise = Promise.all([
            speakerStylePromise ?? [],
            singerStylePromise ?? [],
          ]).then((styles) => styles.flat());

          const characterInfo: CharacterInfo = {
            portraitPath: await getResourceSrc(
              baseCharacterInfo.portrait,
              "image",
            ),
            metas: {
              speakerUuid: SpeakerId(baseSpeaker.speakerUuid),
              speakerName: baseSpeaker.name,
              styles: await stylesPromise,
              policy: baseCharacterInfo.policy,
            },
          };
          return characterInfo;
        };

        const [speakers, singers] = await Promise.all([
          instance.invoke("speakersSpeakersGet")({}),
          state.engineManifests[engineId].supportedFeatures.sing
            ? await instance.invoke("singersSingersGet")({})
            : [],
        ]).catch((error) => {
          window.backend.logError(error, `Failed to get Speakers.`);
          throw error;
        });

        // エンジン側の順番を保ってCharacterInfoを作る
        const allUuids = new Set([
          ...speakers.map((speaker) => speaker.speakerUuid),
          ...singers.map((singer) => singer.speakerUuid),
        ]);

        const characterInfoPromises = Array.from(allUuids).map(
          (speakerUuid) => {
            const speaker = speakers.find(
              (speaker) => speaker.speakerUuid === speakerUuid,
            );
            const singer = singers.find(
              (singer) => singer.speakerUuid === speakerUuid,
            );
            return getCharacterInfo(speaker, singer);
          },
        );

        const characterInfos = await Promise.all(characterInfoPromises);

        commit("SET_CHARACTER_INFOS", { engineId, characterInfos });
      },
    ),
  },

  SET_CHARACTER_INFOS: {
    mutation(
      state,
      {
        engineId,
        characterInfos,
      }: { engineId: EngineId; characterInfos: CharacterInfo[] },
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
          if (isMorphable == undefined || typeof isMorphable !== "boolean") {
            throw Error(
              "The is_morphable property does not exist, it is either CamelCase or the engine type is wrong.",
            );
          }
          return [
            parseInt(key),
            {
              ...value,
              isMorphable,
            },
          ];
        }),
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
        voice.styleId,
      );
      if (characterInfo == undefined)
        throw new Error("assert characterInfo != undefined");

      const style = characterInfo.metas.styles.find(
        (style) => style.styleId === voice.styleId,
      );
      if (style == undefined) throw new Error("assert style != undefined");

      const speakerName = characterInfo.metas.speakerName;
      const styleName = style.styleName;
      return formatCharacterStyleName(speakerName, styleName);
    },
  },

  USER_ORDERED_CHARACTER_INFOS: {
    /**
     * ユーザーが並び替えたキャラクターの順番でキャラクター情報を返す。
     * `singerLike`の場合はhummingかsingなスタイルのみを返す。
     */
    getter: (state, getters) => (styleType: "all" | "singerLike" | "talk") => {
      const allCharacterInfos = getters.GET_ALL_CHARACTER_INFOS;
      if (allCharacterInfos.size === 0) return undefined;

      let flattenCharacterInfos = [...allCharacterInfos.values()];
      // "all"以外の場合は、スタイル・キャラクターをフィルタリングする
      if (styleType !== "all") {
        flattenCharacterInfos = filterCharacterInfosByStyleType(
          flattenCharacterInfos,
          styleType,
        );
      }
      return (
        flattenCharacterInfos
          // ユーザーが並び替えた順番に並び替え
          .sort(
            (a, b) =>
              state.userCharacterOrder.indexOf(a.metas.speakerUuid) -
              state.userCharacterOrder.indexOf(b.metas.speakerUuid),
          )
      );
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
      { audioKeys }: { audioKeys?: AudioKey[] },
    ) {
      const uniqueAudioKeys = new Set(audioKeys);
      if (
        getters.ACTIVE_AUDIO_KEY &&
        !uniqueAudioKeys.has(getters.ACTIVE_AUDIO_KEY)
      ) {
        throw new Error("selectedAudioKeys must include activeAudioKey");
      }
      const sortedAudioKeys = state.audioKeys.filter((audioKey) =>
        uniqueAudioKeys.has(audioKey),
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
      }: { audioKey: AudioKey; nowGenerating: boolean },
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
      },
    ) {
      //引数にbaseAudioItemが与えられた場合、baseAudioItemから話速等のパラメータを引き継いだAudioItemを返す
      //baseAudioItem.queryのうち、accentPhrasesとkanaは基本設定パラメータではないので引き継がない
      //baseAudioItemのうち、textとstyleIdは別途与えられるので引き継がない
      if (state.defaultStyleIds == undefined) {
        throw new Error("state.defaultStyleIds == undefined");
      }
      const userOrderedCharacterInfos =
        getters.USER_ORDERED_CHARACTER_INFOS("talk");

      if (userOrderedCharacterInfos == undefined) {
        throw new Error("state.characterInfos == undefined");
      }

      const text = payload.text ?? "";

      const defaultSpeakerId = userOrderedCharacterInfos[0].metas.speakerUuid;
      const defaultStyleId = state.defaultStyleIds.find(
        (styleId) => styleId.speakerUuid === defaultSpeakerId,
      );
      if (defaultStyleId == undefined)
        throw new Error("defaultStyleId == undefined");

      const voice = payload.voice ?? {
        engineId: defaultStyleId.engineId,
        speakerId: defaultStyleId.speakerUuid,
        styleId: defaultStyleId.defaultStyleId,
      };

      const baseAudioItem = payload.baseAudioItem;

      const fetchQueryParams = {
        text: extractYomiText(text, {
          enableMemoNotation: state.enableMemoNotation,
          enableRubyNotation: state.enableRubyNotation,
        }),
        engineId: voice.engineId,
        styleId: voice.styleId,
      };

      const query = getters.IS_ENGINE_READY(voice.engineId)
        ? await dispatch("FETCH_AUDIO_QUERY", fetchQueryParams).catch(
            () => undefined,
          )
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
        baseAudioItem ? "copy" : "generate",
      );
      newAudioItem.presetKey = nextPresetKey;

      // audioItemに対してプリセットを適用する
      if (shouldApplyPreset && nextPresetKey) {
        const preset = state.presetItems[nextPresetKey];
        return applyAudioPresetToAudioItem(newAudioItem, preset);
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
      }: { audioItem: AudioItem; prevAudioKey?: AudioKey },
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
      },
    ) {
      const index =
        prevAudioKey != undefined
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
      },
    ) {
      const index =
        prevAudioKey != undefined
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

  SET_AUDIO_TEXT: {
    mutation(state, { audioKey, text }: { audioKey: AudioKey; text: string }) {
      state.audioItems[audioKey].text = text;
    },
  },

  SET_AUDIO_SPEED_SCALE: {
    mutation(
      state,
      { audioKey, speedScale }: { audioKey: AudioKey; speedScale: number },
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.speedScale = speedScale;
    },
  },

  SET_AUDIO_PITCH_SCALE: {
    mutation(
      state,
      { audioKey, pitchScale }: { audioKey: AudioKey; pitchScale: number },
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
      }: { audioKey: AudioKey; intonationScale: number },
    ) {
      const query = state.audioItems[audioKey].query;
      if (query == undefined) throw new Error("query == undefined");
      query.intonationScale = intonationScale;
    },
  },

  SET_AUDIO_VOLUME_SCALE: {
    mutation(
      state,
      { audioKey, volumeScale }: { audioKey: AudioKey; volumeScale: number },
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
      }: { audioKey: AudioKey; prePhonemeLength: number },
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
      }: { audioKey: AudioKey; postPhonemeLength: number },
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
      }: { audioKey: AudioKey; morphingInfo: MorphingInfo | undefined },
    ) {
      const item = state.audioItems[audioKey];
      item.morphingInfo = morphingInfo;
    },
  },

  MORPHING_SUPPORTED_ENGINES: {
    getter: (state) =>
      state.engineIds.filter(
        (engineId) =>
          state.engineManifests[engineId].supportedFeatures?.synthesisMorphing,
      ),
  },

  VALID_MORPHING_INFO: {
    getter: (state) => (audioItem: AudioItem) => {
      return isMorphable(state, { audioItem });
    },
  },

  SET_AUDIO_QUERY: {
    mutation(
      state,
      { audioKey, audioQuery }: { audioKey: AudioKey; audioQuery: AudioQuery },
    ) {
      state.audioItems[audioKey].query = audioQuery;
    },
    action(
      { commit },
      payload: { audioKey: AudioKey; audioQuery: AudioQuery },
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
      }: { text: string; engineId: EngineId; styleId: StyleId },
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("audioQueryAudioQueryPost")({
            text,
            speaker: styleId,
          }),
        )
        .catch((error) => {
          window.backend.logError(
            error,
            `Failed to fetch AudioQuery for the text "${text}".`,
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
      }: { audioKey: AudioKey; accentPhrases: AccentPhrase[] },
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
      },
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("accentPhrasesAccentPhrasesPost")({
            text,
            speaker: styleId,
            isKana,
          }),
        )
        .catch((error) => {
          window.backend.logError(
            error,
            `Failed to fetch AccentPhrases for the text "${text}".`,
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
      },
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
      },
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
          if (pauseMora != undefined) {
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
      }: {
        accentPhrases: AccentPhrase[];
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("moraDataMoraDataPost")({
            accentPhrase: accentPhrases,
            speaker: styleId,
          }),
        )
        .catch((error) => {
          window.backend.logError(
            error,
            `Failed to fetch MoraData for the accentPhrases "${JSON.stringify(
              accentPhrases,
            )}".`,
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
      },
    ) {
      const fetchedAccentPhrases: AccentPhrase[] = await dispatch(
        "FETCH_MORA_DATA",
        {
          accentPhrases,
          engineId,
          styleId,
        },
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
        audioItem.voice.styleId,
      );
      if (character == undefined)
        throw new Error("assert character != undefined");

      const style = character.metas.styles.find(
        (style) => style.styleId === audioItem.voice.styleId,
      );
      if (style == undefined) throw new Error("assert style != undefined");

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

  GET_AUDIO_PLAY_OFFSETS: {
    action({ state }, { audioKey }: { audioKey: AudioKey }) {
      const query = state.audioItems[audioKey].query;
      const accentPhrases = query?.accentPhrases;
      if (query == undefined || accentPhrases == undefined)
        throw Error("query == undefined or accentPhrases == undefined");

      const offsets: number[] = [];
      let length = 0;
      offsets.push(length);
      // pre phoneme lengthは最初のアクセント句の一部として扱う
      length += query.prePhonemeLength;
      let i = 0;
      for (const phrase of accentPhrases) {
        phrase.moras.forEach((m) => {
          length += m.consonantLength != undefined ? m.consonantLength : 0;
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

  FETCH_AUDIO: {
    async action(
      { dispatch, state },
      { audioKey, ...options }: { audioKey: AudioKey; cacheOnly?: boolean },
    ) {
      const audioItem: AudioItem = JSON.parse(
        JSON.stringify(state.audioItems[audioKey]),
      );
      return dispatch("FETCH_AUDIO_FROM_AUDIO_ITEM", {
        audioItem,
        ...options,
      });
    },
  },

  FETCH_AUDIO_FROM_AUDIO_ITEM: {
    action: createUILockAction(
      async (
        { dispatch, state },
        options: { audioItem: AudioItem; cacheOnly?: boolean },
      ) => {
        const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId: options.audioItem.voice.engineId,
        });
        return fetchAudioFromAudioItem(state, instance, options);
      },
    ),
  },

  CONNECT_AUDIO: {
    action: createUILockAction(
      async (
        { dispatch, state },
        { encodedBlobs }: { encodedBlobs: string[] },
      ) => {
        const engineId: EngineId | undefined = state.engineIds[0]; // TODO: 複数エンジン対応, 暫定的に音声結合機能は0番目のエンジンのみを使用する
        if (engineId == undefined)
          throw new Error(`No such engine registered: index == 0`);

        const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        });
        try {
          return instance.invoke("connectWavesConnectWavesPost")({
            requestBody: encodedBlobs,
          });
        } catch (e) {
          window.backend.logError(e);
          return null;
        }
      },
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
        },
      ): Promise<SaveResultObject> => {
        const defaultAudioFileName = getters.DEFAULT_AUDIO_FILE_NAME(audioKey);
        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultAudioFileName,
          );
        } else {
          filePath ??= await window.backend.showAudioSaveDialog({
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

        let fetchAudioResult: FetchAudioResult;
        try {
          fetchAudioResult = await dispatch("FETCH_AUDIO", { audioKey });
        } catch (e) {
          const errorMessage = handlePossiblyNotMorphableError(e);
          return {
            result: "ENGINE_ERROR",
            path: filePath,
            errorMessage,
          };
        }

        const { blob, audioQuery } = fetchAudioResult;
        try {
          await window.backend
            .writeFile({
              filePath,
              buffer: await blob.arrayBuffer(),
            })
            .then(getValueOrThrow);

          if (state.savingSetting.exportLab) {
            const labString = await generateLabFromAudioQuery(audioQuery);
            if (labString == undefined)
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
              text: extractExportText(state.audioItems[audioKey].text, {
                enableMemoNotation: state.enableMemoNotation,
                enableRubyNotation: state.enableRubyNotation,
              }),
              filePath: filePath.replace(/\.wav$/, ".txt"),
              encoding: state.savingSetting.fileEncoding,
            }).then(getValueOrThrow);
          }

          return { result: "SUCCESS", path: filePath };
        } catch (e) {
          window.backend.logError(e);
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
      },
    ),
  },

  MULTI_GENERATE_AND_SAVE_AUDIO: {
    action: createUILockAction(
      async (
        { state, getters, dispatch },
        {
          audioKeys,
          dirPath,
          callback,
        }: {
          audioKeys: AudioKey[];
          dirPath?: string;
          callback?: (finishedCount: number) => void;
        },
      ) => {
        if (state.savingSetting.fixedExportEnabled) {
          dirPath = state.savingSetting.fixedExportDir;
        } else {
          dirPath ??= await window.backend.showSaveDirectoryDialog({
            title: "音声を保存",
          });
        }
        if (dirPath) {
          const _dirPath = dirPath;

          let finishedCount = 0;

          const promises = audioKeys.map((audioKey) => {
            const name = getters.DEFAULT_AUDIO_FILE_NAME(audioKey);
            return dispatch("GENERATE_AND_SAVE_AUDIO", {
              audioKey,
              filePath: path.join(_dirPath, name),
            }).then((value) => {
              callback?.(++finishedCount);
              return value;
            });
          });
          return Promise.all(promises);
        }
      },
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
        },
      ): Promise<SaveResultObject> => {
        const defaultFileName = `${getters.DEFAULT_PROJECT_FILE_BASE_NAME}.wav`;

        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultFileName,
          );
        } else {
          filePath ??= await window.backend.showAudioSaveDialog({
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
          let fetchAudioResult: FetchAudioResult;
          try {
            fetchAudioResult = await dispatch("FETCH_AUDIO", { audioKey });
          } catch (e) {
            const errorMessage = handlePossiblyNotMorphableError(e);
            return {
              result: "ENGINE_ERROR",
              path: filePath,
              errorMessage,
            };
          } finally {
            callback?.(++finishedCount, totalCount);
          }

          const { blob, audioQuery } = fetchAudioResult;
          const encodedBlob = await base64Encoder(blob);
          if (encodedBlob == undefined) {
            return { result: "WRITE_ERROR", path: filePath };
          }
          encodedBlobs.push(encodedBlob);
          // 大して処理能力を要しないので、生成設定のon/offにかかわらず生成してしまう
          const lab = await generateLabFromAudioQuery(audioQuery, labOffset);
          if (lab == undefined) {
            return { result: "WRITE_ERROR", path: filePath };
          }
          labs.push(lab);
          texts.push(
            extractExportText(state.audioItems[audioKey].text, {
              enableMemoNotation: state.enableMemoNotation,
              enableRubyNotation: state.enableRubyNotation,
            }),
          );
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

        const writeFileResult = await window.backend.writeFile({
          filePath,
          buffer: await connectedWav.arrayBuffer(),
        });
        if (!writeFileResult.ok) {
          window.backend.logError(writeFileResult.error);
          return { result: "WRITE_ERROR", path: filePath };
        }

        if (state.savingSetting.exportLab) {
          const labResult = await writeTextFile({
            // `generateLabFromAudioQuery`で生成される文字列はすべて改行で終わるので、追加で改行を挟む必要はない
            text: labs.join(""),
            filePath: filePath.replace(/\.wav$/, ".lab"),
          });
          if (!labResult.ok) {
            window.backend.logError(labResult.error);
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
            window.backend.logError(textResult.error);
            return { result: "WRITE_ERROR", path: filePath };
          }
        }

        return { result: "SUCCESS", path: filePath };
      },
    ),
  },

  CONNECT_AND_EXPORT_TEXT: {
    action: createUILockAction(
      async (
        { state, getters },
        { filePath }: { filePath?: string },
      ): Promise<SaveResultObject> => {
        const defaultFileName = `${getters.DEFAULT_PROJECT_FILE_BASE_NAME}.txt`;
        if (state.savingSetting.fixedExportEnabled) {
          filePath = path.join(
            state.savingSetting.fixedExportDir,
            defaultFileName,
          );
        } else {
          filePath ??= await window.backend.showTextSaveDialog({
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

        const userOrderedCharacterInfos =
          getters.USER_ORDERED_CHARACTER_INFOS("talk");
        if (!userOrderedCharacterInfos)
          throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

        for (const characterInfo of userOrderedCharacterInfos) {
          const speakerName = characterInfo.metas.speakerName;
          for (const style of characterInfo.metas.styles) {
            characters.set(
              `${style.engineId}:${style.styleId}`, // FIXME: 入れ子のMapにする
              formatCharacterStyleName(speakerName, style.styleName),
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
            styleId != undefined
              ? characters.get(`${engineId}:${styleId}`) + ","
              : "";

          const skippedText = extractExportText(
            state.audioItems[audioKey].text,
            {
              enableMemoNotation: state.enableMemoNotation,
              enableRubyNotation: state.enableRubyNotation,
            },
          );
          texts.push(speakerName + skippedText);
        }

        const result = await writeTextFile({
          text: texts.join("\n"),
          encoding: state.savingSetting.fileEncoding,
          filePath,
        });
        if (!result.ok) {
          window.backend.logError(result.error);
          return { result: "WRITE_ERROR", path: filePath };
        }

        return { result: "SUCCESS", path: filePath };
      },
    ),
  },

  PLAY_AUDIO: {
    action: createUILockAction(
      async ({ commit, dispatch }, { audioKey }: { audioKey: AudioKey }) => {
        await dispatch("STOP_AUDIO");

        // 音声用意
        let fetchAudioResult: FetchAudioResult;
        commit("SET_AUDIO_NOW_GENERATING", {
          audioKey,
          nowGenerating: true,
        });
        try {
          fetchAudioResult = await withProgress(
            dispatch("FETCH_AUDIO", { audioKey }),
            dispatch,
          );
        } finally {
          commit("SET_AUDIO_NOW_GENERATING", {
            audioKey,
            nowGenerating: false,
          });
        }

        const { blob } = fetchAudioResult;
        return dispatch("PLAY_AUDIO_BLOB", {
          audioBlob: blob,
          audioKey,
        });
      },
    ),
  },

  PLAY_AUDIO_BLOB: {
    action: createUILockAction(
      async (
        { getters, commit, dispatch },
        { audioBlob, audioKey }: { audioBlob: Blob; audioKey?: AudioKey },
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
          if (startTime == undefined) throw Error("startTime == undefined");
          // 小さい値が切り捨てられることでフォーカスされるアクセントフレーズが一瞬元に戻るので、
          // 再生に影響のない程度かつ切り捨てられない値を加算する
          offset = startTime + 10e-6;
        }

        return dispatch("PLAY_AUDIO_PLAYER", { offset, audioKey });
      },
    ),
  },

  SET_AUDIO_PRESET_KEY: {
    mutation(
      state,
      {
        audioKey,
        presetKey,
      }: { audioKey: AudioKey; presetKey: PresetKey | undefined },
    ) {
      if (presetKey == undefined) {
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
      if (currentAudioKey != undefined) {
        index = state.audioKeys.findIndex((v) => v === currentAudioKey);
      }

      const player = new ContinuousPlayer(state.audioKeys.slice(index), {
        generateAudio: ({ audioKey }) =>
          dispatch("FETCH_AUDIO", { audioKey }).then((result) => result.blob),
        playAudioBlob: ({ audioBlob, audioKey }) =>
          dispatch("PLAY_AUDIO_BLOB", { audioBlob, audioKey }),
      });
      player.addEventListener("playstart", (e) => {
        commit("SET_ACTIVE_AUDIO_KEY", { audioKey: e.audioKey });
      });
      player.addEventListener("waitstart", (e) => {
        dispatch("START_PROGRESS");
        commit("SET_ACTIVE_AUDIO_KEY", { audioKey: e.audioKey });
        commit("SET_AUDIO_NOW_GENERATING", {
          audioKey: e.audioKey,
          nowGenerating: true,
        });
      });
      player.addEventListener("waitend", (e) => {
        dispatch("RESET_PROGRESS");
        commit("SET_AUDIO_NOW_GENERATING", {
          audioKey: e.audioKey,
          nowGenerating: false,
        });
      });

      commit("SET_NOW_PLAYING_CONTINUOUSLY", { nowPlaying: true });

      await player.playUntilComplete();

      commit("SET_ACTIVE_AUDIO_KEY", { audioKey: currentAudioKey });
      commit("SET_AUDIO_PLAY_START_POINT", {
        startPoint: currentAudioPlayStartPoint,
      });
      commit("SET_NOW_PLAYING_CONTINUOUSLY", { nowPlaying: false });
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
        },
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
        },
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

    COMMAND_MULTI_REMOVE_AUDIO_ITEM: {
      mutation(draft, { audioKeys }: { audioKeys: AudioKey[] }) {
        for (const audioKey of audioKeys) {
          audioStore.mutations.REMOVE_AUDIO_ITEM(draft, { audioKey });
        }
      },
      action({ commit }, payload: { audioKeys: AudioKey[] }) {
        commit("COMMAND_MULTI_REMOVE_AUDIO_ITEM", payload);
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
        ),
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
        { audioKey, text }: { audioKey: AudioKey; text: string },
      ) {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;
        const query = state.audioItems[audioKey].query;
        const skippedText = extractYomiText(text, {
          enableMemoNotation: state.enableMemoNotation,
          enableRubyNotation: state.enableRubyNotation,
        });

        try {
          if (query != undefined) {
            const accentPhrases: AccentPhrase[] = await dispatch(
              "FETCH_ACCENT_PHRASES",
              {
                text: skippedText,
                engineId,
                styleId,
              },
            );

            // 読みの内容が変わっていなければテキストだけ変更
            const isSameText = !isAccentPhrasesTextDifferent(
              query.accentPhrases,
              accentPhrases,
            );
            let newAccentPhrases: AccentPhrase[] = [];
            if (isSameText) {
              newAccentPhrases = query.accentPhrases;
            } else {
              if (!state.experimentalSetting.shouldKeepTuningOnTextChange) {
                newAccentPhrases = accentPhrases;
              } else {
                const mergedDiff: AccentPhrase[] = new TuningTranscription(
                  query.accentPhrases,
                  accentPhrases,
                ).transcribe();

                newAccentPhrases = mergedDiff;
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
        state,
        payload: {
          voice: Voice;
          changes: Record<
            AudioKey,
            | {
                update: "AccentPhrases";
                accentPhrases: AccentPhrase[];
              }
            | {
                update: "AudioQuery";
                query: AudioQuery;
              }
            | {
                update: "OnlyVoice";
              }
          >;
        },
      ) {
        for (const [audioKey_, change] of Object.entries(payload.changes)) {
          // TypeScriptは`Object.entries`のKeyの型を`string`としてしまうので、`as`で型を指定する
          const audioKey = audioKey_ as AudioKey;

          const presetKey = state.audioItems[audioKey].presetKey;

          const { nextPresetKey, shouldApplyPreset } = determineNextPresetKey(
            state,
            payload.voice,
            presetKey,
            "changeVoice",
          );

          audioStore.mutations.SET_AUDIO_PRESET_KEY(state, {
            audioKey,
            presetKey: nextPresetKey,
          });

          audioStore.mutations.SET_AUDIO_VOICE(state, {
            audioKey,
            voice: payload.voice,
          });
          if (change.update == "AccentPhrases") {
            audioStore.mutations.SET_ACCENT_PHRASES(state, {
              audioKey,
              accentPhrases: change.accentPhrases,
            });
          } else if (change.update == "AudioQuery") {
            audioStore.mutations.SET_AUDIO_QUERY(state, {
              audioKey,
              audioQuery: change.query,
            });
          }
          if (shouldApplyPreset) {
            audioStore.mutations.APPLY_AUDIO_PRESET(state, {
              audioKey,
            });
          }
        }
      },
      async action(
        { state, dispatch, commit },
        { audioKeys, voice }: { audioKeys: AudioKey[]; voice: Voice },
      ) {
        const engineId = voice.engineId;
        const styleId = voice.styleId;
        await dispatch("SETUP_SPEAKER", { audioKeys, engineId, styleId });
        const errors: Record<AudioKey, unknown> = {};
        const changes: Record<
          AudioKey,
          | {
              update: "AccentPhrases";
              accentPhrases: AccentPhrase[];
            }
          | {
              update: "AudioQuery";
              query: AudioQuery;
            }
          | {
              update: "OnlyVoice";
            }
        > = {};

        for (const audioKey of audioKeys) {
          try {
            const audioItem = state.audioItems[audioKey];
            if (audioItem.query == undefined) {
              const query: AudioQuery = await dispatch("FETCH_AUDIO_QUERY", {
                text: audioItem.text,
                engineId: voice.engineId,
                styleId: voice.styleId,
              });
              changes[audioKey] = {
                update: "AudioQuery",
                query,
              };
            } else {
              const newAccentPhrases: AccentPhrase[] = await dispatch(
                "FETCH_MORA_DATA",
                {
                  accentPhrases: audioItem.query.accentPhrases,
                  engineId: voice.engineId,
                  styleId: voice.styleId,
                },
              );

              changes[audioKey] = {
                update: "AccentPhrases",
                accentPhrases: newAccentPhrases,
              };
            }
          } catch (error) {
            errors[audioKey] = error;
            changes[audioKey] = {
              update: "OnlyVoice",
            };
          }
        }

        commit("COMMAND_MULTI_CHANGE_VOICE", {
          voice,
          changes,
        });

        if (Object.keys(errors).length > 0) {
          throw new Error(
            `話者の変更に失敗しました：\n${Object.entries(errors)
              .map(([audioKey, error]) => `${audioKey}：${error}`)
              .join("\n")}`,
          );
        }
      },
    },

    COMMAND_CHANGE_ACCENT: {
      mutation(
        draft,
        {
          audioKey,
          accentPhrases,
        }: { audioKey: AudioKey; accentPhrases: AccentPhrase[] },
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
        }: { audioKey: AudioKey; accentPhraseIndex: number; accent: number },
      ) {
        const query = state.audioItems[audioKey].query;
        if (query != undefined) {
          const newAccentPhrases: AccentPhrase[] = JSON.parse(
            JSON.stringify(query.accentPhrases),
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
              },
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
        },
      ) {
        audioStore.mutations.SET_ACCENT_PHRASES(draft, payload);
      },
      async action(
        { state, dispatch, commit },
        payload: {
          audioKey: AudioKey;
          accentPhraseIndex: number;
        } & ({ isPause: false; moraIndex: number } | { isPause: true }),
      ) {
        const { audioKey, accentPhraseIndex } = payload;
        const query = state.audioItems[audioKey].query;

        const engineId = state.audioItems[audioKey].voice.engineId;
        const styleId = state.audioItems[audioKey].voice.styleId;

        if (query == undefined) {
          throw Error(
            "`COMMAND_CHANGE_ACCENT_PHRASE_SPLIT` should not be called if the query does not exist.",
          );
        }
        const newAccentPhrases: AccentPhrase[] = JSON.parse(
          JSON.stringify(query.accentPhrases),
        );
        const changeIndexes = [accentPhraseIndex];
        // toggleAccentPhrase to newAccentPhrases and record changeIndexes
        {
          const mergeAccent = (
            accentPhrases: AccentPhrase[],
            accentPhraseIndex: number,
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
            moraIndex: number,
          ) => {
            const newAccentPhrase1: AccentPhrase = {
              moras: accentPhrases[accentPhraseIndex].moras.slice(
                0,
                moraIndex + 1,
              ),
              accent:
                accentPhrases[accentPhraseIndex].accent > moraIndex
                  ? moraIndex + 1
                  : accentPhrases[accentPhraseIndex].accent,
              pauseMora: undefined,
            };
            const newAccentPhrase2: AccentPhrase = {
              moras: accentPhrases[accentPhraseIndex].moras.slice(
                moraIndex + 1,
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
              newAccentPhrase2,
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
            },
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
        },
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
        },
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
        },
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
            "'$1",
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
              }),
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
              .pauseMora == undefined
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
          (_, i) => accentPhraseIndex + i,
        );

        try {
          const resultAccentPhrases: AccentPhrase[] = await dispatch(
            "FETCH_AND_COPY_MORA_DATA",
            {
              accentPhrases: newAccentPhrases,
              engineId,
              styleId,
              copyIndexes,
            },
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

    COMMAND_MULTI_RESET_MORA_PITCH_AND_LENGTH: {
      async action({ state, dispatch, commit }, { audioKeys }) {
        for (const audioKey of audioKeys) {
          const engineId = state.audioItems[audioKey].voice.engineId;
          const styleId = state.audioItems[audioKey].voice.styleId;

          const query = state.audioItems[audioKey].query;
          if (query == undefined) throw new Error("assert query != undefined");

          const newAccentPhrases = await dispatch("FETCH_MORA_DATA", {
            accentPhrases: query.accentPhrases,
            engineId,
            styleId,
          });

          commit("COMMAND_CHANGE_ACCENT", {
            audioKey,
            accentPhrases: newAccentPhrases,
          });
        }
      },
    },

    COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH: {
      async action(
        { state, dispatch, commit },
        { audioKey, accentPhraseIndex },
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
        },
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
        },
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
        },
      ) {
        const maxPitch = 6.5;
        const minPitch = 3;
        const maxMoraLength = 0.3;
        const minMoraLength = 0;
        const { audioKey, accentPhraseIndex, moraIndex, data, type } = payload;
        const audioItem = draft.audioItems[audioKey];
        if (audioItem.query == undefined) {
          throw Error("draft.audioItems[audioKey].query == undefined");
        }
        const accentPhrase = audioItem.query.accentPhrases[accentPhraseIndex];
        const targetMora = accentPhrase.moras[moraIndex];

        let diffData = data;
        switch (type) {
          case "pitch":
            diffData -= targetMora.pitch;
            break;
          case "consonant":
            if (targetMora.consonantLength != undefined) {
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
                  Math.min(maxPitch, mora.pitch + diffData),
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
              if (mora.consonantLength != undefined) {
                audioStore.mutations.SET_AUDIO_MORA_DATA(draft, {
                  audioKey,
                  accentPhraseIndex,
                  moraIndex,
                  data: Math.max(
                    minMoraLength,
                    Math.min(maxMoraLength, mora.consonantLength + diffData),
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
                  Math.min(maxMoraLength, mora.vowelLength + diffData),
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
        },
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
        payload: { audioKeys: AudioKey[]; speedScale: number },
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
        payload: { audioKeys: AudioKey[]; pitchScale: number },
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_PITCH_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_INTONATION_SCALE: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; intonationScale: number },
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
        payload: { audioKeys: AudioKey[]; intonationScale: number },
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
        payload: { audioKeys: AudioKey[]; volumeScale: number },
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_VOLUME_SCALE", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; prePhonemeLength: number },
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
        payload: { audioKeys: AudioKey[]; prePhonemeLength: number },
      ) {
        commit("COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH", payload);
      },
    },

    COMMAND_MULTI_SET_AUDIO_POST_PHONEME_LENGTH: {
      mutation(
        draft,
        payload: { audioKeys: AudioKey[]; postPhonemeLength: number },
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
        payload: { audioKeys: AudioKey[]; postPhonemeLength: number },
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
        },
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
        },
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
        }: { audioKeys: AudioKey[]; presetKey: PresetKey | undefined },
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
        }: { audioKeys: AudioKey[]; presetKey: PresetKey | undefined },
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
          (audioKey) => draft.audioItems[audioKey].presetKey === presetKey,
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
        }: {
          audioKeyItemPairs: { audioKey: AudioKey; audioItem: AudioItem }[];
        },
      ) {
        audioStore.mutations.INSERT_AUDIO_ITEMS(draft, {
          audioKeyItemPairs,
          prevAudioKey: undefined,
        });
      },
      action: createUILockAction(
        async (
          { state, commit, dispatch, getters },
          { filePath }: { filePath?: string },
        ) => {
          if (!filePath) {
            filePath = await window.backend.showImportFileDialog({
              title: "セリフ読み込み",
            });
            if (!filePath) return;
          }
          let body = new TextDecoder("utf-8").decode(
            await window.backend.readFile({ filePath }).then(getValueOrThrow),
          );
          if (body.includes("\ufffd")) {
            body = new TextDecoder("shift-jis").decode(
              await window.backend.readFile({ filePath }).then(getValueOrThrow),
            );
          }
          const audioItems: AudioItem[] = [];
          let baseAudioItem: AudioItem | undefined = undefined;
          if (state._activeAudioKey != undefined) {
            baseAudioItem = state.audioItems[state._activeAudioKey];
          }

          const userOrderedCharacterInfos =
            getters.USER_ORDERED_CHARACTER_INFOS("talk");
          if (!userOrderedCharacterInfos)
            throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
          for (const { text, voice } of parseTextFile(
            body,
            state.defaultStyleIds,
            userOrderedCharacterInfos,
            baseAudioItem?.voice,
          )) {
            audioItems.push(
              await dispatch("GENERATE_AUDIO_ITEM", {
                text,
                voice,
                baseAudioItem,
              }),
            );
          }
          const audioKeyItemPairs = audioItems.map((audioItem) => ({
            audioItem,
            audioKey: generateAudioKey(),
          }));
          commit("COMMAND_IMPORT_FROM_FILE", {
            audioKeyItemPairs,
          });
        },
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
        },
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
          },
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
        },
      ),
    },
  }),
  "talk",
);
