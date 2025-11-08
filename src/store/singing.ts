import { ref } from "vue";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
  SingingStoreState,
  SingingStoreTypes,
  SingingCommandStoreState,
  SingingCommandStoreTypes,
  SaveResultObject,
  Phrase,
  transformCommandStore,
  SingingVoice,
  SequencerEditTarget,
  PhraseKey,
  SequenceId,
  SingingVolumeKey,
  SingingVolume,
  SingingVoiceKey,
  EditorFrameAudioQueryKey,
  EditorFrameAudioQuery,
  TrackParameters,
  SingingPitchKey,
  SingingPitch,
} from "./type";
import {
  buildSongTrackAudioFileNameFromRawData,
  currentDateString,
  DEFAULT_PROJECT_NAME,
  DEFAULT_STYLE_NAME,
  generateLabelFileData,
  PhonemeTimingLabel,
  sanitizeFileName,
} from "./utility";
import {
  CharacterInfo,
  EngineId,
  NoteId,
  StyleId,
  TrackId,
} from "@/type/preload";
import { Note as NoteForRequestToEngine } from "@/openapi";
import { ResultError, getValueOrThrow } from "@/type/result";
import {
  AudioEvent,
  AudioPlayer,
  AudioSequence,
  ChannelStrip,
  Clipper,
  Limiter,
  NoteEvent,
  NoteSequence,
  OfflineTransport,
  PolySynth,
  Sequence,
  Transport,
} from "@/sing/audioRendering";
import {
  getNoteDuration,
  isValidNote,
  isValidSnapType,
  isValidTempo,
  isValidTimeSignature,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
  secondToTick,
  tickToSecond,
  VALUE_INDICATING_NO_DATA,
  isValidPitchEditData,
  isValidTempos,
  isValidTimeSignatures,
  isValidTpqn,
  DEFAULT_TPQN,
  DEPRECATED_DEFAULT_EDITOR_FRAME_RATE,
  createDefaultTrack,
  createDefaultTempo,
  createDefaultTimeSignature,
  isValidNotes,
  isValidTrack,
  isTracksEmpty,
  shouldPlayTracks,
  toPhonemes,
  toPhonemeTimings,
  applyPhonemeTimingEdit,
  adjustPhonemeTimings,
  isValidLoopRange,
} from "@/sing/domain";
import { getOverlappingNoteIds } from "@/sing/storeHelper";
import {
  AnimationTimer,
  createArray,
  createPromiseThatResolvesWhen,
  getNext,
  round,
} from "@/sing/utility";
import { getWorkaroundKeyRangeAdjustment } from "@/sing/workaroundKeyRangeAdjustment";
import { createLogger } from "@/helpers/log";
import { getOrThrow } from "@/helpers/mapHelper";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { ufProjectToVoicevox } from "@/sing/utaformatixProject/toVoicevox";
import { uuid4 } from "@/helpers/random";
import { generateWriteErrorMessage } from "@/helpers/fileHelper";
import { generateWavFileData } from "@/helpers/fileDataGenerator";
import path from "@/helpers/path";
import { showAlertDialog } from "@/components/Dialog/Dialog";
import { ufProjectFromVoicevox } from "@/sing/utaformatixProject/fromVoicevox";
import { generateUniqueFilePath } from "@/sing/fileUtils";
import {
  isMultiFileProjectFormat,
  isSingleFileProjectFormat,
  projectFileExtensions,
  ufProjectToMultiFile,
  ufProjectToSingleFile,
} from "@/sing/utaformatixProject/utils";
import { ExhaustiveError, UnreachableError } from "@/type/utility";
import {
  CacheLoadedEvent,
  PhraseRenderingCompleteEvent,
  PhraseRenderingErrorEvent,
  PhraseRenderingStartedEvent,
  PitchGenerationCompleteEvent,
  QueryGenerationCompleteEvent,
  SongTrackRenderer,
  VoiceSynthesisCompleteEvent,
  VolumeGenerationCompleteEvent,
} from "@/sing/songTrackRendering";
import type {
  Note,
  Singer,
  Tempo,
  TimeSignature,
  Track,
} from "@/domain/project/type";
import { noteSchema } from "@/domain/project/schema";
import { toEditorTrack } from "@/infrastructures/projectFile/conversion";

const logger = createLogger("store/singing");

const generateAudioEvents = async (
  audioContext: BaseAudioContext,
  time: number,
  blob: Blob,
): Promise<AudioEvent[]> => {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  return [{ time, buffer }];
};

const generateNoteEvents = (notes: Note[], tempos: Tempo[], tpqn: number) => {
  return notes.map((value): NoteEvent => {
    const noteOnPos = value.position;
    const noteOffPos = value.position + value.duration;
    return {
      noteNumber: value.noteNumber,
      noteOnTime: tickToSecond(noteOnPos, tempos, tpqn),
      noteOffTime: tickToSecond(noteOffPos, tempos, tpqn),
    };
  });
};

const generateDefaultSongFileBaseName = (
  projectName: string | undefined,
  selectedTrack: Track,
  getCharacterInfo: (
    engineId: EngineId,
    styleId: StyleId,
  ) => CharacterInfo | undefined,
) => {
  if (projectName) {
    return projectName;
  }

  const singer = selectedTrack.singer;
  if (singer) {
    const singerName = getCharacterInfo(singer.engineId, singer.styleId)?.metas
      .speakerName;
    if (singerName) {
      const notes = selectedTrack.notes.slice(0, 5);
      const beginningPartLyrics = notes.map((note) => note.lyric).join("");
      return sanitizeFileName(`${singerName}_${beginningPartLyrics}`);
    }
  }

  return DEFAULT_PROJECT_NAME;
};

const offlineRenderTracks = async (
  numberOfChannels: number,
  sampleRate: number,
  renderDuration: number,
  withLimiter: boolean,
  shouldApplyTrackParameters: TrackParameters,
  tracks: Map<TrackId, Track>,
  phrases: Map<PhraseKey, Phrase>,
  singingVoices: Map<SingingVoiceKey, SingingVoice>,
) => {
  const offlineAudioContext = new OfflineAudioContext(
    numberOfChannels,
    sampleRate * renderDuration,
    sampleRate,
  );
  const offlineTransport = new OfflineTransport();
  const mainChannelStrip = new ChannelStrip(offlineAudioContext);
  const limiter = withLimiter ? new Limiter(offlineAudioContext) : undefined;
  const clipper = new Clipper(offlineAudioContext);
  const trackChannelStrips = new Map<TrackId, ChannelStrip>();
  const shouldPlays = shouldPlayTracks(tracks);
  for (const [trackId, track] of tracks) {
    const channelStrip = new ChannelStrip(offlineAudioContext);
    channelStrip.volume = shouldApplyTrackParameters.gain ? track.gain : 1;
    channelStrip.pan =
      shouldApplyTrackParameters.pan && numberOfChannels === 2 ? track.pan : 0;
    channelStrip.mute = shouldApplyTrackParameters.soloAndMute
      ? !shouldPlays.has(trackId)
      : false;

    channelStrip.output.connect(mainChannelStrip.input);
    trackChannelStrips.set(trackId, channelStrip);
  }

  for (const phrase of phrases.values()) {
    if (phrase.singingVoiceKey == undefined || phrase.state !== "RENDERED") {
      continue;
    }
    const singingVoice = getOrThrow(singingVoices, phrase.singingVoiceKey);

    // TODO: この辺りの処理を共通化する
    const audioEvents = await generateAudioEvents(
      offlineAudioContext,
      phrase.startTime,
      singingVoice,
    );
    const audioPlayer = new AudioPlayer(offlineAudioContext);
    const audioSequence: AudioSequence = {
      type: "audio",
      audioPlayer,
      audioEvents,
    };
    const channelStrip = getOrThrow(trackChannelStrips, phrase.trackId);
    audioPlayer.output.connect(channelStrip.input);
    offlineTransport.addSequence(audioSequence);
  }
  mainChannelStrip.volume = 1;
  if (limiter) {
    mainChannelStrip.output.connect(limiter.input);
    limiter.output.connect(clipper.input);
  } else {
    mainChannelStrip.output.connect(clipper.input);
  }
  clipper.output.connect(offlineAudioContext.destination);

  // スケジューリングを行い、オフラインレンダリングを実行
  // TODO: オフラインレンダリング後にメモリーがきちんと開放されるか確認する
  offlineTransport.schedule(0, renderDuration);
  const audioBuffer = await offlineAudioContext.startRendering();

  return audioBuffer;
};

type PhraseSequenceInfo =
  | {
      readonly type: "note";
      readonly sequenceId: SequenceId;
    }
  | {
      readonly type: "audio";
      readonly sequenceId: SequenceId;
      readonly singingVoiceKey: SingingVoiceKey;
    };

let audioContext: AudioContext | undefined;
let transport: Transport | undefined;
let previewSynth: PolySynth | undefined;
let mainChannelStrip: ChannelStrip | undefined;
const trackChannelStrips = new Map<TrackId, ChannelStrip>();
let limiter: Limiter | undefined;
let clipper: Clipper | undefined;

// NOTE: テスト時はAudioContextが存在しない
if (window.AudioContext) {
  audioContext = new AudioContext();
  transport = new Transport(audioContext);
  previewSynth = new PolySynth(audioContext);
  mainChannelStrip = new ChannelStrip(audioContext);
  limiter = new Limiter(audioContext);
  clipper = new Clipper(audioContext);

  previewSynth.output.connect(mainChannelStrip.input);
  mainChannelStrip.output.connect(limiter.input);
  limiter.output.connect(clipper.input);
  clipper.output.connect(audioContext.destination);

  audioContext.addEventListener("statechange", () => {
    logger.info(`AudioContext state changed: ${audioContext?.state}`);
  });
}

let songTrackRenderer: SongTrackRenderer | undefined = undefined;

const playheadPosition = ref(0); // 単位はtick
const phraseSingingVoices = new Map<SingingVoiceKey, SingingVoice>();
const phraseSequenceInfos = new Map<PhraseKey, PhraseSequenceInfo>();
const sequences = new Map<SequenceId, Sequence & { trackId: TrackId }>();
const animationTimer = new AnimationTimer();

const initialTrackId = TrackId(uuid4());

const setPhraseSingingVoices = (
  singingVoices: Map<SingingVoiceKey, SingingVoice>,
) => {
  phraseSingingVoices.clear();
  for (const [key, singingVoice] of singingVoices) {
    phraseSingingVoices.set(key, singingVoice);
  }
};

/**
 * シーケンスの音源の出力を取得する。
 * @param sequence シーケンス
 * @returns シーケンスの音源の出力
 */
const getOutputOfAudioSource = (sequence: Sequence) => {
  if (sequence.type === "note") {
    return sequence.instrument.output;
  } else if (sequence.type === "audio") {
    return sequence.audioPlayer.output;
  } else {
    throw new Error("Unknown type of sequence.");
  }
};

/**
 * シーケンスを登録する。
 * ChannelStripが存在する場合は、ChannelStripにシーケンスを接続する。
 * @param sequenceId シーケンスID
 * @param sequence トラックIDを持つシーケンス
 */
const registerSequence = (
  sequenceId: SequenceId,
  sequence: Sequence & { trackId: TrackId },
) => {
  if (transport == undefined) {
    throw new Error("transport is undefined.");
  }
  if (sequences.has(sequenceId)) {
    throw new Error("Sequence already exists.");
  }
  sequences.set(sequenceId, sequence);

  // Transportに追加する
  transport.addSequence(sequence);

  // ChannelStripがある場合は接続する
  const channelStrip = trackChannelStrips.get(sequence.trackId);
  if (channelStrip != undefined) {
    getOutputOfAudioSource(sequence).connect(channelStrip.input);
  }
};

/**
 * シーケンスを削除する。
 * ChannelStripが存在する場合は、ChannelStripとシーケンスの接続を解除する。
 * @param sequenceId シーケンスID
 */
const deleteSequence = (sequenceId: SequenceId) => {
  if (transport == undefined) {
    throw new Error("transport is undefined.");
  }
  const sequence = sequences.get(sequenceId);
  if (sequence == undefined) {
    throw new Error("Sequence does not exist.");
  }
  sequences.delete(sequenceId);

  // Transportから削除する
  transport.removeSequence(sequence);

  // ChannelStripがある場合は接続を解除する
  if (trackChannelStrips.has(sequence.trackId)) {
    getOutputOfAudioSource(sequence).disconnect();
  }
};

/**
 * シーケンスが登録されているかどうかを確認する。
 *
 * @param sequenceId シーケンスID。
 * @returns シーケンスが登録されている場合はtrue、そうでない場合はfalse。
 */
const isRegisteredSequence = (sequenceId: SequenceId) => {
  return sequences.has(sequenceId);
};

/**
 * ノートシーケンスを生成する。
 */
const generateNoteSequence = (
  notes: Note[],
  tempos: Tempo[],
  tpqn: number,
  trackId: TrackId,
): NoteSequence & { trackId: TrackId } => {
  if (!audioContext) {
    throw new Error("audioContext is undefined.");
  }
  const noteEvents = generateNoteEvents(notes, tempos, tpqn);
  const polySynth = new PolySynth(audioContext);
  return {
    type: "note",
    instrument: polySynth,
    noteEvents,
    trackId,
  };
};

/**
 * オーディオシーケンスを生成する。
 */
const generateAudioSequence = async (
  startTime: number,
  blob: Blob,
  trackId: TrackId,
): Promise<AudioSequence & { trackId: TrackId }> => {
  if (!audioContext) {
    throw new Error("audioContext is undefined.");
  }
  const audioEvents = await generateAudioEvents(audioContext, startTime, blob);
  const audioPlayer = new AudioPlayer(audioContext);
  return {
    type: "audio",
    audioPlayer,
    audioEvents,
    trackId,
  };
};

/**
 * フレーズの状態と再生されるシーケンスの状態を同期させる。
 * 不要なシーケンスを削除し、不足しているシーケンスを生成する。
 */
const syncPhraseSequences = (
  phrases: Map<PhraseKey, Phrase>,
  phraseSingingVoices: Map<SingingVoiceKey, SingingVoice>,
  tempos: Tempo[],
  tpqn: number,
) => {
  // 不要になったシーケンスを削除する
  deleteUnnecessarySequences(phrases, phraseSequenceInfos);

  // 不足しているシーケンスを新しく作成する
  createMissingSequences(
    phrases,
    phraseSingingVoices,
    tempos,
    tpqn,
    phraseSequenceInfos,
  );
};

/**
 * 不要になったフレーズシーケンスを削除する。
 *
 * 以下の場合に不要と判断される。
 * - フレーズ自体が削除された
 * - レンダリング状態が変わり、シーケンスのタイプが不一致になった
 * - 歌声が変更された
 */
const deleteUnnecessarySequences = (
  phrases: Map<PhraseKey, Phrase>,
  phraseSequenceInfos: Map<PhraseKey, PhraseSequenceInfo>,
) => {
  for (const [phraseKey, sequenceInfo] of phraseSequenceInfos) {
    const phrase = phrases.get(phraseKey);

    let needToDelete = false;

    if (phrase == undefined) {
      // フレーズが無くなった場合は、既存のシーケンスを削除する
      needToDelete = true;
    } else if (
      phrase.state === "RENDERED" &&
      (sequenceInfo.type === "note" ||
        sequenceInfo.singingVoiceKey !== phrase.singingVoiceKey)
    ) {
      // フレーズがレンダリング済みの状態に更新された、または歌声が変更された場合は、
      // フレーズは最新の歌声のオーディオシーケンスで再生される必要があるので、
      // 既存の仮再生用のノートシーケンスまたは歌声が変更される前のオーディオシーケンスを削除する
      needToDelete = true;
    } else if (phrase.state !== "RENDERED" && sequenceInfo.type === "audio") {
      // レンダリング済みのフレーズが、再び未レンダリングの状態に戻った場合は、
      // フレーズは仮再生用のノートシーケンスで再生される必要があるので、
      // 既存のオーディオシーケンスを削除する
      needToDelete = true;
    }

    // TODO: ピッチを編集したときは行わないようにする
    if (needToDelete) {
      phraseSequenceInfos.delete(phraseKey);
      if (isRegisteredSequence(sequenceInfo.sequenceId)) {
        deleteSequence(sequenceInfo.sequenceId);
        logger.info(`Deleted sequence. ID: ${sequenceInfo.sequenceId}`);
      }
    }
  }
};

/**
 * 不足しているフレーズシーケンスを状態に応じて生成・登録する。
 */
const createMissingSequences = (
  phrases: Map<PhraseKey, Phrase>,
  phraseSingingVoices: Map<SingingVoiceKey, SingingVoice>,
  tempos: Tempo[],
  tpqn: number,
  phraseSequenceInfos: Map<PhraseKey, PhraseSequenceInfo>,
) => {
  for (const [phraseKey, phrase] of phrases) {
    // 既にシーケンスが存在する場合は、この関数では何もしない
    if (phraseSequenceInfos.has(phraseKey)) {
      continue;
    }

    // フレーズの状態に応じて、適切なシーケンス生成処理を呼び出す
    if (phrase.state === "RENDERED") {
      createAudioSequenceForPhrase(
        phraseKey,
        phrase,
        phraseSingingVoices,
        phraseSequenceInfos,
      );
    } else {
      createNoteSequenceForPhrase(
        phraseKey,
        phrase,
        tempos,
        tpqn,
        phraseSequenceInfos,
      );
    }
  }
};

/**
 * 指定されたフレーズのオーディオシーケンスを非同期で生成・登録する。
 */
const createAudioSequenceForPhrase = (
  phraseKey: PhraseKey,
  phrase: Phrase,
  phraseSingingVoices: Map<SingingVoiceKey, SingingVoice>,
  phraseSequenceInfos: Map<PhraseKey, PhraseSequenceInfo>,
) => {
  if (phrase.singingVoiceKey == undefined) {
    throw new UnreachableError("phrase.singingVoiceKey is undefined.");
  }
  const singingVoice = getOrThrow(phraseSingingVoices, phrase.singingVoiceKey);

  const newSequenceId = SequenceId(uuid4());
  phraseSequenceInfos.set(phraseKey, {
    type: "audio",
    sequenceId: newSequenceId,
    singingVoiceKey: phrase.singingVoiceKey,
  });

  const audioSequencePromise = generateAudioSequence(
    phrase.startTime,
    singingVoice,
    phrase.trackId,
  );

  // Promise解決時に、情報が古くなっていないか確認してから登録する
  void audioSequencePromise.then((audioSequence) => {
    const currentSequenceInfo = phraseSequenceInfos.get(phraseKey);
    if (
      currentSequenceInfo != undefined &&
      currentSequenceInfo.sequenceId === newSequenceId
    ) {
      registerSequence(newSequenceId, audioSequence);
      logger.info(`Registered audio sequence. ID: ${newSequenceId}`);
    }
  });
};

/**
 * 指定されたフレーズのノートシーケンスを生成・登録する。
 */
const createNoteSequenceForPhrase = (
  phraseKey: PhraseKey,
  phrase: Phrase,
  tempos: Tempo[],
  tpqn: number,
  phraseSequenceInfos: Map<PhraseKey, PhraseSequenceInfo>,
) => {
  const newSequenceId = SequenceId(uuid4());
  phraseSequenceInfos.set(phraseKey, {
    type: "note",
    sequenceId: newSequenceId,
  });

  const noteSequence = generateNoteSequence(
    phrase.notes,
    tempos,
    tpqn,
    phrase.trackId,
  );

  registerSequence(newSequenceId, noteSequence);
  logger.info(`Registered note sequence. ID: ${newSequenceId}`);
};

/**
 * `tracks`と`trackChannelStrips`を同期する。
 * シーケンスが存在する場合は、ChannelStripとシーケンスの接続・接続の解除を行う。
 * @param tracks `state`の`tracks`
 */
const syncTracksAndTrackChannelStrips = (tracks: Map<TrackId, Track>) => {
  if (audioContext == undefined) {
    throw new Error("audioContext is undefined.");
  }
  if (mainChannelStrip == undefined) {
    throw new Error("mainChannelStrip is undefined.");
  }

  const shouldPlays = shouldPlayTracks(tracks);
  for (const [trackId, track] of tracks) {
    if (!trackChannelStrips.has(trackId)) {
      const channelStrip = new ChannelStrip(audioContext);
      channelStrip.output.connect(mainChannelStrip.input);
      trackChannelStrips.set(trackId, channelStrip);

      // シーケンスがある場合は、それらを接続する
      for (const [sequenceId, sequence] of sequences) {
        if (trackId === sequence.trackId) {
          const sequence = sequences.get(sequenceId);
          if (sequence == undefined) {
            throw new Error("Sequence does not exist.");
          }
          getOutputOfAudioSource(sequence).connect(channelStrip.input);
        }
      }
    }

    const channelStrip = getOrThrow(trackChannelStrips, trackId);
    channelStrip.volume = track.gain;
    channelStrip.pan = track.pan;
    channelStrip.mute = !shouldPlays.has(trackId);
  }
  for (const [trackId, channelStrip] of trackChannelStrips) {
    if (!tracks.has(trackId)) {
      channelStrip.output.disconnect();
      trackChannelStrips.delete(trackId);

      // シーケンスがある場合は、それらの接続を解除する
      for (const [sequenceId, sequence] of sequences) {
        if (trackId === sequence.trackId) {
          const sequence = sequences.get(sequenceId);
          if (sequence == undefined) {
            throw new Error("Sequence does not exist.");
          }
          getOutputOfAudioSource(sequence).disconnect();
        }
      }
    }
  }
};

/** トラックを取得する。見付からないときはフォールバックとして最初のトラックを返す。 */
const getSelectedTrackWithFallback = (partialState: {
  tracks: Map<TrackId, Track>;
  _selectedTrackId: TrackId;
  trackOrder: TrackId[];
}) => {
  if (!partialState.tracks.has(partialState._selectedTrackId)) {
    return getOrThrow(partialState.tracks, partialState.trackOrder[0]);
  }
  return getOrThrow(partialState.tracks, partialState._selectedTrackId);
};

export const singingStoreState: SingingStoreState = {
  tpqn: DEFAULT_TPQN,
  tempos: [createDefaultTempo(0)],
  timeSignatures: [createDefaultTimeSignature(1)],
  tracks: new Map([[initialTrackId, createDefaultTrack()]]),
  trackOrder: [initialTrackId],

  /**
   * 選択中のトラックID。
   * NOTE: このトラックIDは存在しない場合がある（Undo/Redoがあるため）。
   * 可能な限りgetters.SELECTED_TRACK_IDを使うこと。getSelectedTrackWithFallbackも参照。
   */
  _selectedTrackId: initialTrackId,

  editorFrameRate: DEPRECATED_DEFAULT_EDITOR_FRAME_RATE,
  phrases: new Map(),
  phraseQueries: new Map(),
  phraseSingingPitches: new Map(),
  phraseSingingVolumes: new Map(),
  sequencerZoomX: 0.5,
  sequencerZoomY: 0.75,
  sequencerSnapType: 16,
  sequencerEditTarget: "NOTE",
  sequencerNoteTool: "EDIT_FIRST",
  sequencerPitchTool: "DRAW",
  sequencerVolumeTool: "DRAW",
  sequencerVolumeVisible: false,
  _selectedNoteIds: new Set(),
  nowPlaying: false,
  volume: 0,
  startRenderingRequested: false,
  stopRenderingRequested: false,
  nowRendering: false,
  exportState: "NOT_EXPORTING",
  cancellationOfExportRequested: false,
  isSongSidebarOpen: false,
  isLoopEnabled: false,
  loopStartTick: 0,
  loopEndTick: 0,
};

export const singingStore = createPartialStore<SingingStoreTypes>({
  SELECTED_TRACK_ID: {
    getter(state) {
      // Undo/Redoで消えている場合は最初のトラックを選択していることにする
      if (!state.tracks.has(state._selectedTrackId)) {
        return state.trackOrder[0];
      }
      return state._selectedTrackId;
    },
  },

  SELECTED_NOTE_IDS: {
    // 選択中のトラックのノートだけを選択中のノートとして返す。
    getter(state) {
      const selectedTrack = getSelectedTrackWithFallback(state);

      const noteIdsInSelectedTrack = new Set(
        selectedTrack.notes.map((note) => note.id),
      );

      // そのままSet#intersectionを呼ぶとVueのバグでエラーになるため、new Set()でProxyなしのSetを作成する
      // TODO: https://github.com/vuejs/core/issues/11398 が解決したら修正する
      return new Set(state._selectedNoteIds).intersection(
        noteIdsInSelectedTrack,
      );
    },
  },

  SETUP_SINGER: {
    async action({ actions }, { singer }: { singer: Singer }) {
      // 指定されたstyleIdに対して、エンジン側の初期化を行う
      const isInitialized = await actions.IS_INITIALIZED_ENGINE_SPEAKER(singer);
      if (!isInitialized) {
        await actions.INITIALIZE_ENGINE_CHARACTER({
          engineId: singer.engineId,
          styleId: singer.styleId,
          uiLock: false,
        });
      }
    },
  },

  SET_SINGER: {
    // 歌手をセットする。
    // withRelatedがtrueの場合、関連する情報もセットする。
    mutation(state, { singer, withRelated, trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      track.singer = singer;

      if (withRelated == true && singer != undefined) {
        // 音域調整量マジックナンバーを設定するワークアラウンド
        const keyRangeAdjustment = getWorkaroundKeyRangeAdjustment(
          state.characterInfos,
          singer,
        );
        track.keyRangeAdjustment = keyRangeAdjustment;
      }
    },
    async action(
      { state, getters, actions, mutations },
      { singer, withRelated, trackId },
    ) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      const userOrderedCharacterInfos =
        getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
      if (userOrderedCharacterInfos == undefined)
        throw new Error("userOrderedCharacterInfos == undefined");

      const engineId = singer?.engineId ?? state.engineIds[0];

      const defaultStyleId =
        userOrderedCharacterInfos[0].metas.styles[0].styleId;
      const styleId = singer?.styleId ?? defaultStyleId;

      void actions.SETUP_SINGER({ singer: { engineId, styleId } });
      mutations.SET_SINGER({
        singer: { engineId, styleId },
        withRelated,
        trackId,
      });

      void actions.RENDER();
    },
  },

  SET_KEY_RANGE_ADJUSTMENT: {
    mutation(state, { keyRangeAdjustment, trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      track.keyRangeAdjustment = keyRangeAdjustment;
    },
    async action({ actions, mutations }, { keyRangeAdjustment, trackId }) {
      if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
        throw new Error("The keyRangeAdjustment is invalid.");
      }
      mutations.SET_KEY_RANGE_ADJUSTMENT({ keyRangeAdjustment, trackId });

      void actions.RENDER();
    },
  },

  SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation(state, { volumeRangeAdjustment, trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      track.volumeRangeAdjustment = volumeRangeAdjustment;
    },
    async action({ actions, mutations }, { volumeRangeAdjustment, trackId }) {
      if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
        throw new Error("The volumeRangeAdjustment is invalid.");
      }
      mutations.SET_VOLUME_RANGE_ADJUSTMENT({
        volumeRangeAdjustment,
        trackId,
      });

      void actions.RENDER();
    },
  },

  SET_TPQN: {
    mutation(state, { tpqn }: { tpqn: number }) {
      state.tpqn = tpqn;
    },
    async action(
      { state, getters, mutations, actions },
      { tpqn }: { tpqn: number },
    ) {
      if (!isValidTpqn(tpqn)) {
        throw new Error("The tpqn is invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await actions.SING_STOP_AUDIO();
      }
      mutations.SET_TPQN({ tpqn });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      void actions.RENDER();
    },
  },

  SET_TEMPOS: {
    mutation(state, { tempos }: { tempos: Tempo[] }) {
      state.tempos = tempos;
    },
    async action(
      { state, getters, mutations, actions },
      { tempos }: { tempos: Tempo[] },
    ) {
      if (!isValidTempos(tempos)) {
        throw new Error("The tempos are invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await actions.SING_STOP_AUDIO();
      }
      mutations.SET_TEMPOS({ tempos });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      void actions.RENDER();
    },
  },

  SET_TEMPO: {
    mutation(state, { tempo }: { tempo: Tempo }) {
      const index = state.tempos.findIndex((value) => {
        return value.position === tempo.position;
      });
      const tempos = [...state.tempos];
      if (index !== -1) {
        tempos.splice(index, 1, tempo);
      } else {
        tempos.push(tempo);
        tempos.sort((a, b) => a.position - b.position);
      }
      state.tempos = tempos;
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { position }: { position: number }) {
      const index = state.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) {
        throw new Error("The tempo does not exist.");
      }
      const tempos = [...state.tempos];
      if (index === 0) {
        tempos.splice(index, 1, createDefaultTempo(0));
      } else {
        tempos.splice(index, 1);
      }
      state.tempos = tempos;
    },
  },

  SET_TIME_SIGNATURES: {
    mutation(state, { timeSignatures }: { timeSignatures: TimeSignature[] }) {
      state.timeSignatures = timeSignatures;
    },
    async action(
      { mutations },
      { timeSignatures }: { timeSignatures: TimeSignature[] },
    ) {
      if (!isValidTimeSignatures(timeSignatures)) {
        throw new Error("The time signatures are invalid.");
      }
      mutations.SET_TIME_SIGNATURES({ timeSignatures });
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(state, { timeSignature }: { timeSignature: TimeSignature }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === timeSignature.measureNumber;
      });
      const timeSignatures = [...state.timeSignatures];
      if (index !== -1) {
        timeSignatures.splice(index, 1, timeSignature);
      } else {
        timeSignatures.push(timeSignature);
        timeSignatures.sort((a, b) => a.measureNumber - b.measureNumber);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { measureNumber }: { measureNumber: number }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === measureNumber;
      });
      if (index === -1) {
        throw new Error("The time signature does not exist.");
      }
      const timeSignatures = [...state.timeSignatures];
      if (index === 0) {
        timeSignatures.splice(index, 1, createDefaultTimeSignature(1));
      } else {
        timeSignatures.splice(index, 1);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  ALL_NOTE_IDS: {
    getter(state) {
      const noteIds = [...state.tracks.values()].flatMap((track) =>
        track.notes.map((note) => note.id),
      );
      return new Set(noteIds);
    },
  },

  OVERLAPPING_NOTE_IDS: {
    getter: (state) => (trackId) => {
      const notes = getOrThrow(state.tracks, trackId).notes;
      return getOverlappingNoteIds(notes);
    },
  },

  SET_NOTES: {
    mutation(state, { notes, trackId }) {
      state.editingLyricNoteId = undefined;
      state._selectedNoteIds.clear();
      const selectedTrack = getOrThrow(state.tracks, trackId);
      selectedTrack.notes = notes;
    },
    async action({ mutations, actions }, { notes, trackId }) {
      if (!isValidNotes(notes)) {
        throw new Error("The notes are invalid.");
      }
      mutations.SET_NOTES({ notes, trackId });

      void actions.RENDER();
    },
  },

  ADD_NOTES: {
    mutation(state, { notes, trackId }) {
      const selectedTrack = getOrThrow(state.tracks, trackId);
      const newNotes = [...selectedTrack.notes, ...notes];
      newNotes.sort((a, b) => a.position - b.position);
      selectedTrack.notes = newNotes;
    },
  },

  UPDATE_NOTES: {
    mutation(state, { notes, trackId }) {
      const notesMap = new Map<NoteId, Note>();
      for (const note of notes) {
        notesMap.set(note.id, note);
      }
      const selectedTrack = getOrThrow(state.tracks, trackId);
      selectedTrack.notes = selectedTrack.notes
        .map((value) => notesMap.get(value.id) ?? value)
        .sort((a, b) => a.position - b.position);
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds, trackId }) {
      const noteIdsSet = new Set(noteIds);
      const selectedTrack = getOrThrow(state.tracks, trackId);
      if (
        state.editingLyricNoteId != undefined &&
        noteIdsSet.has(state.editingLyricNoteId)
      ) {
        state.editingLyricNoteId = undefined;
      }
      for (const noteId of noteIds) {
        state._selectedNoteIds.delete(noteId);
      }
      selectedTrack.notes = selectedTrack.notes.filter((value) => {
        return !noteIdsSet.has(value.id);
      });
    },
  },

  SELECT_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      for (const noteId of noteIds) {
        state._selectedNoteIds.add(noteId);
      }
    },
    async action({ getters, mutations }, { noteIds }: { noteIds: NoteId[] }) {
      const existingNoteIds = getters.ALL_NOTE_IDS;
      const isValidNoteIds = noteIds.every((value) => {
        return existingNoteIds.has(value);
      });
      if (!isValidNoteIds) {
        throw new Error("The note ids are invalid.");
      }
      mutations.SELECT_NOTES({ noteIds });
    },
  },

  SELECT_ALL_NOTES_IN_TRACK: {
    async action({ state, mutations }, { trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      const noteIds = track.notes.map((note) => note.id);
      mutations.DESELECT_ALL_NOTES();
      mutations.SELECT_NOTES({ noteIds });
    },
  },

  DESELECT_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      for (const noteId of noteIds) {
        state._selectedNoteIds.delete(noteId);
      }
    },
    async action({ mutations }, { noteIds }: { noteIds: NoteId[] }) {
      mutations.DESELECT_NOTES({ noteIds });
    },
  },

  DESELECT_ALL_NOTES: {
    mutation(state) {
      state.editingLyricNoteId = undefined;
      state._selectedNoteIds = new Set();
    },
    async action({ mutations }) {
      mutations.DESELECT_ALL_NOTES();
    },
  },

  SET_EDITING_LYRIC_NOTE_ID: {
    mutation(state, { noteId }: { noteId?: NoteId }) {
      if (noteId != undefined && !state._selectedNoteIds.has(noteId)) {
        state._selectedNoteIds.clear();
        state._selectedNoteIds.add(noteId);
      }
      state.editingLyricNoteId = noteId;
    },
    async action({ getters, mutations }, { noteId }: { noteId?: NoteId }) {
      if (noteId != undefined && !getters.ALL_NOTE_IDS.has(noteId)) {
        throw new Error("The note id is invalid.");
      }
      mutations.SET_EDITING_LYRIC_NOTE_ID({ noteId });
    },
  },

  SET_PITCH_EDIT_DATA: {
    // ピッチ編集データをセットする。
    // track.pitchEditDataの長さが足りない場合は、伸長も行う。
    mutation(state, { pitchArray, startFrame, trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      const pitchEditData = track.pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = startFrame + pitchArray.length;
      if (tempData.length < endFrame) {
        const valuesToPush = new Array<number>(endFrame - tempData.length).fill(
          VALUE_INDICATING_NO_DATA,
        );
        tempData.push(...valuesToPush);
      }
      tempData.splice(startFrame, pitchArray.length, ...pitchArray);
      track.pitchEditData = tempData;
    },
    async action({ actions, mutations }, { pitchArray, startFrame, trackId }) {
      if (startFrame < 0) {
        throw new Error("startFrame must be greater than or equal to 0.");
      }
      if (!isValidPitchEditData(pitchArray)) {
        throw new Error("The pitch edit data is invalid.");
      }
      mutations.SET_PITCH_EDIT_DATA({ pitchArray, startFrame, trackId });

      void actions.RENDER();
    },
  },

  ERASE_PITCH_EDIT_DATA: {
    mutation(state, { startFrame, frameLength, trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      const pitchEditData = track.pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = Math.min(startFrame + frameLength, tempData.length);
      tempData.fill(VALUE_INDICATING_NO_DATA, startFrame, endFrame);
      track.pitchEditData = tempData;
    },
  },

  CLEAR_PITCH_EDIT_DATA: {
    // ピッチ編集データを失くす。
    mutation(state, { trackId }) {
      const track = getOrThrow(state.tracks, trackId);
      track.pitchEditData = [];
    },
    async action({ actions, mutations }, { trackId }) {
      mutations.CLEAR_PITCH_EDIT_DATA({ trackId });

      void actions.RENDER();
    },
  },

  /**
   * SongTrackRendererの生成とセットアップ（イベントリスナーの登録）を行う。
   */
  CREATE_AND_SETUP_SONG_TRACK_RENDERER: {
    async action({ state, actions, mutations }) {
      /**
       * `phrasesGenerated` イベントのハンドラ。
       * フレーズが生成された直後に呼び出される。現状ログ出力のみ。
       */
      const onPhrasesGenerated = () => {
        logger.info("Phrases generated.");
      };

      /**
       * `cacheLoaded` イベントのハンドラ。
       * キャッシュデータが読み込まれた後に呼び出される。
       * `store.state` を更新し、シーケンスの同期を行う。
       */
      const onCacheLoaded = (event: CacheLoadedEvent) => {
        const newPhrases = new Map<PhraseKey, Phrase>();
        const newPhraseQueries = new Map<
          EditorFrameAudioQueryKey,
          EditorFrameAudioQuery
        >();
        const newPhraseSingingPitches = new Map<
          SingingPitchKey,
          SingingPitch
        >();
        const newPhraseSingingVolumes = new Map<
          SingingVolumeKey,
          SingingVolume
        >();
        const newPhraseSingingVoices = new Map<SingingVoiceKey, SingingVoice>();

        // イベントで渡された各フレーズを処理
        for (const [phraseKey, eventPhrase] of event.phrases) {
          const singerIsNotSet = eventPhrase.singer == undefined;
          const renderingIsNeeded =
            eventPhrase.query == undefined ||
            eventPhrase.singingPitch == undefined ||
            eventPhrase.singingVolume == undefined ||
            eventPhrase.singingVoice == undefined;

          // store.state で保持する新しい Phrase オブジェクトを作成
          const newPhrase: Phrase = {
            firstRestDuration: eventPhrase.firstRestDuration,
            notes: eventPhrase.notes,
            startTime: eventPhrase.startTime,
            minNonPauseStartFrame: eventPhrase.minNonPauseStartFrame,
            maxNonPauseEndFrame: eventPhrase.maxNonPauseEndFrame,
            state: singerIsNotSet
              ? "SINGER_IS_NOT_SET" // シンガー未設定
              : renderingIsNeeded
                ? "WAITING_TO_BE_RENDERED" // レンダリング待ち
                : "RENDERED", // レンダリング完了 (キャッシュヒット)
            queryKey: eventPhrase.queryKey,
            singingPitchKey: eventPhrase.singingPitchKey,
            singingVolumeKey: eventPhrase.singingVolumeKey,
            singingVoiceKey: eventPhrase.singingVoiceKey,
            trackId: eventPhrase.trackId,
          };

          // フレーズをマップに追加
          newPhrases.set(phraseKey, newPhrase);

          // キャッシュヒットした各要素を対応するマップに追加
          if (
            eventPhrase.queryKey != undefined &&
            eventPhrase.query != undefined
          ) {
            newPhraseQueries.set(eventPhrase.queryKey, eventPhrase.query);
          }
          if (
            eventPhrase.singingPitchKey != undefined &&
            eventPhrase.singingPitch != undefined
          ) {
            newPhraseSingingPitches.set(
              eventPhrase.singingPitchKey,
              eventPhrase.singingPitch,
            );
          }
          if (
            eventPhrase.singingVolumeKey != undefined &&
            eventPhrase.singingVolume != undefined
          ) {
            newPhraseSingingVolumes.set(
              eventPhrase.singingVolumeKey,
              eventPhrase.singingVolume,
            );
          }
          if (
            eventPhrase.singingVoiceKey != undefined &&
            eventPhrase.singingVoice != undefined
          ) {
            newPhraseSingingVoices.set(
              eventPhrase.singingVoiceKey,
              eventPhrase.singingVoice,
            );
          }
        }

        // store.state を一括更新
        mutations.SET_PHRASES({ phrases: newPhrases });
        mutations.SET_PHRASE_QUERIES({ queries: newPhraseQueries });
        mutations.SET_PHRASE_SINGING_PITCHES({
          singingPitches: newPhraseSingingPitches,
        });
        mutations.SET_PHRASE_SINGING_VOLUMES({
          singingVolumes: newPhraseSingingVolumes,
        });
        setPhraseSingingVoices(newPhraseSingingVoices);

        // フレーズの状態と再生されるシーケンスの状態を同期させる
        syncPhraseSequences(
          state.phrases,
          phraseSingingVoices,
          event.snapshot.tempos,
          event.snapshot.tpqn,
        );

        logger.info("Cache loaded and applied to phrases.");
      };

      /**
       * `phraseRenderingStarted` イベントのハンドラ。
       * 特定のフレーズのレンダリングが開始されたときに呼び出される。
       * フレーズの状態を 'NOW_RENDERING' に設定する。
       */
      const onPhraseRenderingStarted = (event: PhraseRenderingStartedEvent) => {
        mutations.SET_STATE_TO_PHRASE({
          phraseKey: event.phraseKey,
          phraseState: "NOW_RENDERING",
        });

        logger.info("Phrase rendering started.");
      };

      /**
       * `queryGenerationComplete` イベントのハンドラ。
       * クエリの生成が完了したときに呼び出される。
       * 生成されたクエリをフレーズと紐づけて `store.state` で保持する。
       */
      const onQueryGenerationComplete = (
        event: QueryGenerationCompleteEvent,
      ) => {
        mutations.SET_PHRASE_QUERY({
          queryKey: event.queryKey,
          query: event.query,
        });
        mutations.SET_QUERY_KEY_TO_PHRASE({
          phraseKey: event.phraseKey,
          queryKey: event.queryKey,
        });

        const phonemes = event.query.phonemes
          .map((value) => value.phoneme)
          .join(" ");
        logger.info(`Generated query. phonemes: ${phonemes}`);
      };

      /**
       * `pitchGenerationComplete` イベントのハンドラ。
       * 歌唱ピッチの生成が完了したときに呼び出される。
       * 生成された歌唱ピッチをフレーズと紐づけて `store.state` で保持する。
       */
      const onPitchGenerationComplete = (
        event: PitchGenerationCompleteEvent,
      ) => {
        mutations.SET_PHRASE_SINGING_PITCH({
          singingPitchKey: event.singingPitchKey,
          singingPitch: event.singingPitch,
        });
        mutations.SET_SINGING_PITCH_KEY_TO_PHRASE({
          phraseKey: event.phraseKey,
          singingPitchKey: event.singingPitchKey,
        });

        logger.info(`Generated singing pitch.`);
      };

      /**
       * `volumeGenerationComplete` イベントのハンドラ。
       * 歌唱ボリュームの生成が完了したときに呼び出される。
       * 生成された歌唱ボリュームをフレーズと紐づけて `store.state` で保持する。
       */
      const onVolumeGenerationComplete = (
        event: VolumeGenerationCompleteEvent,
      ) => {
        mutations.SET_PHRASE_SINGING_VOLUME({
          singingVolumeKey: event.singingVolumeKey,
          singingVolume: event.singingVolume,
        });
        mutations.SET_SINGING_VOLUME_KEY_TO_PHRASE({
          phraseKey: event.phraseKey,
          singingVolumeKey: event.singingVolumeKey,
        });

        logger.info(`Generated singing volume.`);
      };

      /**
       * `voiceSynthesisComplete` イベントのハンドラ。
       * 歌声の合成が完了したときに呼び出される。
       * 合成された歌声をフレーズと紐づけて `phraseSingingVoices` で保持する。
       */
      const onVoiceSynthesisComplete = (event: VoiceSynthesisCompleteEvent) => {
        phraseSingingVoices.set(event.singingVoiceKey, event.singingVoice);
        mutations.SET_SINGING_VOICE_KEY_TO_PHRASE({
          phraseKey: event.phraseKey,
          singingVoiceKey: event.singingVoiceKey,
        });

        logger.info(`Synthesized singing voice.`);
      };

      /**
       * `phraseRenderingComplete` イベントのハンドラ。
       * 特定のフレーズの全レンダリング工程（クエリ、ピッチ、ボリューム、歌声）が完了したときに呼び出される。
       * フレーズの状態を 'RENDERED' に設定し、シーケンスの同期を行う。
       */
      const onPhraseRenderingComplete = (
        event: PhraseRenderingCompleteEvent,
      ) => {
        const singingVoice = event.phrase.singingVoice;
        const singingVoiceKey = event.phrase.singingVoiceKey;
        if (singingVoice == undefined) {
          throw new Error("singingVoice is undefined.");
        }
        if (singingVoiceKey == undefined) {
          throw new Error("singingVoiceKey is undefined.");
        }

        mutations.SET_STATE_TO_PHRASE({
          phraseKey: event.phraseKey,
          phraseState: "RENDERED",
        });

        // フレーズの状態と再生されるシーケンスの状態を同期させる
        syncPhraseSequences(
          state.phrases,
          phraseSingingVoices,
          event.snapshot.tempos,
          event.snapshot.tpqn,
        );

        logger.info("Phrase rendering complete.");
      };

      /**
       * `phraseRenderingError` イベントのハンドラ。
       * フレーズのレンダリング中にエラーが発生したときに呼び出される。
       * フレーズの状態を 'COULD_NOT_RENDER' に設定し、エラーログを出力する。
       */
      const onPhraseRenderingError = (event: PhraseRenderingErrorEvent) => {
        mutations.SET_STATE_TO_PHRASE({
          phraseKey: event.phraseKey,
          phraseState: "COULD_NOT_RENDER",
        });

        logger.error("An error occurred while rendering phrase.", event.error);
      };

      // SongTrackRenderer を作成
      songTrackRenderer = new SongTrackRenderer({
        config: {
          singingTeacherStyleId: StyleId(6000), // TODO: UIで設定できるようにする
          lastRestDurationSeconds: 0.5,
          fadeOutDurationSeconds: 0.15,
          firstRestMinDurationSeconds: 0.12,
        },
        engineSongApi: {
          fetchFrameAudioQuery: async (args) => {
            return await actions.FETCH_SING_FRAME_AUDIO_QUERY(args);
          },
          fetchSingFrameF0: async (args) => {
            return await actions.FETCH_SING_FRAME_F0(args);
          },
          fetchSingFrameVolume: async (args) => {
            return await actions.FETCH_SING_FRAME_VOLUME(args);
          },
          frameSynthesis: async (args) => {
            return await actions.FRAME_SYNTHESIS(args);
          },
        },
        playheadPositionGetter: () => playheadPosition.value,
      });

      // イベントリスナーを登録
      // 各イベントタイプに応じて、上で定義したハンドラ関数を呼び出す
      songTrackRenderer.addEventListener((event) => {
        switch (event.type) {
          case "phrasesGenerated":
            onPhrasesGenerated();
            break;
          case "cacheLoaded":
            onCacheLoaded(event);
            break;
          case "phraseRenderingStarted":
            onPhraseRenderingStarted(event);
            break;
          case "queryGenerationComplete":
            onQueryGenerationComplete(event);
            break;
          case "pitchGenerationComplete":
            onPitchGenerationComplete(event);
            break;
          case "volumeGenerationComplete":
            onVolumeGenerationComplete(event);
            break;
          case "voiceSynthesisComplete":
            onVoiceSynthesisComplete(event);
            break;
          case "phraseRenderingComplete":
            onPhraseRenderingComplete(event);
            break;
          case "phraseRenderingError":
            onPhraseRenderingError(event);
            break;
          default:
            throw new ExhaustiveError(event);
        }
      });
    },
  },

  SET_PHRASES: {
    mutation(state, { phrases }) {
      state.phrases = phrases;
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(state, { phraseKey, phraseState }) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.state = phraseState;
    },
  },

  SET_QUERY_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        queryKey,
      }: {
        phraseKey: PhraseKey;
        queryKey: EditorFrameAudioQueryKey | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.queryKey = queryKey;
    },
  },

  SET_SINGING_PITCH_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        singingPitchKey,
      }: {
        phraseKey: PhraseKey;
        singingPitchKey: SingingPitchKey | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.singingPitchKey = singingPitchKey;
    },
  },

  SET_SINGING_VOLUME_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        singingVolumeKey,
      }: {
        phraseKey: PhraseKey;
        singingVolumeKey: SingingVolumeKey | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.singingVolumeKey = singingVolumeKey;
    },
  },

  SET_SINGING_VOICE_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        singingVoiceKey,
      }: {
        phraseKey: PhraseKey;
        singingVoiceKey: SingingVoiceKey | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.singingVoiceKey = singingVoiceKey;
    },
  },

  SET_PHRASE_QUERIES: {
    mutation(
      state,
      {
        queries,
      }: { queries: Map<EditorFrameAudioQueryKey, EditorFrameAudioQuery> },
    ) {
      state.phraseQueries = queries;
    },
  },

  SET_PHRASE_QUERY: {
    mutation(
      state,
      {
        queryKey,
        query,
      }: {
        queryKey: EditorFrameAudioQueryKey;
        query: EditorFrameAudioQuery;
      },
    ) {
      state.phraseQueries.set(queryKey, query);
    },
  },

  DELETE_PHRASE_QUERY: {
    mutation(state, { queryKey }: { queryKey: EditorFrameAudioQueryKey }) {
      state.phraseQueries.delete(queryKey);
    },
  },

  SET_PHRASE_SINGING_PITCHES: {
    mutation(
      state,
      {
        singingPitches,
      }: { singingPitches: Map<SingingPitchKey, SingingPitch> },
    ) {
      state.phraseSingingPitches = singingPitches;
    },
  },

  SET_PHRASE_SINGING_PITCH: {
    mutation(
      state,
      {
        singingPitchKey,
        singingPitch,
      }: { singingPitchKey: SingingPitchKey; singingPitch: SingingPitch },
    ) {
      state.phraseSingingPitches.set(singingPitchKey, singingPitch);
    },
  },

  DELETE_PHRASE_SINGING_PITCH: {
    mutation(state, { singingPitchKey }: { singingPitchKey: SingingPitchKey }) {
      state.phraseSingingPitches.delete(singingPitchKey);
    },
  },

  SET_PHRASE_SINGING_VOLUMES: {
    mutation(
      state,
      {
        singingVolumes,
      }: { singingVolumes: Map<SingingVolumeKey, SingingVolume> },
    ) {
      state.phraseSingingVolumes = singingVolumes;
    },
  },

  SET_PHRASE_SINGING_VOLUME: {
    mutation(
      state,
      {
        singingVolumeKey,
        singingVolume,
      }: { singingVolumeKey: SingingVolumeKey; singingVolume: SingingVolume },
    ) {
      state.phraseSingingVolumes.set(singingVolumeKey, singingVolume);
    },
  },

  DELETE_PHRASE_SINGING_VOLUME: {
    mutation(
      state,
      { singingVolumeKey }: { singingVolumeKey: SingingVolumeKey },
    ) {
      state.phraseSingingVolumes.delete(singingVolumeKey);
    },
  },

  SELECTED_TRACK: {
    getter(state) {
      return getSelectedTrackWithFallback(state);
    },
  },

  SET_SNAP_TYPE: {
    mutation(state, { snapType }) {
      state.sequencerSnapType = snapType;
    },
    async action({ state, mutations }, { snapType }) {
      const tpqn = state.tpqn;
      if (!isValidSnapType(snapType, tpqn)) {
        throw new Error("The snap type is invalid.");
      }
      mutations.SET_SNAP_TYPE({ snapType });
    },
  },

  SET_ZOOM_X: {
    mutation(state, { zoomX }: { zoomX: number }) {
      state.sequencerZoomX = zoomX;
    },
    async action({ mutations }, { zoomX }) {
      mutations.SET_ZOOM_X({ zoomX });
    },
  },

  SET_ZOOM_Y: {
    mutation(state, { zoomY }: { zoomY: number }) {
      state.sequencerZoomY = zoomY;
    },
    async action({ mutations }, { zoomY }) {
      mutations.SET_ZOOM_Y({ zoomY });
    },
  },

  SET_EDIT_TARGET: {
    mutation(state, { editTarget }: { editTarget: SequencerEditTarget }) {
      state.sequencerEditTarget = editTarget;
    },
    async action(
      { mutations },
      { editTarget }: { editTarget: SequencerEditTarget },
    ) {
      mutations.SET_EDIT_TARGET({ editTarget });
    },
  },

  SET_SEQUENCER_NOTE_TOOL: {
    mutation(state, { sequencerNoteTool }) {
      state.sequencerNoteTool = sequencerNoteTool;
    },
    async action({ mutations }, { sequencerNoteTool }) {
      mutations.SET_SEQUENCER_NOTE_TOOL({ sequencerNoteTool });
    },
  },

  SET_SEQUENCER_PITCH_TOOL: {
    mutation(state, { sequencerPitchTool }) {
      state.sequencerPitchTool = sequencerPitchTool;
    },
    async action({ mutations }, { sequencerPitchTool }) {
      mutations.SET_SEQUENCER_PITCH_TOOL({ sequencerPitchTool });
    },
  },

  SET_SEQUENCER_VOLUME_TOOL: {
    mutation(state, { sequencerVolumeTool }) {
      state.sequencerVolumeTool = sequencerVolumeTool;
    },
    async action({ mutations }, { sequencerVolumeTool }) {
      mutations.SET_SEQUENCER_VOLUME_TOOL({ sequencerVolumeTool });
    },
  },

  SET_SEQUENCER_VOLUME_VISIBLE: {
    mutation(state, { sequencerVolumeVisible }) {
      state.sequencerVolumeVisible = sequencerVolumeVisible;
    },
    async action({ mutations }, { sequencerVolumeVisible }) {
      mutations.SET_SEQUENCER_VOLUME_VISIBLE({ sequencerVolumeVisible });
    },
  },

  TICK_TO_SECOND: {
    getter: (state) => (position) => {
      return tickToSecond(position, state.tempos, state.tpqn);
    },
  },

  SECOND_TO_TICK: {
    getter: (state) => (time) => {
      return secondToTick(time, state.tempos, state.tpqn);
    },
  },

  PLAYHEAD_POSITION: {
    getter() {
      return playheadPosition.value;
    },
  },

  SET_PLAYHEAD_POSITION: {
    async action({ getters }, { position }: { position: number }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      playheadPosition.value = position;
      transport.time = getters.TICK_TO_SECOND(position);
    },
  },

  SET_PLAYBACK_STATE: {
    mutation(state, { nowPlaying }) {
      state.nowPlaying = nowPlaying;
    },
  },

  SING_PLAY_AUDIO: {
    async action({ state, getters, mutations }) {
      if (state.nowPlaying) {
        return;
      }
      if (audioContext == undefined) {
        throw new Error("audioContext is undefined.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }

      // TODO: interruptedも考慮する
      if (audioContext.state === "suspended") {
        // NOTE: resumeできない場合はエラーが発生する（排他モードで専有中など）
        await audioContext.resume();
      }

      mutations.SET_PLAYBACK_STATE({ nowPlaying: true });

      // TODO: 以下の処理（ループの設定）は再生開始時に毎回行う必要はないので、
      //       ソングエディタ初期化時に1回だけ行うようにする
      // NOTE: 初期化のactionを作った方が良いかも
      transport.loop = state.isLoopEnabled;
      transport.loopStartTime = tickToSecond(
        state.loopStartTick,
        state.tempos,
        state.tpqn,
      );
      transport.loopEndTime = tickToSecond(
        state.loopEndTick,
        state.tempos,
        state.tpqn,
      );

      transport.start();
      animationTimer.start(() => {
        playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
      });
    },
  },

  SING_STOP_AUDIO: {
    async action({ state, getters, mutations }) {
      if (!state.nowPlaying) {
        return;
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      mutations.SET_PLAYBACK_STATE({ nowPlaying: false });

      transport.stop();
      animationTimer.stop();
      playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
    },
  },

  SET_VOLUME: {
    mutation(state, { volume }) {
      state.volume = volume;
    },
    async action({ mutations }, { volume }) {
      if (!mainChannelStrip) {
        throw new Error("channelStrip is undefined.");
      }
      mutations.SET_VOLUME({ volume });

      mainChannelStrip.volume = volume;
    },
  },

  PLAY_PREVIEW_SOUND: {
    async action(
      _,
      { noteNumber, duration }: { noteNumber: number; duration?: number },
    ) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      if (!previewSynth) {
        throw new Error("previewSynth is undefined.");
      }
      previewSynth.noteOn("immediately", noteNumber, duration);
    },
  },

  STOP_PREVIEW_SOUND: {
    async action(_, { noteNumber }: { noteNumber: number }) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      if (!previewSynth) {
        throw new Error("previewSynth is undefined.");
      }
      previewSynth.noteOff("immediately", noteNumber);
    },
  },

  SET_START_RENDERING_REQUESTED: {
    mutation(state, { startRenderingRequested }) {
      state.startRenderingRequested = startRenderingRequested;
    },
  },

  SET_STOP_RENDERING_REQUESTED: {
    mutation(state, { stopRenderingRequested }) {
      state.stopRenderingRequested = stopRenderingRequested;
    },
  },

  SET_NOW_RENDERING: {
    mutation(state, { nowRendering }) {
      state.nowRendering = nowRendering;
    },
  },

  CREATE_TRACK: {
    action() {
      const trackId = TrackId(uuid4());
      const track = createDefaultTrack();

      return { trackId, track };
    },
  },

  INSERT_TRACK: {
    /**
     * トラックを挿入する。
     * prevTrackIdがundefinedの場合は最後に追加する。
     */
    mutation(state, { trackId, track, prevTrackId }) {
      const index =
        prevTrackId != undefined
          ? state.trackOrder.indexOf(prevTrackId) + 1
          : state.trackOrder.length;
      state.tracks.set(trackId, track);
      state.trackOrder.splice(index, 0, trackId);
    },
    action({ state, mutations, actions }, { trackId, track, prevTrackId }) {
      if (state.tracks.has(trackId)) {
        throw new Error(`Track ${trackId} is already registered.`);
      }
      if (!isValidTrack(track)) {
        throw new Error("The track is invalid.");
      }
      mutations.INSERT_TRACK({ trackId, track, prevTrackId });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      void actions.RENDER();
    },
  },

  DELETE_TRACK: {
    mutation(state, { trackId }) {
      state.tracks.delete(trackId);
      state.trackOrder = state.trackOrder.filter((value) => value !== trackId);
    },
    async action({ state, mutations, actions }, { trackId }) {
      if (!state.tracks.has(trackId)) {
        throw new Error(`Track ${trackId} does not exist.`);
      }
      mutations.DELETE_TRACK({ trackId });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      void actions.RENDER();
    },
  },

  SELECT_TRACK: {
    // トラックを切り替えるときに選択中のノートをクリアする。
    mutation(state, { trackId }) {
      state._selectedNoteIds.clear();
      state._selectedTrackId = trackId;
    },
    action({ state, mutations }, { trackId }) {
      if (!state.tracks.has(trackId)) {
        throw new Error(`Track ${trackId} does not exist.`);
      }
      mutations.SELECT_TRACK({ trackId });
    },
  },

  SET_TRACK: {
    mutation(state, { trackId, track }) {
      state.tracks.set(trackId, track);
    },
    async action({ state, mutations, actions }, { trackId, track }) {
      if (!isValidTrack(track)) {
        throw new Error("The track is invalid.");
      }
      if (!state.tracks.has(trackId)) {
        throw new Error(`Track ${trackId} does not exist.`);
      }

      mutations.SET_TRACK({ trackId, track });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      void actions.RENDER();
    },
  },

  SET_TRACKS: {
    mutation(state, { tracks }) {
      state.tracks = tracks;
      state.trackOrder = Array.from(tracks.keys());
    },
    async action({ mutations, actions }, { tracks }) {
      if (![...tracks.values()].every((track) => isValidTrack(track))) {
        throw new Error("The track is invalid.");
      }
      mutations.SET_TRACKS({ tracks });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      void actions.RENDER();
    },
  },

  SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS: {
    async action({ state }) {
      syncTracksAndTrackChannelStrips(state.tracks);
    },
  },

  APPLY_DEVICE_ID_TO_AUDIO_CONTEXT: {
    action(_, { device }) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      const sinkId = device === "default" ? "" : device;
      audioContext.setSinkId(sinkId).catch((err: unknown) => {
        void showAlertDialog({
          title: "エラー",
          message: "再生デバイスが見つかりません",
        });
        throw err;
      });
    },
  },

  /**
   * レンダリングを行う。レンダリング中だった場合は停止して再レンダリングする。
   */
  RENDER: {
    async action({ state, getters, mutations, actions }) {
      /**
       * レンダリング中に変更される可能性のあるデータのコピーを作成する。
       */
      const createSnapshot = () => {
        return {
          tpqn: state.tpqn,
          tempos: cloneWithUnwrapProxy(state.tempos),
          tracks: cloneWithUnwrapProxy(state.tracks),
          trackOverlappingNoteIds: new Map(
            [...state.tracks.keys()].map((trackId) => [
              trackId,
              getters.OVERLAPPING_NOTE_IDS(trackId),
            ]),
          ),
          engineFrameRates: new Map(
            Object.entries(state.engineManifests).map(
              ([engineId, engineManifest]) => [
                engineId as EngineId,
                engineManifest.frameRate,
              ],
            ),
          ),
          editorFrameRate: state.editorFrameRate,
        } as const;
      };

      // SongTrackRendererが未作成の場合は、作成してセットアップを行う
      if (songTrackRenderer == undefined) {
        void actions.CREATE_AND_SETUP_SONG_TRACK_RENDERER();
        if (songTrackRenderer == undefined) {
          throw new Error("songTrackRenderer is undefined.");
        }
      }

      // レンダリングの開始（レンダリング中の場合は再スタート）を要求する
      mutations.SET_START_RENDERING_REQUESTED({
        startRenderingRequested: true,
      });

      // レンダリング中の場合は、レンダリングの中断を要求して終了する
      if (songTrackRenderer.isRendering) {
        songTrackRenderer.requestRenderingInterruption();
        return;
      }

      // レンダリングループを実行する
      mutations.SET_NOW_RENDERING({ nowRendering: true });
      try {
        while (state.startRenderingRequested && !state.stopRenderingRequested) {
          mutations.SET_START_RENDERING_REQUESTED({
            startRenderingRequested: false,
          });
          const snapshot = createSnapshot();
          await songTrackRenderer.render(snapshot);
        }
      } catch (error) {
        logger.error("render error", error);
        throw error;
      } finally {
        mutations.SET_STOP_RENDERING_REQUESTED({
          stopRenderingRequested: false,
        });
        mutations.SET_NOW_RENDERING({ nowRendering: false });
      }
    },
  },

  /**
   * レンダリング停止をリクエストし、停止するまで待機する。
   */
  STOP_RENDERING: {
    action: createUILockAction(async ({ state, mutations }) => {
      if (state.nowRendering) {
        if (songTrackRenderer == undefined) {
          throw new Error("songTrackRenderer is undefined.");
        }

        logger.info("Waiting for rendering to stop...");

        mutations.SET_STOP_RENDERING_REQUESTED({
          stopRenderingRequested: true,
        });
        if (songTrackRenderer.isRendering) {
          songTrackRenderer.requestRenderingInterruption();
        }

        await createPromiseThatResolvesWhen(() => !state.nowRendering);

        logger.info("Rendering stopped.");
      }
    }),
  },

  FETCH_SING_FRAME_AUDIO_QUERY: {
    async action(
      { getters, actions },
      {
        notes,
        engineFrameRate,
        engineId,
        styleId,
      }: {
        notes: NoteForRequestToEngine[];
        engineFrameRate: number;
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      try {
        if (!getters.IS_ENGINE_READY(engineId)) {
          throw new Error("Engine not ready.");
        }
        const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        });
        const query = await instance.invoke("singFrameAudioQuery")({
          score: { notes },
          speaker: styleId,
        });
        return { ...query, frameRate: engineFrameRate };
      } catch (error) {
        const lyrics = notes.map((value) => value.lyric).join("");
        logger.error(
          `Failed to fetch FrameAudioQuery. Lyrics of score are "${lyrics}".`,
          error,
        );
        throw error;
      }
    },
  },

  FETCH_SING_FRAME_F0: {
    async action(
      { getters, actions },
      {
        notes,
        query,
        engineId,
        styleId,
      }: {
        notes: NoteForRequestToEngine[];
        query: EditorFrameAudioQuery;
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      try {
        if (!getters.IS_ENGINE_READY(engineId)) {
          throw new Error("Engine not ready.");
        }
        const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        });
        return await instance.invoke("singFrameF0")({
          bodySingFrameF0SingFrameF0Post: {
            score: {
              notes,
            },
            frameAudioQuery: query,
          },
          speaker: styleId,
        });
      } catch (error) {
        const lyrics = notes.map((value) => value.lyric).join("");
        logger.error(
          `Failed to fetch sing frame f0. Lyrics of score are "${lyrics}".`,
          error,
        );
        throw error;
      }
    },
  },

  FETCH_SING_FRAME_VOLUME: {
    async action(
      { getters, actions },
      {
        notes,
        query,
        engineId,
        styleId,
      }: {
        notes: NoteForRequestToEngine[];
        query: EditorFrameAudioQuery;
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      try {
        if (!getters.IS_ENGINE_READY(engineId)) {
          throw new Error("Engine not ready.");
        }
        const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        });
        return await instance.invoke("singFrameVolume")({
          bodySingFrameVolumeSingFrameVolumePost: {
            score: {
              notes,
            },
            frameAudioQuery: query,
          },
          speaker: styleId,
        });
      } catch (error) {
        const lyrics = notes.map((value) => value.lyric).join("");
        logger.error(
          `Failed to fetch sing frame volume. Lyrics of score are "${lyrics}".`,
          error,
        );
        throw error;
      }
    },
  },

  FRAME_SYNTHESIS: {
    async action(
      { getters, actions },
      {
        query,
        engineId,
        styleId,
      }: {
        query: EditorFrameAudioQuery;
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      if (!getters.IS_ENGINE_READY(engineId)) {
        throw new Error("Engine not ready.");
      }
      try {
        const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        });
        return await instance.invoke("frameSynthesis")({
          frameAudioQuery: query,
          speaker: styleId,
        });
      } catch (error) {
        const phonemes = query.phonemes.map((value) => value.phoneme).join(" ");
        logger.error(
          `Failed to synthesize. Phonemes are "${phonemes}".`,
          error,
        );
        throw error;
      }
    },
  },

  SET_EXPORT_STATE: {
    mutation(state, { exportState }) {
      state.exportState = exportState;
    },
  },

  SET_CANCELLATION_OF_EXPORT_REQUESTED: {
    mutation(state, { cancellationOfExportRequested }) {
      state.cancellationOfExportRequested = cancellationOfExportRequested;
    },
  },

  EXPORT_AUDIO_FILE: {
    action: createUILockAction(
      async ({ state, mutations, getters, actions }, { filePath, setting }) => {
        const exportAudioFile = async (): Promise<SaveResultObject> => {
          const fileBaseName = generateDefaultSongFileBaseName(
            getters.PROJECT_NAME,
            getters.SELECTED_TRACK,
            getters.CHARACTER_INFO,
          );
          const fileName = `${fileBaseName}.wav`;
          const numberOfChannels = setting.isMono ? 1 : 2;
          const sampleRate = setting.sampleRate;
          const withLimiter = setting.withLimiter;

          const renderDuration = getters.CALC_RENDER_DURATION;

          if (state.nowPlaying) {
            await actions.SING_STOP_AUDIO();
          }

          if (state.savingSetting.fixedExportEnabled) {
            filePath = path.join(state.savingSetting.fixedExportDir, fileName);
          } else {
            filePath ??= await window.backend.showSaveFileDialog({
              title: "音声を保存",
              name: "WAV ファイル",
              extensions: ["wav"],
              defaultPath: fileName,
            });
          }
          if (!filePath) {
            return { result: "CANCELED", path: "" };
          }

          if (state.savingSetting.avoidOverwrite) {
            let tail = 1;
            const pathWithoutExt = filePath.slice(0, -4);
            while (await window.backend.checkFileExists(filePath)) {
              filePath = `${pathWithoutExt}[${tail}].wav`;
              tail += 1;
            }
          }

          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return !state.nowRendering || state.cancellationOfExportRequested;
            });
            if (state.cancellationOfExportRequested) {
              return { result: "CANCELED", path: "" };
            }
          }

          const audioBuffer = await offlineRenderTracks(
            numberOfChannels,
            sampleRate,
            renderDuration,
            withLimiter,
            setting.withTrackParameters,
            state.tracks,
            state.phrases,
            phraseSingingVoices,
          );

          const fileData = generateWavFileData(audioBuffer);

          const result = await actions.EXPORT_FILE({
            filePath,
            content: fileData,
          });

          return result;
        };

        if (state.exportState !== "NOT_EXPORTING") {
          throw new Error("Export is in progress.");
        }

        mutations.SET_EXPORT_STATE({ exportState: "EXPORTING_AUDIO" });
        return exportAudioFile().finally(() => {
          mutations.SET_CANCELLATION_OF_EXPORT_REQUESTED({
            cancellationOfExportRequested: false,
          });
          mutations.SET_EXPORT_STATE({ exportState: "NOT_EXPORTING" });
        });
      },
    ),
  },

  EXPORT_STEM_AUDIO_FILE: {
    action: createUILockAction(
      async ({ state, mutations, getters, actions }, { dirPath, setting }) => {
        let firstFilePath = "";
        const exportAudioFile = async (): Promise<SaveResultObject> => {
          const numberOfChannels = setting.isMono ? 1 : 2;
          const sampleRate = setting.sampleRate;
          const withLimiter = setting.withLimiter;

          const renderDuration = getters.CALC_RENDER_DURATION;

          if (state.nowPlaying) {
            await actions.SING_STOP_AUDIO();
          }

          if (state.savingSetting.fixedExportEnabled) {
            dirPath = state.savingSetting.fixedExportDir;
          } else {
            dirPath ??= await window.backend.showSaveDirectoryDialog({
              title: "音声を保存",
            });
          }
          if (!dirPath) {
            return { result: "CANCELED", path: "" };
          }

          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return !state.nowRendering || state.cancellationOfExportRequested;
            });
            if (state.cancellationOfExportRequested) {
              return { result: "CANCELED", path: "" };
            }
          }

          const shouldPlays = shouldPlayTracks(state.tracks);

          for (const [i, trackId] of state.trackOrder.entries()) {
            const track = getOrThrow(state.tracks, trackId);
            if (track.singer == undefined) {
              continue;
            }

            // ミュート/ソロにより再生されないトラックは除外
            if (
              setting.withTrackParameters.soloAndMute &&
              !shouldPlays.has(trackId)
            ) {
              continue;
            }

            const filePath = await actions.GENERATE_FILE_PATH_FOR_TRACK_EXPORT({
              trackId,
              directoryPath: dirPath,
              extension: "wav",
            });

            const audioBuffer = await offlineRenderTracks(
              numberOfChannels,
              sampleRate,
              renderDuration,
              withLimiter,
              setting.withTrackParameters,
              new Map([[trackId, { ...track, solo: false, mute: false }]]),
              new Map(
                [...state.phrases.entries()].filter(
                  ([, phrase]) => phrase.trackId === trackId,
                ),
              ),
              phraseSingingVoices,
            );

            const fileData = generateWavFileData(audioBuffer);

            const result = await actions.EXPORT_FILE({
              filePath,
              content: fileData,
            });
            if (result.result !== "SUCCESS") {
              return result;
            }

            if (i === 0) {
              firstFilePath = filePath;
            }
          }

          return { result: "SUCCESS", path: firstFilePath };
        };

        if (state.exportState !== "NOT_EXPORTING") {
          throw new Error("Export is in progress.");
        }

        mutations.SET_EXPORT_STATE({ exportState: "EXPORTING_AUDIO" });
        return exportAudioFile().finally(() => {
          mutations.SET_CANCELLATION_OF_EXPORT_REQUESTED({
            cancellationOfExportRequested: false,
          });
          mutations.SET_EXPORT_STATE({ exportState: "NOT_EXPORTING" });
        });
      },
    ),
  },

  EXPORT_LABEL_FILES: {
    action: createUILockAction(
      async ({ actions, mutations, state }, { dirPath }) => {
        /**
         * 連続するpauseを一つにまとめる。
         */
        const mergeConsecutivePauses = (labels: PhonemeTimingLabel[]) => {
          const mergedLabels: PhonemeTimingLabel[] = [];
          let accumulatedPause: PhonemeTimingLabel | undefined = undefined;

          for (const label of labels) {
            if (label.phoneme === "pau") {
              if (accumulatedPause == undefined) {
                accumulatedPause = { ...label };
              } else {
                accumulatedPause.endTime = label.endTime;
              }
            } else {
              if (accumulatedPause != undefined) {
                mergedLabels.push(accumulatedPause);
                accumulatedPause = undefined;
              }
              mergedLabels.push(label);
            }
          }
          if (accumulatedPause != undefined) {
            mergedLabels.push(accumulatedPause);
          }

          return mergedLabels;
        };

        /**
         * 全トラックの音素タイミングをlabファイル形式でエクスポートする。
         */
        const exportLabelFile = async () => {
          // 音声が再生中であれば、エクスポート前に停止する
          if (state.nowPlaying) {
            await actions.SING_STOP_AUDIO();
          }

          // 保存先ディレクトリを決定する
          if (state.savingSetting.fixedExportEnabled) {
            // 保存先が固定されている場合は、設定済みのディレクトリパスを使用する
            dirPath = state.savingSetting.fixedExportDir;
          } else {
            // 保存先が固定されていない場合、保存先のディレクトリを選択するダイアログを表示する
            dirPath ??= await window.backend.showSaveDirectoryDialog({
              title: "labファイルを保存",
            });
          }
          // ディレクトリが選択されなかった（キャンセルされた）場合は、全トラックをキャンセル扱いとして処理を中断する
          if (!dirPath) {
            return createArray(
              state.tracks.size,
              (): SaveResultObject => ({ result: "CANCELED", path: "" }),
            );
          }

          // レンダリング処理が実行中の場合、終了するかキャンセルされるまで待機する
          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return !state.nowRendering || state.cancellationOfExportRequested;
            });
            // 待機中にエクスポートがキャンセルされた場合は、全トラックをキャンセル扱いとして処理を中断する
            if (state.cancellationOfExportRequested) {
              return createArray(
                state.tracks.size,
                (): SaveResultObject => ({ result: "CANCELED", path: "" }),
              );
            }
          }

          const results: SaveResultObject[] = [];

          // トラックごとに音素タイミングの計算とラベルファイルの書き出しを行う
          for (const [trackId, track] of state.tracks) {
            // 歌手が設定されていないトラックはスキップする
            if (track.singer == undefined) {
              continue;
            }

            // エクスポートするファイルパスを生成する
            const filePath = await actions.GENERATE_FILE_PATH_FOR_TRACK_EXPORT({
              trackId,
              directoryPath: dirPath,
              extension: "lab",
            });

            // トラックに属する有効なフレーズ（クエリを持つフレーズ）を取得し、開始時刻でソートする
            const phrases = [...state.phrases.values()]
              .filter((value) => value.trackId === trackId)
              .filter((value) => value.queryKey != undefined)
              .toSorted((a, b) => a.startTime - b.startTime);

            // フレーズが存在しないトラックはスキップする
            if (phrases.length === 0) {
              continue;
            }

            let phonemeTimingLabels: PhonemeTimingLabel[] = [];

            // フレーズごとに音素タイミングを計算し、トラック全体の音素ラベル配列を生成する
            for (const phrase of phrases) {
              if (phrase.queryKey == undefined) {
                throw new UnreachableError("phraseQuery is undefined.");
              }
              const query = getOrThrow(state.phraseQueries, phrase.queryKey);

              // 音素タイミング編集の適用と調整を行う
              const phonemeTimings = toPhonemeTimings(query.phonemes);
              applyPhonemeTimingEdit(
                phonemeTimings,
                track.phonemeTimingEditData,
                query.frameRate,
              );
              adjustPhonemeTimings(
                phonemeTimings,
                phrase.minNonPauseStartFrame,
                phrase.maxNonPauseEndFrame,
              );
              const phonemes = toPhonemes(phonemeTimings);

              // 音素情報からラベルを生成する
              let phonemeStartFrame = 0;
              let phonemeStartTime = phrase.startTime;
              for (const phoneme of phonemes) {
                const phonemeEndTime =
                  phrase.startTime +
                  (phonemeStartFrame + phoneme.frameLength) / query.frameRate;

                phonemeTimingLabels.push({
                  startTime: phonemeStartTime,
                  endTime: phonemeEndTime,
                  phoneme: phoneme.phoneme,
                });

                phonemeStartFrame += phoneme.frameLength;
                phonemeStartTime = phonemeEndTime;
              }
            }

            // 連続するpauを一つにまとめる
            phonemeTimingLabels = mergeConsecutivePauses(phonemeTimingLabels);

            // 音素長が負の値にならないように前方から調整する
            // NOTE: ほとんど起こらないが、pauの長さが負になる場合があるため、その対策
            for (let i = 0; i < phonemeTimingLabels.length; i++) {
              const phonemeTimingLabel = phonemeTimingLabels[i];
              const nextPhonemeTimingLabel = getNext(phonemeTimingLabels, i);

              if (phonemeTimingLabel.endTime < phonemeTimingLabel.startTime) {
                phonemeTimingLabel.endTime = phonemeTimingLabel.startTime;
              }
              if (nextPhonemeTimingLabel != undefined) {
                nextPhonemeTimingLabel.startTime = phonemeTimingLabel.endTime;
              }
            }

            // 一番最初のpauseの開始時刻の値が0より大きい場合は0にする
            if (phonemeTimingLabels.length === 0) {
              throw new UnreachableError("phonemeTimingLabels.length is 0.");
            }
            if (phonemeTimingLabels[0].startTime > 0) {
              phonemeTimingLabels[0].startTime = 0;
            }

            // 音素の開始時刻・終了時刻の値が0より小さい場合は0にする
            // （マイナス時間のところを書き出さないようにするため）
            for (const phonemeTimingLabel of phonemeTimingLabels) {
              if (phonemeTimingLabel.startTime < 0) {
                phonemeTimingLabel.startTime = 0;
              }
              if (phonemeTimingLabel.endTime < 0) {
                phonemeTimingLabel.endTime = 0;
              }
            }

            // 音素長が0の音素ラベルを除く
            phonemeTimingLabels = phonemeTimingLabels.filter(
              (value) => value.endTime - value.startTime > 0,
            );

            // ラベルファイルデータを生成する
            const labFileData =
              await generateLabelFileData(phonemeTimingLabels);

            // ラベルファイルを書き出す
            try {
              await window.backend
                .writeFile({
                  filePath,
                  buffer: labFileData,
                })
                .then(getValueOrThrow);

              results.push({ result: "SUCCESS", path: filePath });
            } catch (e) {
              logger.error("Failed to export file.", e);

              if (e instanceof ResultError) {
                results.push({
                  result: "WRITE_ERROR",
                  path: filePath,
                  errorMessage: generateWriteErrorMessage(
                    e as ResultError<string>,
                  ),
                });
              } else {
                results.push({
                  result: "UNKNOWN_ERROR",
                  path: filePath,
                  errorMessage:
                    (e instanceof Error ? e.message : String(e)) ||
                    "不明なエラーが発生しました。",
                });
                break; // 想定外のエラーなので書き出しを中断
              }
            }
          }
          return results;
        };

        if (state.exportState !== "NOT_EXPORTING") {
          throw new Error("Export is in progress.");
        }

        mutations.SET_EXPORT_STATE({ exportState: "EXPORTING_LABEL" });
        return exportLabelFile().finally(() => {
          mutations.SET_CANCELLATION_OF_EXPORT_REQUESTED({
            cancellationOfExportRequested: false,
          });
          mutations.SET_EXPORT_STATE({ exportState: "NOT_EXPORTING" });
        });
      },
    ),
  },

  GENERATE_FILE_PATH_FOR_TRACK_EXPORT: {
    async action({ state, getters }, { trackId, directoryPath, extension }) {
      const track = getOrThrow(state.tracks, trackId);

      const trackSinger = track.singer;
      if (trackSinger == undefined) {
        throw new Error("trackSinger is undefined.");
      }

      const characterInfo = getters.CHARACTER_INFO(
        trackSinger.engineId,
        trackSinger.styleId,
      );
      if (characterInfo == undefined) {
        // NOTE: characterInfoが存在しないというのは起こり得ないはずなので、存在しなかった場合はエラー
        throw new Error(
          "CharacterInfo corresponding to engineId and styleId does not exist.",
        );
      }

      const style = characterInfo.metas.styles.find(
        (style) => style.styleId === trackSinger.styleId,
      );
      if (style == undefined) {
        throw new Error("assert style != undefined");
      }

      const characterName = characterInfo.metas.speakerName;
      const styleName = style.styleName ?? DEFAULT_STYLE_NAME;
      const projectName = getters.PROJECT_NAME ?? DEFAULT_PROJECT_NAME;
      const trackIndex = state.trackOrder.findIndex(
        (value) => value === trackId,
      );

      const fileName = buildSongTrackAudioFileNameFromRawData(
        state.savingSetting.songTrackFileNamePattern,
        {
          characterName,
          index: trackIndex,
          styleName,
          date: currentDateString(),
          projectName,
          trackName: track.name,
        },
      );
      const filePathWithoutExt = path.join(directoryPath, fileName);

      if (state.savingSetting.avoidOverwrite) {
        return await generateUniqueFilePath(filePathWithoutExt, extension);
      } else {
        return `${filePathWithoutExt}.${extension}`;
      }
    },
  },

  EXPORT_FILE: {
    async action(_, { filePath, content }) {
      try {
        await window.backend
          .writeFile({
            filePath,
            buffer: content,
          })
          .then(getValueOrThrow);
      } catch (e) {
        logger.error("Failed to export file.", e);
        if (e instanceof ResultError) {
          return {
            result: "WRITE_ERROR",
            path: filePath,
            errorMessage: generateWriteErrorMessage(e as ResultError<string>),
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

      return { result: "SUCCESS", path: filePath };
    },
  },

  CANCEL_EXPORT: {
    async action({ state, mutations }) {
      if (state.exportState === "NOT_EXPORTING") {
        logger.warn("CANCEL_EXPORT on NOT_EXPORTING");
        return;
      }
      mutations.SET_CANCELLATION_OF_EXPORT_REQUESTED({
        cancellationOfExportRequested: true,
      });
    },
  },

  COPY_NOTES_TO_CLIPBOARD: {
    async action({ getters }) {
      const selectedTrack = getters.SELECTED_TRACK;
      const noteIds = getters.SELECTED_NOTE_IDS;
      // ノートが選択されていない場合は何もしない
      if (noteIds.size === 0) {
        return;
      }
      // 選択されたノートのみをコピーする
      const selectedNotes = selectedTrack.notes
        .filter((note: Note) => noteIds.has(note.id))
        .map((note: Note) => {
          // idのみコピーしない
          const { id, ...noteWithoutId } = note;
          return noteWithoutId;
        });
      // ノートをJSONにシリアライズしてクリップボードにコピーする
      const serializedNotes = JSON.stringify(selectedNotes);
      // クリップボードにテキストとしてコピーする
      // NOTE: Electronのclipboardも使用する必要ある？
      await navigator.clipboard.writeText(serializedNotes);
      logger.info("Copied to clipboard.", serializedNotes);
    },
  },

  COMMAND_CUT_NOTES_TO_CLIPBOARD: {
    async action({ actions }) {
      await actions.COPY_NOTES_TO_CLIPBOARD();
      await actions.COMMAND_REMOVE_SELECTED_NOTES();
    },
  },

  COMMAND_PASTE_NOTES_FROM_CLIPBOARD: {
    async action({ mutations, getters, actions }) {
      // クリップボードからテキストを読み込む
      let clipboardText;
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (error) {
        throw new Error("Failed to read the clipboard text.", {
          cause: error,
        });
      }

      // クリップボードのテキストをJSONとしてパースする(失敗した場合はエラーを返す)
      let notes;
      try {
        notes = noteSchema
          .omit({ id: true })
          .array()
          .parse(JSON.parse(clipboardText));
      } catch (error) {
        throw new Error("Failed to parse the clipboard text as JSON.", {
          cause: error,
        });
      }

      // パースしたJSONのノートの位置を現在の再生位置に合わせて貼り付ける
      const currentPlayheadPosition = getters.PLAYHEAD_POSITION;
      const firstNotePosition = notes[0].position;
      const notesToPaste: Note[] = notes.map((note) => {
        // 新しい位置を現在の再生位置に合わせて計算する
        const pastePos = Math.round(
          Number(note.position) - firstNotePosition + currentPlayheadPosition,
        );
        return {
          id: NoteId(uuid4()),
          position: pastePos,
          duration: Number(note.duration),
          noteNumber: Number(note.noteNumber),
          lyric: String(note.lyric),
        };
      });
      const pastedNoteIds = notesToPaste.map((note) => note.id);

      const existingNoteIds = getters.ALL_NOTE_IDS;
      const hasDuplicateNoteIds = notesToPaste.some((note) =>
        existingNoteIds.has(note.id),
      );
      if (hasDuplicateNoteIds) {
        throw new Error("Failed to paste notes: duplicate note IDs detected.");
      }
      const hasInvalidNotes = notesToPaste.some((note) => !isValidNote(note));
      if (hasInvalidNotes) {
        throw new Error(
          "Failed to paste notes: invalid note properties detected.",
        );
      }

      // ノートを追加してレンダリングする
      mutations.COMMAND_ADD_NOTES({
        notes: notesToPaste,
        trackId: getters.SELECTED_TRACK_ID,
      });

      void actions.RENDER();
      // 貼り付けたノートを選択する
      mutations.DESELECT_ALL_NOTES();
      mutations.SELECT_NOTES({ noteIds: pastedNoteIds });
    },
  },

  COMMAND_QUANTIZE_SELECTED_NOTES: {
    action({ state, mutations, getters, actions }) {
      const selectedTrack = getters.SELECTED_TRACK;
      const selectedNotes = selectedTrack.notes.filter((note: Note) => {
        return getters.SELECTED_NOTE_IDS.has(note.id);
      });
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const quantizedNotes = selectedNotes.map((note: Note) => {
        const quantizedPosition =
          Math.round(note.position / snapTicks) * snapTicks;
        return { ...note, position: quantizedPosition };
      });
      mutations.COMMAND_UPDATE_NOTES({
        notes: quantizedNotes,
        trackId: getters.SELECTED_TRACK_ID,
      });

      void actions.RENDER();
    },
  },

  SET_SONG_SIDEBAR_OPEN: {
    mutation(state, { isSongSidebarOpen }) {
      state.isSongSidebarOpen = isSongSidebarOpen;
    },
    action({ mutations }, { isSongSidebarOpen }) {
      mutations.SET_SONG_SIDEBAR_OPEN({ isSongSidebarOpen });
    },
  },

  SET_TRACK_NAME: {
    mutation(state, { trackId, name }) {
      const track = getOrThrow(state.tracks, trackId);
      track.name = name;
    },
    action({ mutations }, { trackId, name }) {
      mutations.SET_TRACK_NAME({ trackId, name });
    },
  },

  SET_TRACK_MUTE: {
    mutation(state, { trackId, mute }) {
      const track = getOrThrow(state.tracks, trackId);
      track.mute = mute;
    },
    action({ mutations, actions }, { trackId, mute }) {
      mutations.SET_TRACK_MUTE({ trackId, mute });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
    },
  },

  SET_TRACK_SOLO: {
    mutation(state, { trackId, solo }) {
      const track = getOrThrow(state.tracks, trackId);
      track.solo = solo;
    },
    action({ mutations, actions }, { trackId, solo }) {
      mutations.SET_TRACK_SOLO({ trackId, solo });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
    },
  },

  SET_TRACK_GAIN: {
    mutation(state, { trackId, gain }) {
      const track = getOrThrow(state.tracks, trackId);
      track.gain = gain;
    },
    action({ mutations, actions }, { trackId, gain }) {
      mutations.SET_TRACK_GAIN({ trackId, gain });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
    },
  },

  SET_TRACK_PAN: {
    mutation(state, { trackId, pan }) {
      const track = getOrThrow(state.tracks, trackId);
      track.pan = pan;
    },
    action({ mutations, actions }, { trackId, pan }) {
      mutations.SET_TRACK_PAN({ trackId, pan });

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
    },
  },

  SET_SELECTED_TRACK: {
    mutation(state, { trackId }) {
      state._selectedTrackId = trackId;
    },
    action({ mutations }, { trackId }) {
      mutations.SET_SELECTED_TRACK({ trackId });
    },
  },

  REORDER_TRACKS: {
    mutation(state, { trackOrder }) {
      state.trackOrder = trackOrder;
    },
    action({ mutations }, { trackOrder }) {
      mutations.REORDER_TRACKS({ trackOrder });
    },
  },

  UNSOLO_ALL_TRACKS: {
    mutation(state) {
      for (const track of state.tracks.values()) {
        track.solo = false;
      }
    },
    action({ mutations, actions }) {
      mutations.UNSOLO_ALL_TRACKS();

      void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      void actions.RENDER();
    },
  },

  CALC_RENDER_DURATION: {
    getter(state) {
      const notes = [...state.tracks.values()].flatMap((track) => track.notes);
      if (notes.length === 0) {
        return 1;
      }
      notes.sort((a, b) => a.position + a.duration - (b.position + b.duration));
      const lastNote = notes[notes.length - 1];
      const lastNoteEndPosition = lastNote.position + lastNote.duration;
      const lastNoteEndTime = tickToSecond(
        lastNoteEndPosition,
        state.tempos,
        state.tpqn,
      );
      return Math.max(1, lastNoteEndTime + 1);
    },
  },

  SET_LOOP_ENABLED: {
    mutation(state, { isLoopEnabled }) {
      state.isLoopEnabled = isLoopEnabled;
    },
    async action({ mutations }, { isLoopEnabled }) {
      if (!transport) {
        throw new Error("transport is undefined");
      }
      mutations.SET_LOOP_ENABLED({ isLoopEnabled });
      transport.loop = isLoopEnabled;
    },
  },

  SET_LOOP_RANGE: {
    mutation(state, { loopStartTick, loopEndTick }) {
      state.loopStartTick = loopStartTick;
      state.loopEndTick = loopEndTick;
    },
    async action({ state, mutations }, { loopStartTick, loopEndTick }) {
      if (!transport) {
        throw new Error("transport is undefined");
      }

      if (!isValidLoopRange(loopStartTick, loopEndTick)) {
        throw new Error("The loop range is invalid.");
      }

      mutations.SET_LOOP_RANGE({ loopStartTick, loopEndTick });

      transport.loopStartTime = tickToSecond(
        loopStartTick,
        state.tempos,
        state.tpqn,
      );
      transport.loopEndTime = tickToSecond(
        loopEndTick,
        state.tempos,
        state.tpqn,
      );
    },
  },

  CLEAR_LOOP_RANGE: {
    async action({ actions }) {
      // ループ範囲をSET_LOOP_RANGEで0指定
      // transportも
      void actions.SET_LOOP_RANGE({
        loopStartTick: 0,
        loopEndTick: 0,
      });
      // ループ範囲をクリアする際はループも無効にする
      return actions.SET_LOOP_ENABLED({
        isLoopEnabled: false,
      });
    },
  },

  EXPORT_SONG_PROJECT: {
    action: createUILockAction(
      async (
        { state, getters, actions },
        { fileType, fileTypeLabel },
      ): Promise<SaveResultObject> => {
        const fileBaseName = generateDefaultSongFileBaseName(
          getters.PROJECT_NAME,
          getters.SELECTED_TRACK,
          getters.CHARACTER_INFO,
        );
        const project = ufProjectFromVoicevox(
          {
            tempos: state.tempos,
            timeSignatures: state.timeSignatures,
            tpqn: state.tpqn,
            tracks: state.trackOrder.map((trackId) =>
              getOrThrow(state.tracks, trackId),
            ),
          },
          fileBaseName,
        );

        // 複数トラックかつ複数ファイルの形式はディレクトリに書き出す
        if (state.trackOrder.length > 1 && isMultiFileProjectFormat(fileType)) {
          const dirPath = await window.backend.showSaveDirectoryDialog({
            title: "プロジェクトを書き出し",
          });
          if (!dirPath) {
            return { result: "CANCELED", path: "" };
          }

          const extension = projectFileExtensions[fileType];
          const tracksBytes = await ufProjectToMultiFile(project, fileType);

          let firstFilePath;
          for (const [i, trackBytes] of tracksBytes.entries()) {
            const filePath = await actions.GENERATE_FILE_PATH_FOR_TRACK_EXPORT({
              trackId: state.trackOrder[i],
              directoryPath: dirPath,
              extension,
            });
            if (i === 0) {
              firstFilePath = filePath;
            }

            const result = await actions.EXPORT_FILE({
              filePath,
              content: trackBytes,
            });
            if (result.result !== "SUCCESS") {
              return result;
            }
          }
          if (firstFilePath == undefined) {
            throw new Error("firstFilePath is undefined.");
          }

          return { result: "SUCCESS", path: firstFilePath };
        }

        // それ以外の場合は単一ファイルの形式を選択する
        else {
          let buffer: Uint8Array;
          const extension = projectFileExtensions[fileType];
          if (isSingleFileProjectFormat(fileType)) {
            buffer = await ufProjectToSingleFile(project, fileType);
          } else {
            buffer = (await ufProjectToMultiFile(project, fileType))[0];
          }

          let filePath = await window.backend.showSaveFileDialog({
            title: "プロジェクトを書き出し",
            name: fileTypeLabel,
            extensions: [extension],
            defaultPath: fileBaseName,
          });
          if (!filePath) {
            return { result: "CANCELED", path: "" };
          }
          filePath = await generateUniqueFilePath(
            // 拡張子を除いたファイル名を取得
            filePath.slice(0, -(extension.length + 1)),
            extension,
          );

          return await actions.EXPORT_FILE({
            filePath,
            content: buffer,
          });
        }
      },
    ),
  },
});

export const singingCommandStoreState: SingingCommandStoreState = {};

export const singingCommandStore = transformCommandStore(
  createPartialStore<SingingCommandStoreTypes>({
    COMMAND_SET_SINGER: {
      mutation(draft, { singer, withRelated, trackId }) {
        singingStore.mutations.SET_SINGER(draft, {
          singer,
          withRelated,
          trackId,
        });
      },
      async action({ actions, mutations }, { singer, withRelated, trackId }) {
        void actions.SETUP_SINGER({ singer });
        mutations.COMMAND_SET_SINGER({ singer, withRelated, trackId });

        void actions.RENDER();
      },
    },
    COMMAND_SET_KEY_RANGE_ADJUSTMENT: {
      mutation(draft, { keyRangeAdjustment, trackId }) {
        singingStore.mutations.SET_KEY_RANGE_ADJUSTMENT(draft, {
          keyRangeAdjustment,
          trackId,
        });
      },
      async action({ actions, mutations }, { keyRangeAdjustment, trackId }) {
        if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
          throw new Error("The keyRangeAdjustment is invalid.");
        }
        mutations.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
          keyRangeAdjustment,
          trackId,
        });

        void actions.RENDER();
      },
    },
    COMMAND_SET_VOLUME_RANGE_ADJUSTMENT: {
      mutation(draft, { volumeRangeAdjustment, trackId }) {
        singingStore.mutations.SET_VOLUME_RANGE_ADJUSTMENT(draft, {
          volumeRangeAdjustment,
          trackId,
        });
      },
      async action({ actions, mutations }, { volumeRangeAdjustment, trackId }) {
        if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
          throw new Error("The volumeRangeAdjustment is invalid.");
        }
        mutations.COMMAND_SET_VOLUME_RANGE_ADJUSTMENT({
          volumeRangeAdjustment,
          trackId,
        });

        void actions.RENDER();
      },
    },
    COMMAND_SET_TEMPO: {
      mutation(draft, { tempo }) {
        singingStore.mutations.SET_TEMPO(draft, { tempo });
      },
      // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
      action(
        { state, getters, mutations, actions },
        { tempo }: { tempo: Tempo },
      ) {
        if (!transport) {
          throw new Error("transport is undefined.");
        }
        if (!isValidTempo(tempo)) {
          throw new Error("The tempo is invalid.");
        }
        if (state.nowPlaying) {
          playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
        }
        tempo.bpm = round(tempo.bpm, 2);
        mutations.COMMAND_SET_TEMPO({ tempo });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        void actions.RENDER();
      },
    },
    COMMAND_REMOVE_TEMPO: {
      mutation(draft, { position }) {
        singingStore.mutations.REMOVE_TEMPO(draft, { position });
      },
      // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
      action(
        { state, getters, mutations, actions },
        { position }: { position: number },
      ) {
        const exists = state.tempos.some((value) => {
          return value.position === position;
        });
        if (!exists) {
          throw new Error("The tempo does not exist.");
        }
        if (!transport) {
          throw new Error("transport is undefined.");
        }
        if (state.nowPlaying) {
          playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
        }
        mutations.COMMAND_REMOVE_TEMPO({ position });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        void actions.RENDER();
      },
    },
    COMMAND_SET_TIME_SIGNATURE: {
      mutation(draft, { timeSignature }) {
        singingStore.mutations.SET_TIME_SIGNATURE(draft, { timeSignature });
      },
      // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
      action(
        { mutations },
        { timeSignature }: { timeSignature: TimeSignature },
      ) {
        if (!isValidTimeSignature(timeSignature)) {
          throw new Error("The time signature is invalid.");
        }
        mutations.COMMAND_SET_TIME_SIGNATURE({ timeSignature });
      },
    },
    COMMAND_REMOVE_TIME_SIGNATURE: {
      mutation(draft, { measureNumber }) {
        singingStore.mutations.REMOVE_TIME_SIGNATURE(draft, { measureNumber });
      },
      // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
      action(
        { state, mutations },
        { measureNumber }: { measureNumber: number },
      ) {
        const exists = state.timeSignatures.some((value) => {
          return value.measureNumber === measureNumber;
        });
        if (!exists) {
          throw new Error("The time signature does not exist.");
        }
        mutations.COMMAND_REMOVE_TIME_SIGNATURE({ measureNumber });
      },
    },
    COMMAND_ADD_NOTES: {
      mutation(draft, { notes, trackId }) {
        singingStore.mutations.ADD_NOTES(draft, { notes, trackId });
      },
      action({ getters, mutations, actions }, { notes, trackId }) {
        const existingNoteIds = getters.ALL_NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return !existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        mutations.COMMAND_ADD_NOTES({ notes, trackId });

        void actions.RENDER();
      },
    },
    COMMAND_UPDATE_NOTES: {
      mutation(draft, { notes, trackId }) {
        singingStore.mutations.UPDATE_NOTES(draft, { notes, trackId });
      },
      action({ getters, mutations, actions }, { notes, trackId }) {
        const existingNoteIds = getters.ALL_NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        mutations.COMMAND_UPDATE_NOTES({ notes, trackId });

        void actions.RENDER();
      },
    },
    COMMAND_REMOVE_NOTES: {
      mutation(draft, { noteIds, trackId }) {
        singingStore.mutations.REMOVE_NOTES(draft, { noteIds, trackId });
      },
      action({ getters, mutations, actions }, { noteIds, trackId }) {
        const existingNoteIds = getters.ALL_NOTE_IDS;
        const isValidNoteIds = noteIds.every((value) => {
          return existingNoteIds.has(value);
        });
        if (!isValidNoteIds) {
          throw new Error("The note ids are invalid.");
        }
        mutations.COMMAND_REMOVE_NOTES({ noteIds, trackId });

        void actions.RENDER();
      },
    },
    COMMAND_REMOVE_SELECTED_NOTES: {
      action({ mutations, getters, actions }) {
        mutations.COMMAND_REMOVE_NOTES({
          noteIds: [...getters.SELECTED_NOTE_IDS],
          trackId: getters.SELECTED_TRACK_ID,
        });

        void actions.RENDER();
      },
    },
    COMMAND_SET_PITCH_EDIT_DATA: {
      mutation(draft, { pitchArray, startFrame, trackId }) {
        singingStore.mutations.SET_PITCH_EDIT_DATA(draft, {
          pitchArray,
          startFrame,
          trackId,
        });
      },
      action({ mutations, actions }, { pitchArray, startFrame, trackId }) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (!isValidPitchEditData(pitchArray)) {
          throw new Error("The pitch edit data is invalid.");
        }
        mutations.COMMAND_SET_PITCH_EDIT_DATA({
          pitchArray,
          startFrame,
          trackId,
        });

        void actions.RENDER();
      },
    },
    COMMAND_ERASE_PITCH_EDIT_DATA: {
      mutation(draft, { startFrame, frameLength, trackId }) {
        singingStore.mutations.ERASE_PITCH_EDIT_DATA(draft, {
          startFrame,
          frameLength,
          trackId,
        });
      },
      action({ mutations, actions }, { startFrame, frameLength, trackId }) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (frameLength < 1) {
          throw new Error("frameLength must be at least 1.");
        }
        mutations.COMMAND_ERASE_PITCH_EDIT_DATA({
          startFrame,
          frameLength,
          trackId,
        });

        void actions.RENDER();
      },
    },

    COMMAND_INSERT_EMPTY_TRACK: {
      mutation(draft, { trackId, track, prevTrackId }) {
        singingStore.mutations.INSERT_TRACK(draft, {
          trackId,
          track,
          prevTrackId,
        });
      },
      /**
       * 空のトラックをprevTrackIdの後ろに挿入する。
       * prevTrackIdのトラックの情報を一部引き継ぐ。
       */
      async action({ state, actions, mutations }, { prevTrackId }) {
        const { trackId, track } = await actions.CREATE_TRACK();
        const sourceTrack = getOrThrow(state.tracks, prevTrackId);
        track.singer = sourceTrack.singer;
        track.keyRangeAdjustment = sourceTrack.keyRangeAdjustment;
        track.volumeRangeAdjustment = sourceTrack.volumeRangeAdjustment;
        mutations.COMMAND_INSERT_EMPTY_TRACK({
          trackId,
          track: cloneWithUnwrapProxy(track),
          prevTrackId,
        });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
        void actions.RENDER();
      },
    },

    COMMAND_DELETE_TRACK: {
      mutation(draft, { trackId }) {
        singingStore.mutations.DELETE_TRACK(draft, { trackId });
      },
      action({ mutations, actions }, { trackId }) {
        mutations.COMMAND_DELETE_TRACK({ trackId });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
        void actions.RENDER();
      },
    },

    COMMAND_SET_TRACK_NAME: {
      mutation(draft, { trackId, name }) {
        singingStore.mutations.SET_TRACK_NAME(draft, { trackId, name });
      },
      action({ mutations }, { trackId, name }) {
        mutations.COMMAND_SET_TRACK_NAME({ trackId, name });
      },
    },

    COMMAND_SET_TRACK_MUTE: {
      mutation(draft, { trackId, mute }) {
        singingStore.mutations.SET_TRACK_MUTE(draft, { trackId, mute });
      },
      action({ mutations, actions }, { trackId, mute }) {
        mutations.COMMAND_SET_TRACK_MUTE({ trackId, mute });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      },
    },

    COMMAND_SET_TRACK_SOLO: {
      mutation(draft, { trackId, solo }) {
        singingStore.mutations.SET_TRACK_SOLO(draft, { trackId, solo });
      },
      action({ mutations, actions }, { trackId, solo }) {
        mutations.COMMAND_SET_TRACK_SOLO({ trackId, solo });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      },
    },

    COMMAND_SET_TRACK_GAIN: {
      mutation(draft, { trackId, gain }) {
        singingStore.mutations.SET_TRACK_GAIN(draft, { trackId, gain });
      },
      action({ mutations, actions }, { trackId, gain }) {
        mutations.COMMAND_SET_TRACK_GAIN({ trackId, gain });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      },
    },

    COMMAND_SET_TRACK_PAN: {
      mutation(draft, { trackId, pan }) {
        singingStore.mutations.SET_TRACK_PAN(draft, { trackId, pan });
      },
      action({ mutations, actions }, { trackId, pan }) {
        mutations.COMMAND_SET_TRACK_PAN({ trackId, pan });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
      },
    },

    COMMAND_REORDER_TRACKS: {
      mutation(draft, { trackOrder }) {
        singingStore.mutations.REORDER_TRACKS(draft, { trackOrder });
      },
      action({ mutations }, { trackOrder }) {
        mutations.COMMAND_REORDER_TRACKS({ trackOrder });
      },
    },

    COMMAND_UNSOLO_ALL_TRACKS: {
      mutation(draft) {
        singingStore.mutations.UNSOLO_ALL_TRACKS(draft, undefined);
      },
      action({ mutations, actions }) {
        mutations.COMMAND_UNSOLO_ALL_TRACKS();

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
        void actions.RENDER();
      },
    },

    COMMAND_IMPORT_TRACKS: {
      mutation(draft, { tpqn, tempos, timeSignatures, tracks }) {
        singingStore.mutations.SET_TPQN(draft, { tpqn });
        singingStore.mutations.SET_TEMPOS(draft, { tempos });
        singingStore.mutations.SET_TIME_SIGNATURES(draft, { timeSignatures });
        for (const { track, trackId, overwrite, prevTrackId } of tracks) {
          if (overwrite) {
            singingStore.mutations.SET_TRACK(draft, { track, trackId });
          } else {
            singingStore.mutations.INSERT_TRACK(draft, {
              track,
              trackId,
              prevTrackId,
            });
          }
        }
      },
      /**
       * 複数のトラックを選択中のトラックの後ろに挿入し、テンポ情報などをインポートする。
       * 空のプロジェクトならトラックを上書きする。
       */
      async action(
        { state, mutations, getters, actions },
        { tpqn, tempos, timeSignatures, tracks },
      ) {
        const payload: ({ track: Track; trackId: TrackId } & (
          | { overwrite: true; prevTrackId?: undefined }
          | { overwrite?: false; prevTrackId: TrackId }
        ))[] = [];
        let prevTrackId = getters.SELECTED_TRACK_ID;
        for (const [i, track] of tracks.entries()) {
          if (!isValidTrack(track)) {
            throw new Error("The track is invalid.");
          }
          // 空のプロジェクトならトラックを上書きする
          if (i === 0 && isTracksEmpty([...state.tracks.values()])) {
            payload.push({
              track,
              trackId: prevTrackId,
              overwrite: true,
            });
          } else {
            const { trackId } = await actions.CREATE_TRACK();
            payload.push({ track, trackId, prevTrackId });
            prevTrackId = trackId;
          }
        }

        mutations.COMMAND_IMPORT_TRACKS({
          tpqn,
          tempos,
          timeSignatures,
          tracks: payload,
        });

        void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
        void actions.RENDER();
      },
    },

    COMMAND_IMPORT_UTAFORMATIX_PROJECT: {
      action: createUILockAction(
        async ({ state, getters, actions }, { project, trackIndexes }) => {
          const { tempos, timeSignatures, tracks, tpqn } =
            ufProjectToVoicevox(project);

          if (tpqn !== state.tpqn) {
            throw new Error("TPQN does not match. Must be converted.");
          }

          const selectedTrack = cloneWithUnwrapProxy(
            getOrThrow(state.tracks, getters.SELECTED_TRACK_ID),
          );

          const filteredTracks = trackIndexes.map((trackIndex): Track => {
            const importedTrack = tracks[trackIndex];
            if (!importedTrack) {
              throw new Error("Track not found.");
            }
            return {
              ...selectedTrack,
              notes: importedTrack.notes.map((note) => ({
                ...note,
                id: NoteId(uuid4()),
              })),
            };
          });

          await actions.COMMAND_IMPORT_TRACKS({
            tpqn,
            tempos,
            timeSignatures,
            tracks: filteredTracks,
          });

          void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
          void actions.RENDER();
        },
      ),
    },

    COMMAND_IMPORT_VOICEVOX_PROJECT: {
      action: createUILockAction(
        async ({ state, actions }, { project, trackIndexes }) => {
          const { tempos, timeSignatures, tracks, tpqn, trackOrder } =
            project.song;

          if (tpqn !== state.tpqn) {
            throw new Error("TPQN does not match. Must be converted.");
          }

          const filteredTracks = trackIndexes.map((trackIndex) => {
            const importedTrack = cloneWithUnwrapProxy(
              tracks[trackOrder[trackIndex]],
            );
            if (!importedTrack) {
              throw new Error("Track not found.");
            }
            return toEditorTrack(importedTrack);
          });

          // インポートなので、ノートIDは新しく振り直す
          for (const track of filteredTracks) {
            track.notes = track.notes.map((note) => ({
              ...note,
              id: NoteId(uuid4()),
            }));
          }

          await actions.COMMAND_IMPORT_TRACKS({
            tpqn,
            tempos,
            timeSignatures,
            tracks: filteredTracks,
          });

          void actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
          void actions.RENDER();
        },
      ),
    },
  }),
  "song",
);
