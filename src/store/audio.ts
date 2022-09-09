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
} from "./type";
import { createUILockAction } from "./ui";
import {
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  MoraDataType,
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
    JSON.stringify([
      audioItem.text,
      audioQuery,
      audioItem.engineId,
      audioItem.styleId,
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
  const characters = new Map<string, number>();
  const uuid2StyleIds = new Map<string, number>();
  for (const defaultStyleId of defaultStyleIds) {
    const speakerUuid = defaultStyleId.speakerUuid;
    const styleId = defaultStyleId.defaultStyleId;
    uuid2StyleIds.set(speakerUuid, styleId);
  }
  // setup default characters
  for (const characterInfo of userOrderedCharacterInfos) {
    const uuid = characterInfo.metas.speakerUuid;
    const styleId = uuid2StyleIds.get(uuid);
    const speakerName = characterInfo.metas.speakerName;
    if (styleId == undefined)
      throw new Error(`styleId is undefined. speakerUuid: ${uuid}`);
    characters.set(speakerName, styleId);
  }
  // setup characters with style name
  for (const characterInfo of userOrderedCharacterInfos) {
    for (const style of characterInfo.metas.styles) {
      characters.set(
        `${characterInfo.metas.speakerName}(${style.styleName || "ノーマル"})`,
        style.styleId
      );
    }
  }
  if (!characters.size) return [];

  const audioItems: AudioItem[] = [];
  const seps = [",", "\r\n", "\n"];
  let lastStyleId = uuid2StyleIds.get(
    userOrderedCharacterInfos[0].metas.speakerUuid
  );
  if (lastStyleId == undefined) throw new Error(`lastStyleId is undefined.`);
  for (const splitText of body.split(new RegExp(`${seps.join("|")}`, "g"))) {
    const styleId = characters.get(splitText);
    if (styleId !== undefined) {
      lastStyleId = styleId;
      continue;
    }

    // FIXME: engineIdの追加
    audioItems.push({ text: splitText, styleId: lastStyleId });
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
  engineStates: {},
  characterInfos: {},
  audioItems: {},
  audioKeys: [],
  audioStates: {},
  // audio elementの再生オフセット
  audioPlayStartPoint: undefined,
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
    IS_ALL_ENGINE_READY: (state, getters) => {
      // NOTE: 1つもエンジンが登録されていない場合、準備完了していないことにする
      // レンダラープロセスがメインプロセスからエンジンリストを取得完了する前にレンダリングが行われるため、
      // IS_ALL_ENGINE_READYがエンジンリスト未初期化の状態で呼び出される可能性がある
      // この場合の意図しない挙動を抑制するためfalseを返す
      if (state.engineIds.length === 0) {
        return false;
      }

      for (const engineId of state.engineIds) {
        const isReady = getters.IS_ENGINE_READY(engineId);
        if (!isReady) return false;
      }
      return true; // state.engineStatesが空のときはtrue
    },
    IS_ENGINE_READY: (state) => (engineId) => {
      const engineState: EngineState | undefined = state.engineStates[engineId];
      if (engineState === undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      return engineState === "READY";
    },
    ACTIVE_AUDIO_ELEM_CURRENT_TIME: (state) => {
      return state._activeAudioKey !== undefined
        ? audioElements[state._activeAudioKey]?.currentTime
        : undefined;
    },
    CHARACTER_INFO: (state) => (engineId, styleId) => {
      return getCharacterInfo(state, engineId, styleId);
    },
    USER_ORDERED_CHARACTER_INFOS: (state, getters) => {
      const flattenCharacterInfos = getters.GET_FLATTEN_CHARACTER_INFOS;
      return flattenCharacterInfos.length !== 0
        ? flattenCharacterInfos.sort(
            (a, b) =>
              state.userCharacterOrder.indexOf(a.metas.speakerUuid) -
              state.userCharacterOrder.indexOf(b.metas.speakerUuid)
          )
        : undefined;
    },
  },

  mutations: {
    SET_ENGINE_STATE(
      state,
      { engineId, engineState }: { engineId: string; engineState: EngineState }
    ) {
      state.engineStates[engineId] = engineState;
    },
    SET_CHARACTER_INFOS(
      state,
      {
        engineId,
        characterInfos,
      }: { engineId: string; characterInfos: CharacterInfo[] }
    ) {
      state.characterInfos[engineId] = characterInfos;
    },
    SET_AUDIO_KEY_INITIALIZING_SPEAKER(
      state,
      { audioKey }: { audioKey?: string }
    ) {
      state.audioKeyInitializingSpeaker = audioKey;
    },
    SET_ACTIVE_AUDIO_KEY(state, { audioKey }: { audioKey?: string }) {
      state._activeAudioKey = audioKey;
    },
    SET_AUDIO_PLAY_START_POINT(state, { startPoint }: { startPoint?: number }) {
      state.audioPlayStartPoint = startPoint;
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
    SET_AUDIO_PRESET_KEY(
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
      {
        audioKey,
        engineId,
        styleId,
      }: { audioKey: string; engineId: string; styleId: number }
    ) {
      state.audioItems[audioKey].engineId = engineId;
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
    START_WAITING_ENGINE_ALL: createUILockAction(
      async ({ state, dispatch }) => {
        const engineIds = state.engineIds;

        for (const engineId of engineIds) {
          await dispatch("START_WAITING_ENGINE", {
            engineId,
          });
        }
      }
    ),
    START_WAITING_ENGINE: createUILockAction(
      async ({ state, commit, dispatch }, { engineId }) => {
        let engineState: EngineState | undefined = state.engineStates[engineId];
        if (engineState === undefined)
          throw new Error(`No such engineState set: engineId == ${engineId}`);

        for (let i = 0; i < 100; i++) {
          engineState = state.engineStates[engineId]; // FIXME: explicit undefined
          if (engineState === undefined)
            throw new Error(`No such engineState set: engineId == ${engineId}`);

          if (engineState === "FAILED_STARTING") {
            break;
          }

          try {
            await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
              engineId,
            }).then((instance) => instance.invoke("versionVersionGet")({}));
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            window.electron.logInfo(`Waiting engine ${engineId}`);
            continue;
          }
          engineState = "READY";
          commit("SET_ENGINE_STATE", { engineId, engineState });
          break;
        }

        if (engineState !== "READY") {
          commit("SET_ENGINE_STATE", {
            engineId,
            engineState: "FAILED_STARTING",
          });
        }
      }
    ),
    LOAD_CHARACTER_ALL: createUILockAction(async ({ state, dispatch }) => {
      for (const engineId of state.engineIds) {
        window.electron.logInfo(`Load CharacterInfo from engine ${engineId}`);
        await dispatch("LOAD_CHARACTER", { engineId });
      }
    }),
    LOAD_CHARACTER: createUILockAction(
      async ({ commit, dispatch }, { engineId }) => {
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
        const getStyles = function (
          speaker: Speaker,
          speakerInfo: SpeakerInfo
        ) {
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

        commit("SET_CHARACTER_INFOS", { engineId, characterInfos });
      }
    ),
    GENERATE_AUDIO_KEY() {
      const audioKey = uuidv4();
      audioElements[audioKey] = new Audio();
      return audioKey;
    },
    /**
     * 指定した話者（スタイルID）がエンジン側で初期化されているか
     */
    async IS_INITIALIZED_ENGINE_SPEAKER({ dispatch }, { engineId, styleId }) {
      // FIXME: なぜかbooleanではなくstringが返ってくる。
      // おそらくエンジン側のresponse_modelをBaseModel継承にしないといけない。
      const isInitialized: string = await dispatch(
        "INSTANTIATE_ENGINE_CONNECTOR",
        {
          engineId,
        }
      ).then(
        (instance) =>
          instance.invoke("isInitializedSpeakerIsInitializedSpeakerGet")({
            speaker: styleId,
          }) as unknown as string
      );
      if (isInitialized !== "true" && isInitialized !== "false")
        throw new Error(`Failed to get isInitialized.`);

      return isInitialized === "true";
    },
    /**
     * 指定した話者（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async INITIALIZE_ENGINE_SPEAKER({ dispatch }, { engineId, styleId }) {
      await dispatch("ASYNC_UI_LOCK", {
        callback: () =>
          dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          }).then((instance) =>
            instance.invoke("initializeSpeakerInitializeSpeakerPost")({
              speaker: styleId,
            })
          ),
      });
    },
    /**
     * AudioItemに設定される話者（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async SETUP_SPEAKER({ commit, dispatch }, { engineId, audioKey, styleId }) {
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
    REMOVE_ALL_AUDIO_ITEM({ commit, state }) {
      for (const audioKey of [...state.audioKeys]) {
        commit("REMOVE_AUDIO_ITEM", { audioKey });
      }
    },
    async GENERATE_AUDIO_ITEM(
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
    SET_ACTIVE_AUDIO_KEY(
      { commit, dispatch },
      { audioKey }: { audioKey?: string }
    ) {
      commit("SET_ACTIVE_AUDIO_KEY", { audioKey });
      // reset audio play start point
      dispatch("SET_AUDIO_PLAY_START_POINT", { startPoint: undefined });
    },
    SET_AUDIO_PLAY_START_POINT(
      { commit },
      { startPoint }: { startPoint?: number }
    ) {
      commit("SET_AUDIO_PLAY_START_POINT", { startPoint });
    },
    async GET_AUDIO_CACHE(
      { state, dispatch },
      { audioKey }: { audioKey: string }
    ) {
      const audioItem = state.audioItems[audioKey];
      return dispatch("GET_AUDIO_CACHE_FROM_AUDIO_ITEM", { audioItem });
    },
    async GET_AUDIO_CACHE_FROM_AUDIO_ITEM(
      { state },
      { audioItem }: { audioItem: AudioItem }
    ) {
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
    FETCH_MORA_DATA(
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
    async FETCH_AND_COPY_MORA_DATA(
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
    FETCH_AUDIO_QUERY(
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
    GET_AUDIO_PLAY_OFFSETS({ state }, { audioKey }: { audioKey: string }) {
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
    CONNECT_AUDIO: createUILockAction(
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
    async GENERATE_AUDIO(
      { dispatch, state },
      { audioKey }: { audioKey: string }
    ) {
      const audioItem: AudioItem = JSON.parse(
        JSON.stringify(state.audioItems[audioKey])
      );
      return dispatch("GENERATE_AUDIO_FROM_AUDIO_ITEM", { audioItem });
    },
    GENERATE_AUDIO_FROM_AUDIO_ITEM: createUILockAction(
      async ({ dispatch, state }, { audioItem }: { audioItem: AudioItem }) => {
        const engineId = audioItem.engineId;
        if (engineId === undefined)
          throw new Error(`engineId is not defined for audioItem`);

        const [id, audioQuery] = await generateUniqueIdAndQuery(
          state,
          audioItem
        );
        const speaker = audioItem.styleId;
        if (audioQuery == undefined || speaker == undefined) {
          return null;
        }

        return dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
          .then((instance) =>
            instance.invoke("synthesisSynthesisPost")({
              audioQuery,
              speaker,
              enableInterrogativeUpspeak:
                state.experimentalSetting.enableInterrogativeUpspeak,
            })
          )
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

        let writeFileResult = window.electron.writeFile({
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

          writeFileResult = window.electron.writeFile({
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

          writeFileResult = window.electron.writeFile({
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
    CONNECT_AND_EXPORT_TEXT: createUILockAction(
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

        const characters = new Map<number, string>();

        if (!getters.USER_ORDERED_CHARACTER_INFOS)
          throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

        for (const characterInfo of getters.USER_ORDERED_CHARACTER_INFOS) {
          for (const style of characterInfo.metas.styles) {
            characters.set(
              style.styleId,
              `${characterInfo.metas.speakerName}(${
                style.styleName || "ノーマル"
              })`
            );
          }
        }

        const texts: string[] = [];
        for (const audioKey of state.audioKeys) {
          const styleId = state.audioItems[audioKey].styleId;
          const speakerName =
            styleId !== undefined ? characters.get(styleId) + "," : "";

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
    PLAY_AUDIO: createUILockAction(
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
          blob = await dispatch("GENERATE_AUDIO", { audioKey });
          commit("SET_AUDIO_NOW_GENERATING", {
            audioKey,
            nowGenerating: false,
          });
          if (!blob) {
            throw new Error();
          }
        }

        return dispatch("PLAY_AUDIO_BLOB", {
          audioBlob: blob,
          audioElem,
          audioKey,
        });
      }
    ),
    PLAY_AUDIO_BLOB: createUILockAction(
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
    STOP_AUDIO(_, { audioKey }: { audioKey: string }) {
      const audioElem = audioElements[audioKey];
      audioElem.pause();
    },
    PLAY_CONTINUOUSLY_AUDIO: createUILockAction(
      async ({ state, commit, dispatch }) => {
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
    DETECTED_ENGINE_ERROR({ state, commit }, { engineId }) {
      const engineState: EngineState | undefined = state.engineStates[engineId];
      if (engineState === undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      switch (engineState) {
        case "STARTING":
          commit("SET_ENGINE_STATE", {
            engineId,
            engineState: "FAILED_STARTING",
          });
          break;
        case "READY":
          commit("SET_ENGINE_STATE", { engineId, engineState: "ERROR" });
          break;
        default:
          commit("SET_ENGINE_STATE", { engineId, engineState: "ERROR" });
      }
    },
    async RESTART_ENGINE_ALL({ state, dispatch }) {
      // NOTE: 暫定実装、すべてのエンジンの再起動に成功した場合に、成功とみなす
      let allSuccess = true;
      const engineIds = state.engineIds;

      for (const engineId of engineIds) {
        const success = await dispatch("RESTART_ENGINE", {
          engineId,
        });
        allSuccess = allSuccess && success;
      }

      return allSuccess;
    },
    async RESTART_ENGINE({ dispatch, commit, state }, { engineId }) {
      commit("SET_ENGINE_STATE", { engineId, engineState: "STARTING" });
      const success = await window.electron
        .restartEngine(engineId)
        .then(async () => {
          await dispatch("START_WAITING_ENGINE", { engineId });
          return state.engineStates[engineId] === "READY";
        })
        .catch(async () => {
          await dispatch("DETECTED_ENGINE_ERROR", { engineId });
          return false;
        });
      return success;
    },

    OPEN_ENGINE_DIRECTORY(_, { engineId }) {
      return window.electron.openEngineDirectory(engineId);
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
      const engineId = state.audioItems[audioKey].engineId;
      if (engineId === undefined)
        throw new Error("assert engineId !== undefined");

      const styleId = state.audioItems[audioKey].styleId;
      if (styleId === undefined)
        throw new Error("assert styleId !== undefined");

      const query: AudioQuery | undefined = state.audioItems[audioKey].query;
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
    async COMMAND_CHANGE_STYLE_ID(
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
    async COMMAND_RESET_MORA_PITCH_AND_LENGTH(
      { state, dispatch, commit },
      { audioKey }
    ) {
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
    async COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH(
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
    COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE(
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
    COMMAND_PUT_TEXTS: createUILockAction(
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
        const audioKeyItemPairs: { audioKey: string; audioItem: AudioItem }[] =
          [];
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
      payload: { engineId: string; styleId: number; audioKey: string } & (
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
    COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE(
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
      audioStore.mutations.SET_AUDIO_PRESET_KEY(draft, { audioKey, presetKey });
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
