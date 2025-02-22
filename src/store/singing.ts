import { ref, toRaw } from "vue";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
  SingingCommandStoreState,
  SingingCommandStoreTypes,
  SaveResultObject,
  Singer,
  Phrase,
  transformCommandStore,
  SingingVoice,
  SequencerEditTarget,
  PhraseKey,
  Track,
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
  generateLabelFileDataFromFramePhonemes,
  sanitizeFileName,
} from "./utility";
import {
  CharacterInfo,
  EngineId,
  NoteId,
  StyleId,
  TrackId,
} from "@/type/preload";
import { FramePhoneme, Note as NoteForRequestToEngine } from "@/openapi";
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
  selectPriorPhrase,
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
  calculatePhraseKey,
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
  SEQUENCER_MIN_NUM_MEASURES,
  getNumMeasures,
  isTracksEmpty,
  shouldPlayTracks,
  decibelToLinear,
  applyPitchEdit,
  calcPhraseStartFrames,
  calcPhraseEndFrames,
  toEntirePhonemeTimings,
  adjustPhonemeTimingsAndPhraseEndFrames,
  phonemeTimingsToPhonemes,
} from "@/sing/domain";
import { getOverlappingNoteIds } from "@/sing/storeHelper";
import {
  AnimationTimer,
  calculateHash,
  createArray,
  createPromiseThatResolvesWhen,
  linearInterpolation,
  round,
} from "@/sing/utility";
import { getWorkaroundKeyRangeAdjustment } from "@/sing/workaroundKeyRangeAdjustment";
import { createLogger } from "@/helpers/log";
import { noteSchema } from "@/domain/project/schema";
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

const logger = createLogger("store/singing");

/**
 * フレーズレンダリングに必要なデータのスナップショット
 */
type SnapshotForPhraseRender = Readonly<{
  tpqn: number;
  tempos: Tempo[];
  tracks: Map<TrackId, Track>;
  engineFrameRates: Map<EngineId, number>;
  editorFrameRate: number;
}>;

type PhraseRenderStageId =
  | "queryGeneration"
  | "singingPitchGeneration"
  | "singingVolumeGeneration"
  | "singingVoiceSynthesis";

/**
 * フレーズレンダリングのステージのインターフェイス。
 * フレーズレンダラー内で順に実行される。
 */
type PhraseRenderStage = Readonly<{
  id: PhraseRenderStageId;

  /**
   * このステージが実行されるべきかを判定する。
   * @param context コンテキスト
   * @returns 実行が必要かどうかのブール値
   */
  needsExecution: (
    trackId: TrackId,
    phraseKey: PhraseKey,
    snapshot: SnapshotForPhraseRender,
  ) => Promise<boolean>;

  /**
   * 前回の処理結果を削除する。
   * @param context コンテキスト
   */
  deleteExecutionResult: (phraseKey: PhraseKey) => void;

  /**
   * ステージの処理を実行する。
   * @param context コンテキスト
   */
  execute: (
    trackId: TrackId,
    phraseKey: PhraseKey,
    snapshot: SnapshotForPhraseRender,
  ) => Promise<void>;
}>;

/**
 * クエリの生成に必要なデータ
 */
type QuerySource = Readonly<{
  engineId: EngineId;
  engineFrameRate: number;
  tpqn: number;
  tempos: Tempo[];
  firstRestDuration: number;
  notes: Note[];
  keyRangeAdjustment: number;
}>;

/**
 * 歌唱ピッチの生成に必要なデータ
 */
type SingingPitchSource = Readonly<{
  engineId: EngineId;
  engineFrameRate: number;
  tpqn: number;
  tempos: Tempo[];
  firstRestDuration: number;
  notes: Note[];
  keyRangeAdjustment: number;
  queryForPitchGeneration: EditorFrameAudioQuery;
}>;

/**
 * 歌唱ボリュームの生成に必要なデータ
 */
type SingingVolumeSource = Readonly<{
  engineId: EngineId;
  engineFrameRate: number;
  tpqn: number;
  tempos: Tempo[];
  firstRestDuration: number;
  notes: Note[];
  keyRangeAdjustment: number;
  volumeRangeAdjustment: number;
  queryForVolumeGeneration: EditorFrameAudioQuery;
}>;

/**
 * 歌唱音声の合成に必要なデータ
 */
type SingingVoiceSource = Readonly<{
  singer: Singer;
  queryForSingingVoiceSynthesis: EditorFrameAudioQuery;
}>;

/**
 * リクエスト用のノーツ（と休符）を作成する。
 */
const createNotesForRequestToEngine = (
  firstRestDuration: number,
  lastRestDurationSeconds: number,
  notes: Note[],
  tempos: Tempo[],
  tpqn: number,
  frameRate: number,
) => {
  const notesForRequestToEngine: NoteForRequestToEngine[] = [];

  // 先頭の休符を変換
  const firstRestStartSeconds = tickToSecond(
    notes[0].position - firstRestDuration,
    tempos,
    tpqn,
  );
  const firstRestStartFrame = Math.round(firstRestStartSeconds * frameRate);
  const firstRestEndSeconds = tickToSecond(notes[0].position, tempos, tpqn);
  const firstRestEndFrame = Math.round(firstRestEndSeconds * frameRate);
  notesForRequestToEngine.push({
    key: undefined,
    frameLength: firstRestEndFrame - firstRestStartFrame,
    lyric: "",
  });

  // ノートを変換
  for (const note of notes) {
    const noteOnSeconds = tickToSecond(note.position, tempos, tpqn);
    const noteOnFrame = Math.round(noteOnSeconds * frameRate);
    const noteOffSeconds = tickToSecond(
      note.position + note.duration,
      tempos,
      tpqn,
    );
    const noteOffFrame = Math.round(noteOffSeconds * frameRate);
    notesForRequestToEngine.push({
      id: note.id,
      key: note.noteNumber,
      frameLength: noteOffFrame - noteOnFrame,
      lyric: note.lyric,
    });
  }

  // 末尾に休符を追加
  const lastRestFrameLength = Math.round(lastRestDurationSeconds * frameRate);
  notesForRequestToEngine.push({
    key: undefined,
    frameLength: lastRestFrameLength,
    lyric: "",
  });

  // frameLengthが1以上になるようにする
  for (let i = 0; i < notesForRequestToEngine.length; i++) {
    const frameLength = notesForRequestToEngine[i].frameLength;
    const frameToShift = Math.max(0, 1 - frameLength);
    notesForRequestToEngine[i].frameLength += frameToShift;
    if (i < notesForRequestToEngine.length - 1) {
      notesForRequestToEngine[i + 1].frameLength -= frameToShift;
    }
  }

  return notesForRequestToEngine;
};

const shiftKeyOfNotes = (notes: NoteForRequestToEngine[], keyShift: number) => {
  for (const note of notes) {
    if (note.key != undefined) {
      note.key += keyShift;
    }
  }
};

const getPhonemes = (query: EditorFrameAudioQuery) => {
  return query.phonemes.map((value) => value.phoneme).join(" ");
};

const shiftPitch = (f0: number[], pitchShift: number) => {
  for (let i = 0; i < f0.length; i++) {
    f0[i] *= Math.pow(2, pitchShift / 12);
  }
};

const shiftVolume = (volume: number[], volumeShift: number) => {
  for (let i = 0; i < volume.length; i++) {
    volume[i] *= decibelToLinear(volumeShift);
  }
};

/**
 * 末尾のpauの区間のvolumeを0にする。（歌とpauの呼吸音が重ならないようにする）
 * fadeOutDurationSecondsが0の場合は即座にvolumeを0にする。
 */
const muteLastPauSection = (
  volume: number[],
  phonemes: FramePhoneme[],
  frameRate: number,
  fadeOutDurationSeconds: number,
) => {
  const lastPhoneme = phonemes.at(-1);
  if (lastPhoneme == undefined || lastPhoneme.phoneme !== "pau") {
    throw new Error("No pau exists at the end.");
  }

  let lastPauStartFrame = 0;
  for (let i = 0; i < phonemes.length - 1; i++) {
    lastPauStartFrame += phonemes[i].frameLength;
  }

  const lastPauFrameLength = lastPhoneme.frameLength;
  let fadeOutFrameLength = Math.round(fadeOutDurationSeconds * frameRate);
  fadeOutFrameLength = Math.max(0, fadeOutFrameLength);
  fadeOutFrameLength = Math.min(lastPauFrameLength, fadeOutFrameLength);

  // フェードアウト処理を行う
  if (fadeOutFrameLength === 1) {
    volume[lastPauStartFrame] *= 0.5;
  } else {
    for (let i = 0; i < fadeOutFrameLength; i++) {
      volume[lastPauStartFrame + i] *= linearInterpolation(
        0,
        1,
        fadeOutFrameLength - 1,
        0,
        i,
      );
    }
  }
  // 音量を0にする
  for (let i = fadeOutFrameLength; i < lastPauFrameLength; i++) {
    volume[lastPauStartFrame + i] = 0;
  }
};

const calculateQueryKey = async (querySource: QuerySource) => {
  const hash = await calculateHash(querySource);
  return EditorFrameAudioQueryKey(hash);
};

const calculateSingingPitchKey = async (
  singingPitchSource: SingingPitchSource,
) => {
  const hash = await calculateHash(singingPitchSource);
  return SingingPitchKey(hash);
};

const calculateSingingVolumeKey = async (
  singingVolumeSource: SingingVolumeSource,
) => {
  const hash = await calculateHash(singingVolumeSource);
  return SingingVolumeKey(hash);
};

const calculateSingingVoiceKey = async (
  singingVoiceSource: SingingVoiceSource,
) => {
  const hash = await calculateHash(singingVoiceSource);
  return SingingVoiceKey(hash);
};

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
    if (phrase.singingVoiceKey == undefined || phrase.state !== "PLAYABLE") {
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
}

const playheadPosition = ref(0); // 単位はtick
const phraseSingingVoices = new Map<SingingVoiceKey, SingingVoice>();
const sequences = new Map<SequenceId, Sequence & { trackId: TrackId }>();
const animationTimer = new AnimationTimer();

const queryCache = new Map<EditorFrameAudioQueryKey, EditorFrameAudioQuery>();
const singingPitchCache = new Map<SingingPitchKey, SingingPitch>();
const singingVolumeCache = new Map<SingingVolumeKey, SingingVolume>();
const singingVoiceCache = new Map<SingingVoiceKey, SingingVoice>();

const initialTrackId = TrackId(uuid4());

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
  _selectedNoteIds: new Set(),
  nowPlaying: false,
  volume: 0,
  startRenderingRequested: false,
  stopRenderingRequested: false,
  nowRendering: false,
  exportState: "NOT_EXPORTING",
  cancellationOfExportRequested: false,
  isSongSidebarOpen: false,
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

  SET_SEQUENCE_ID_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        sequenceId,
      }: {
        phraseKey: PhraseKey;
        sequenceId: SequenceId | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

      phrase.sequenceId = sequenceId;
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

  SEQUENCER_NUM_MEASURES: {
    getter(state) {
      // NOTE: スコア長(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
      // NOTE: いったん最後尾に足した場合は伸びるようにする
      return Math.max(
        SEQUENCER_MIN_NUM_MEASURES,
        getNumMeasures(
          [...state.tracks.values()].flatMap((track) => track.notes),
          state.tempos,
          state.timeSignatures,
          state.tpqn,
        ) + 8,
      );
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
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      mutations.SET_PLAYBACK_STATE({ nowPlaying: true });

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
      const singingTeacherStyleId = StyleId(6000); // TODO: 設定できるようにする
      const lastRestDurationSeconds = 0.5; // TODO: 設定できるようにする
      const fadeOutDurationSeconds = 0.15; // TODO: 設定できるようにする

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

      const calcPhraseFirstRestDuration = (
        prevPhraseLastNote: Note | undefined,
        phraseFirstNote: Note,
        phraseFirstRestMinDurationSeconds: number,
        tempos: Tempo[],
        tpqn: number,
      ) => {
        const quarterNoteDuration = getNoteDuration(4, tpqn);
        let phraseFirstRestDuration: number | undefined = undefined;

        // 実際のフレーズ先頭の休符の長さを調べる
        if (prevPhraseLastNote == undefined) {
          if (phraseFirstNote.position === 0) {
            // 1小節目の最初から始まっているフレーズの場合は、
            // とりあえず4分音符の長さをフレーズ先頭の休符の長さにする
            phraseFirstRestDuration = quarterNoteDuration;
          } else {
            phraseFirstRestDuration = phraseFirstNote.position;
          }
        } else {
          const prevPhraseLastNoteEndPos =
            prevPhraseLastNote.position + prevPhraseLastNote.duration;
          phraseFirstRestDuration =
            phraseFirstNote.position - prevPhraseLastNoteEndPos;
        }
        // 4分音符の長さ以下にする
        phraseFirstRestDuration = Math.min(
          phraseFirstRestDuration,
          quarterNoteDuration,
        );
        // 最小の長さ以上にする
        phraseFirstRestDuration = Math.max(
          phraseFirstRestDuration,
          phraseFirstNote.position -
            secondToTick(
              tickToSecond(phraseFirstNote.position, tempos, tpqn) -
                phraseFirstRestMinDurationSeconds,
              tempos,
              tpqn,
            ),
        );
        // 1tick以上にする
        phraseFirstRestDuration = Math.max(1, phraseFirstRestDuration);

        return phraseFirstRestDuration;
      };

      const calculatePhraseStartTime = (
        phraseFirstRestDuration: number,
        phraseNotes: Note[],
        tempos: Tempo[],
        tpqn: number,
      ) => {
        return tickToSecond(
          phraseNotes[0].position - phraseFirstRestDuration,
          tempos,
          tpqn,
        );
      };

      const generatePhrases = async (
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        phraseFirstRestMinDurationSeconds: number,
        trackId: TrackId,
      ) => {
        const generatedPhrases = new Map<PhraseKey, Phrase>();

        let phraseNotes: Note[] = [];
        let prevPhraseLastNote: Note | undefined = undefined;

        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const nextNote = notes.at(i + 1);
          const currentNoteEndPos = note.position + note.duration;

          phraseNotes.push(note);

          // ノートが途切れていたら別のフレーズにする
          if (
            nextNote == undefined ||
            currentNoteEndPos !== nextNote.position
          ) {
            const phraseFirstNote = phraseNotes[0];
            const phraseFirstRestDuration = calcPhraseFirstRestDuration(
              prevPhraseLastNote,
              phraseFirstNote,
              phraseFirstRestMinDurationSeconds,
              tempos,
              tpqn,
            );
            const phraseStartTime = calculatePhraseStartTime(
              phraseFirstRestDuration,
              phraseNotes,
              tempos,
              tpqn,
            );
            const phraseKey = await calculatePhraseKey({
              firstRestDuration: phraseFirstRestDuration,
              notes: phraseNotes,
              startTime: phraseStartTime,
              trackId,
            });
            generatedPhrases.set(phraseKey, {
              firstRestDuration: phraseFirstRestDuration,
              notes: phraseNotes,
              startTime: phraseStartTime,
              state: "WAITING_TO_BE_RENDERED",
              trackId,
            });

            if (nextNote != undefined) {
              prevPhraseLastNote = phraseNotes.at(-1);
              phraseNotes = [];
            }
          }
        }
        return generatedPhrases;
      };

      const generateQuerySource = (
        trackId: TrackId,
        phraseKey: PhraseKey,
        snapshot: SnapshotForPhraseRender,
      ): QuerySource => {
        const track = getOrThrow(snapshot.tracks, trackId);
        if (track.singer == undefined) {
          throw new Error("track.singer is undefined.");
        }
        const engineFrameRate = getOrThrow(
          snapshot.engineFrameRates,
          track.singer.engineId,
        );
        const phrase = getOrThrow(state.phrases, phraseKey);
        return {
          engineId: track.singer.engineId,
          engineFrameRate,
          tpqn: snapshot.tpqn,
          tempos: snapshot.tempos,
          firstRestDuration: phrase.firstRestDuration,
          notes: phrase.notes,
          keyRangeAdjustment: track.keyRangeAdjustment,
        };
      };

      const fetchQuery = async (
        engineId: EngineId,
        engineFrameRate: number,
        notesForRequestToEngine: NoteForRequestToEngine[],
      ) => {
        try {
          if (!getters.IS_ENGINE_READY(engineId)) {
            throw new Error("Engine not ready.");
          }
          const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          });
          const query = await instance.invoke(
            "singFrameAudioQuerySingFrameAudioQueryPost",
          )({
            score: { notes: notesForRequestToEngine },
            speaker: singingTeacherStyleId,
          });
          const editorQuery: EditorFrameAudioQuery = {
            ...query,
            frameRate: engineFrameRate,
          };
          return editorQuery;
        } catch (error) {
          const lyrics = notesForRequestToEngine
            .map((value) => value.lyric)
            .join("");
          logger.error(
            `Failed to fetch FrameAudioQuery. Lyrics of score are "${lyrics}".`,
            error,
          );
          throw error;
        }
      };

      const generateQuery = async (querySource: QuerySource) => {
        const notesForRequestToEngine = createNotesForRequestToEngine(
          querySource.firstRestDuration,
          lastRestDurationSeconds,
          querySource.notes,
          querySource.tempos,
          querySource.tpqn,
          querySource.engineFrameRate,
        );

        shiftKeyOfNotes(
          notesForRequestToEngine,
          -querySource.keyRangeAdjustment,
        );

        const query = await fetchQuery(
          querySource.engineId,
          querySource.engineFrameRate,
          notesForRequestToEngine,
        );

        shiftPitch(query.f0, querySource.keyRangeAdjustment);
        return query;
      };

      const queryGenerationStage: PhraseRenderStage = {
        id: "queryGeneration",
        needsExecution: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const track = getOrThrow(snapshot.tracks, trackId);
          if (track.singer == undefined) {
            return false;
          }
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseQueryKey = phrase.queryKey;
          const querySource = generateQuerySource(trackId, phraseKey, snapshot);
          const queryKey = await calculateQueryKey(querySource);
          return phraseQueryKey == undefined || phraseQueryKey !== queryKey;
        },
        deleteExecutionResult: (phraseKey: PhraseKey) => {
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseQueryKey = phrase.queryKey;
          if (phraseQueryKey != undefined) {
            mutations.DELETE_PHRASE_QUERY({ queryKey: phraseQueryKey });
            mutations.SET_QUERY_KEY_TO_PHRASE({
              phraseKey,
              queryKey: undefined,
            });
          }
        },
        execute: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const querySource = generateQuerySource(trackId, phraseKey, snapshot);
          const queryKey = await calculateQueryKey(querySource);

          let query = queryCache.get(queryKey);
          if (query != undefined) {
            logger.info(`Loaded query from cache.`);
          } else {
            query = await generateQuery(querySource);
            const phonemes = getPhonemes(query);
            logger.info(`Generated query. phonemes: ${phonemes}`);
            queryCache.set(queryKey, query);
          }

          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseQueryKey = phrase.queryKey;
          if (phraseQueryKey != undefined) {
            throw new Error("The previous query has not been removed.");
          }
          mutations.SET_PHRASE_QUERY({ queryKey, query });
          mutations.SET_QUERY_KEY_TO_PHRASE({ phraseKey, queryKey });
        },
      };

      const generateSingingPitchSource = (
        trackId: TrackId,
        phraseKey: PhraseKey,
        snapshot: SnapshotForPhraseRender,
      ): SingingPitchSource => {
        const track = getOrThrow(snapshot.tracks, trackId);
        if (track.singer == undefined) {
          throw new Error("track.singer is undefined.");
        }
        const phrase = getOrThrow(state.phrases, phraseKey);
        const phraseQueryKey = phrase.queryKey;
        if (phraseQueryKey == undefined) {
          throw new Error("phraseQueryKey is undefined.");
        }
        const query = getOrThrow(state.phraseQueries, phraseQueryKey);
        const clonedQuery = cloneWithUnwrapProxy(query);
        // TODO: 音素タイミングの編集データの適用を行うようにする
        return {
          engineId: track.singer.engineId,
          engineFrameRate: query.frameRate,
          tpqn: snapshot.tpqn,
          tempos: snapshot.tempos,
          firstRestDuration: phrase.firstRestDuration,
          notes: phrase.notes,
          keyRangeAdjustment: track.keyRangeAdjustment,
          queryForPitchGeneration: clonedQuery,
        };
      };

      const generateSingingPitch = async (
        singingPitchSource: SingingPitchSource,
      ) => {
        // TODO: ピッチ生成APIに対応する
        return singingPitchSource.queryForPitchGeneration.f0;
      };

      const singingPitchGenerationStage: PhraseRenderStage = {
        id: "singingPitchGeneration",
        needsExecution: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const track = getOrThrow(snapshot.tracks, trackId);
          if (track.singer == undefined) {
            return false;
          }
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingPitchKey = phrase.singingPitchKey;
          const singingPitchSource = generateSingingPitchSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingPitchKey =
            await calculateSingingPitchKey(singingPitchSource);
          return (
            phraseSingingPitchKey == undefined ||
            phraseSingingPitchKey !== singingPitchKey
          );
        },
        deleteExecutionResult: (phraseKey: PhraseKey) => {
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingPitchKey = phrase.singingPitchKey;
          if (phraseSingingPitchKey != undefined) {
            mutations.DELETE_PHRASE_SINGING_PITCH({
              singingPitchKey: phraseSingingPitchKey,
            });
            mutations.SET_SINGING_PITCH_KEY_TO_PHRASE({
              phraseKey,
              singingPitchKey: undefined,
            });
          }
        },
        execute: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const singingPitchSource = generateSingingPitchSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingPitchKey =
            await calculateSingingPitchKey(singingPitchSource);

          let singingPitch = singingPitchCache.get(singingPitchKey);
          if (singingPitch != undefined) {
            logger.info(`Loaded singing pitch from cache.`);
          } else {
            singingPitch = await generateSingingPitch(singingPitchSource);
            logger.info(`Generated singing pitch.`);
            singingPitchCache.set(singingPitchKey, singingPitch);
          }

          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingPitchKey = phrase.singingPitchKey;
          if (phraseSingingPitchKey != undefined) {
            throw new Error("The previous singing pitch has not been removed.");
          }
          mutations.SET_PHRASE_SINGING_PITCH({ singingPitchKey, singingPitch });
          mutations.SET_SINGING_PITCH_KEY_TO_PHRASE({
            phraseKey,
            singingPitchKey,
          });
        },
      };

      const generateSingingVolumeSource = (
        trackId: TrackId,
        phraseKey: PhraseKey,
        snapshot: SnapshotForPhraseRender,
      ): SingingVolumeSource => {
        const track = getOrThrow(snapshot.tracks, trackId);
        if (track.singer == undefined) {
          throw new Error("track.singer is undefined.");
        }
        const phrase = getOrThrow(state.phrases, phraseKey);
        const phraseQueryKey = phrase.queryKey;
        if (phraseQueryKey == undefined) {
          throw new Error("phraseQueryKey is undefined.");
        }
        // TODO: ピッチ生成ステージで生成したピッチを使用するようにする
        const query = getOrThrow(state.phraseQueries, phraseQueryKey);
        const clonedQuery = cloneWithUnwrapProxy(query);
        applyPitchEdit(
          clonedQuery,
          phrase.startTime,
          track.pitchEditData,
          snapshot.editorFrameRate,
        );
        return {
          engineId: track.singer.engineId,
          engineFrameRate: query.frameRate,
          tpqn: snapshot.tpqn,
          tempos: snapshot.tempos,
          firstRestDuration: phrase.firstRestDuration,
          notes: phrase.notes,
          keyRangeAdjustment: track.keyRangeAdjustment,
          volumeRangeAdjustment: track.volumeRangeAdjustment,
          queryForVolumeGeneration: clonedQuery,
        };
      };

      const generateSingingVolume = async (
        singingVolumeSource: SingingVolumeSource,
      ) => {
        const notesForRequestToEngine = createNotesForRequestToEngine(
          singingVolumeSource.firstRestDuration,
          lastRestDurationSeconds,
          singingVolumeSource.notes,
          singingVolumeSource.tempos,
          singingVolumeSource.tpqn,
          singingVolumeSource.engineFrameRate,
        );
        const queryForVolumeGeneration =
          singingVolumeSource.queryForVolumeGeneration;

        shiftKeyOfNotes(
          notesForRequestToEngine,
          -singingVolumeSource.keyRangeAdjustment,
        );
        shiftPitch(
          queryForVolumeGeneration.f0,
          -singingVolumeSource.keyRangeAdjustment,
        );

        const singingVolume = await actions.FETCH_SING_FRAME_VOLUME({
          notes: notesForRequestToEngine,
          query: queryForVolumeGeneration,
          engineId: singingVolumeSource.engineId,
          styleId: singingTeacherStyleId,
        });

        shiftVolume(singingVolume, singingVolumeSource.volumeRangeAdjustment);
        muteLastPauSection(
          singingVolume,
          queryForVolumeGeneration.phonemes,
          singingVolumeSource.engineFrameRate,
          fadeOutDurationSeconds,
        );
        return singingVolume;
      };

      const singingVolumeGenerationStage: PhraseRenderStage = {
        id: "singingVolumeGeneration",
        needsExecution: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const track = getOrThrow(snapshot.tracks, trackId);
          if (track.singer == undefined) {
            return false;
          }
          const singingVolumeSource = generateSingingVolumeSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingVolumeKey =
            await calculateSingingVolumeKey(singingVolumeSource);
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVolumeKey = phrase.singingVolumeKey;
          return (
            phraseSingingVolumeKey == undefined ||
            phraseSingingVolumeKey !== singingVolumeKey
          );
        },
        deleteExecutionResult: (phraseKey: PhraseKey) => {
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVolumeKey = phrase.singingVolumeKey;
          if (phraseSingingVolumeKey != undefined) {
            mutations.DELETE_PHRASE_SINGING_VOLUME({
              singingVolumeKey: phraseSingingVolumeKey,
            });
            mutations.SET_SINGING_VOLUME_KEY_TO_PHRASE({
              phraseKey,
              singingVolumeKey: undefined,
            });
          }
        },
        execute: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const singingVolumeSource = generateSingingVolumeSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingVolumeKey =
            await calculateSingingVolumeKey(singingVolumeSource);

          let singingVolume = singingVolumeCache.get(singingVolumeKey);
          if (singingVolume != undefined) {
            logger.info(`Loaded singing volume from cache.`);
          } else {
            singingVolume = await generateSingingVolume(singingVolumeSource);
            logger.info(`Generated singing volume.`);
            singingVolumeCache.set(singingVolumeKey, singingVolume);
          }

          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVolumeKey = phrase.singingVolumeKey;
          if (phraseSingingVolumeKey != undefined) {
            throw new Error(
              "The previous singing volume has not been removed.",
            );
          }
          mutations.SET_PHRASE_SINGING_VOLUME({
            singingVolumeKey,
            singingVolume,
          });
          mutations.SET_SINGING_VOLUME_KEY_TO_PHRASE({
            phraseKey,
            singingVolumeKey,
          });
        },
      };

      const generateSingingVoiceSource = (
        trackId: TrackId,
        phraseKey: PhraseKey,
        snapshot: SnapshotForPhraseRender,
      ): SingingVoiceSource => {
        const track = getOrThrow(snapshot.tracks, trackId);
        if (track.singer == undefined) {
          throw new Error("track.singer is undefined.");
        }
        const phrase = getOrThrow(state.phrases, phraseKey);
        const phraseQueryKey = phrase.queryKey;
        const phraseSingingVolumeKey = phrase.singingVolumeKey;
        if (phraseQueryKey == undefined) {
          throw new Error("phraseQueryKey is undefined.");
        }
        if (phraseSingingVolumeKey == undefined) {
          throw new Error("phraseSingingVolumeKey is undefined.");
        }
        const query = getOrThrow(state.phraseQueries, phraseQueryKey);
        const singingVolume = getOrThrow(
          state.phraseSingingVolumes,
          phraseSingingVolumeKey,
        );
        const clonedQuery = cloneWithUnwrapProxy(query);
        const clonedSingingVolume = cloneWithUnwrapProxy(singingVolume);
        applyPitchEdit(
          clonedQuery,
          phrase.startTime,
          track.pitchEditData,
          snapshot.editorFrameRate,
        );
        clonedQuery.volume = clonedSingingVolume;
        return {
          singer: track.singer,
          queryForSingingVoiceSynthesis: clonedQuery,
        };
      };

      const synthesizeSingingVoice = async (
        singingVoiceSource: SingingVoiceSource,
      ) => {
        const singer = singingVoiceSource.singer;
        const query = singingVoiceSource.queryForSingingVoiceSynthesis;

        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }
        try {
          const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
            engineId: singer.engineId,
          });
          return await instance.invoke("frameSynthesisFrameSynthesisPost")({
            frameAudioQuery: query,
            speaker: singer.styleId,
          });
        } catch (error) {
          const phonemes = query.phonemes
            .map((value) => value.phoneme)
            .join(" ");
          logger.error(
            `Failed to synthesis. Phonemes are "${phonemes}".`,
            error,
          );
          throw error;
        }
      };

      const singingVoiceSynthesisStage: PhraseRenderStage = {
        id: "singingVoiceSynthesis",
        needsExecution: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const track = getOrThrow(snapshot.tracks, trackId);
          if (track.singer == undefined) {
            return false;
          }
          const singingVoiceSource = generateSingingVoiceSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingVoiceKey =
            await calculateSingingVoiceKey(singingVoiceSource);
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVoiceKey = phrase.singingVoiceKey;
          return (
            phraseSingingVoiceKey == undefined ||
            phraseSingingVoiceKey !== singingVoiceKey
          );
        },
        deleteExecutionResult: (phraseKey: PhraseKey) => {
          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVoiceKey = phrase.singingVoiceKey;
          if (phraseSingingVoiceKey != undefined) {
            phraseSingingVoices.delete(phraseSingingVoiceKey);
            mutations.SET_SINGING_VOICE_KEY_TO_PHRASE({
              phraseKey,
              singingVoiceKey: undefined,
            });
          }
        },
        execute: async (
          trackId: TrackId,
          phraseKey: PhraseKey,
          snapshot: SnapshotForPhraseRender,
        ) => {
          const singingVoiceSource = generateSingingVoiceSource(
            trackId,
            phraseKey,
            snapshot,
          );
          const singingVoiceKey =
            await calculateSingingVoiceKey(singingVoiceSource);

          let singingVoice = singingVoiceCache.get(singingVoiceKey);
          if (singingVoice != undefined) {
            logger.info(`Loaded singing voice from cache.`);
          } else {
            singingVoice = await synthesizeSingingVoice(singingVoiceSource);
            logger.info(`Generated singing voice.`);
            singingVoiceCache.set(singingVoiceKey, singingVoice);
          }

          const phrase = getOrThrow(state.phrases, phraseKey);
          const phraseSingingVoiceKey = phrase.singingVoiceKey;
          if (phraseSingingVoiceKey != undefined) {
            throw new Error("The previous singing voice has not been removed.");
          }
          phraseSingingVoices.set(singingVoiceKey, singingVoice);
          mutations.SET_SINGING_VOICE_KEY_TO_PHRASE({
            phraseKey,
            singingVoiceKey,
          });
        },
      };

      // NOTE: ステージは実行順で保持
      const stages: readonly PhraseRenderStage[] = [
        queryGenerationStage,
        singingPitchGenerationStage,
        singingVolumeGenerationStage,
        singingVoiceSynthesisStage,
      ];

      // NOTE: 型推論でawaitの前か後かが考慮されないので、関数を介して取得する（型がbooleanになるようにする）
      const startRenderingRequested = () => state.startRenderingRequested;
      const stopRenderingRequested = () => state.stopRenderingRequested;

      /**
       * フレーズが持つシーケンスのIDを取得する。
       * @param phraseKey フレーズのキー
       * @returns シーケンスID
       */
      const getPhraseSequenceId = (phraseKey: PhraseKey) => {
        return getOrThrow(state.phrases, phraseKey).sequenceId;
      };

      /**
       * フレーズが持つ歌声のキーを取得する。
       * @param phraseKey フレーズのキー
       * @returns 歌声のキー
       */
      const getPhraseSingingVoiceKey = (phraseKey: PhraseKey) => {
        return getOrThrow(state.phrases, phraseKey).singingVoiceKey;
      };

      const render = async () => {
        const firstRestMinDurationSeconds = 0.12;
        const snapshot = createSnapshot();

        const renderStartStageIds = new Map<PhraseKey, PhraseRenderStageId>();

        // 重なっているノートを削除する
        const filteredTrackNotes = new Map<TrackId, Note[]>();
        for (const [trackId, track] of snapshot.tracks) {
          const overlappingNoteIds = getOrThrow(
            snapshot.trackOverlappingNoteIds,
            trackId,
          );
          const filteredNotes = track.notes.filter(
            (value) => !overlappingNoteIds.has(value.id),
          );
          filteredTrackNotes.set(trackId, filteredNotes);
        }

        // ノーツからフレーズを生成する
        const generatedPhrases = new Map<PhraseKey, Phrase>();
        for (const trackId of snapshot.tracks.keys()) {
          const filteredNotes = getOrThrow(filteredTrackNotes, trackId);
          const phrases = await generatePhrases(
            filteredNotes,
            snapshot.tempos,
            snapshot.tpqn,
            firstRestMinDurationSeconds,
            trackId,
          );
          for (const [phraseKey, phrase] of phrases) {
            generatedPhrases.set(phraseKey, phrase);
          }
        }

        const mergedPhrases = new Map<PhraseKey, Phrase>();
        const newlyCreatedPhraseKeys = new Set<PhraseKey>();
        const disappearedPhraseKeys = new Set<PhraseKey>();

        // 新しく作られたフレーズとstateにある既存のフレーズをマージする
        // 新しく作られたフレーズと無くなったフレーズのキーのリスト（Set）も作成する
        for (const phraseKey of state.phrases.keys()) {
          if (!generatedPhrases.has(phraseKey)) {
            disappearedPhraseKeys.add(phraseKey);
          }
        }
        for (const [phraseKey, generatedPhrase] of generatedPhrases) {
          const existingPhrase = state.phrases.get(phraseKey);
          const isNewlyCreated = existingPhrase == undefined;
          const phrase = isNewlyCreated
            ? generatedPhrase
            : cloneWithUnwrapProxy(existingPhrase);

          mergedPhrases.set(phraseKey, phrase);
          if (isNewlyCreated) {
            newlyCreatedPhraseKeys.add(phraseKey);
          }
        }

        // 各フレーズのレンダリング開始ステージを決定する
        // 新しいフレーズの場合は最初からレンダリングする
        // phrase.stateがCOULD_NOT_RENDERだった場合は最初からレンダリングし直す
        for (const [phraseKey, phrase] of mergedPhrases) {
          const trackId = phrase.trackId;
          const track = getOrThrow(snapshot.tracks, trackId);
          const isNewlyCreated = newlyCreatedPhraseKeys.has(phraseKey);

          if (track.singer == undefined) {
            continue;
          }
          if (isNewlyCreated || phrase.state === "COULD_NOT_RENDER") {
            renderStartStageIds.set(phraseKey, stages[0].id);
          } else {
            for (const stage of stages) {
              if (await stage.needsExecution(trackId, phraseKey, snapshot)) {
                renderStartStageIds.set(phraseKey, stage.id);
                break;
              }
            }
          }
        }

        // phrase.stateを更新する
        for (const [phraseKey, phrase] of mergedPhrases) {
          const track = getOrThrow(snapshot.tracks, phrase.trackId);
          if (track.singer == undefined) {
            phrase.state = "SINGER_IS_NOT_SET";
          } else {
            if (renderStartStageIds.has(phraseKey)) {
              phrase.state = "WAITING_TO_BE_RENDERED";
            } else {
              phrase.state = "PLAYABLE";
            }
          }
        }

        // 無くなったフレーズのシーケンスを削除する
        for (const phraseKey of disappearedPhraseKeys) {
          const phraseSequenceId = getPhraseSequenceId(phraseKey);
          if (phraseSequenceId != undefined) {
            deleteSequence(phraseSequenceId);
          }
        }

        // state.phrasesを更新する
        mutations.SET_PHRASES({ phrases: mergedPhrases });

        logger.info("Phrases updated.");

        // シンガーが設定されていないフレーズとレンダリング未完了のフレーズが
        // プレビュー音で再生されるようにする
        for (const [phraseKey, phrase] of state.phrases.entries()) {
          if (
            phrase.state === "SINGER_IS_NOT_SET" ||
            phrase.state === "WAITING_TO_BE_RENDERED"
          ) {
            // シーケンスが存在する場合は、シーケンスを削除する
            // TODO: ピッチを編集したときは行わないようにする
            const phraseSequenceId = getPhraseSequenceId(phraseKey);
            if (phraseSequenceId != undefined) {
              deleteSequence(phraseSequenceId);
              mutations.SET_SEQUENCE_ID_TO_PHRASE({
                phraseKey,
                sequenceId: undefined,
              });
            }

            // ノートシーケンスを生成して登録し、プレビュー音が鳴るようにする
            const sequenceId = SequenceId(uuid4());
            const noteSequence = generateNoteSequence(
              phrase.notes,
              snapshot.tempos,
              snapshot.tpqn,
              phrase.trackId,
            );
            registerSequence(sequenceId, noteSequence);
            mutations.SET_SEQUENCE_ID_TO_PHRASE({ phraseKey, sequenceId });
          }
        }

        // 各フレーズのレンダリングを行い、レンダリングされた音声が再生されるようにする
        const phrasesToBeRendered = new Map(
          [...state.phrases.entries()].filter(([, phrase]) => {
            return phrase.state === "WAITING_TO_BE_RENDERED";
          }),
        );
        while (phrasesToBeRendered.size > 0) {
          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }
          const [phraseKey, phrase] = selectPriorPhrase(
            phrasesToBeRendered,
            playheadPosition.value,
          );
          phrasesToBeRendered.delete(phraseKey);

          mutations.SET_STATE_TO_PHRASE({
            phraseKey,
            phraseState: "NOW_RENDERING",
          });

          try {
            // フレーズのレンダリングを行う
            const trackId = phrase.trackId;
            const startStageId = getOrThrow(renderStartStageIds, phraseKey);
            const startStageIndex = stages.findIndex((value) => {
              return value.id === startStageId;
            });
            if (startStageIndex === -1) {
              throw new Error("Stage not found.");
            }
            for (let i = stages.length - 1; i >= startStageIndex; i--) {
              stages[i].deleteExecutionResult(phraseKey);
            }
            for (let i = startStageIndex; i < stages.length; i++) {
              await stages[i].execute(trackId, phraseKey, snapshot);
            }

            // シーケンスが存在する場合、シーケンスを削除する
            const phraseSequenceId = getPhraseSequenceId(phraseKey);
            if (phraseSequenceId != undefined) {
              deleteSequence(phraseSequenceId);
              mutations.SET_SEQUENCE_ID_TO_PHRASE({
                phraseKey,
                sequenceId: undefined,
              });
            }

            // オーディオシーケンスを生成して登録する
            const singingVoiceKey = getPhraseSingingVoiceKey(phraseKey);
            if (singingVoiceKey == undefined) {
              throw new Error("singingVoiceKey is undefined.");
            }
            const singingVoice = getOrThrow(
              phraseSingingVoices,
              singingVoiceKey,
            );
            const sequenceId = SequenceId(uuid4());
            const audioSequence = await generateAudioSequence(
              phrase.startTime,
              singingVoice,
              phrase.trackId,
            );
            registerSequence(sequenceId, audioSequence);
            mutations.SET_SEQUENCE_ID_TO_PHRASE({ phraseKey, sequenceId });

            mutations.SET_STATE_TO_PHRASE({
              phraseKey,
              phraseState: "PLAYABLE",
            });
          } catch (error) {
            mutations.SET_STATE_TO_PHRASE({
              phraseKey,
              phraseState: "COULD_NOT_RENDER",
            });
            // とりあえずエラーはロギングしてcontinueする
            // NOTE: ほとんどは歌詞のエラー
            // FIXME: 歌詞以外のエラーの場合はthrowして、エラーダイアログを表示するようにする
            logger.error("An error occurred while rendering a phrase.", error);
            continue;
          }
        }
      };

      mutations.SET_START_RENDERING_REQUESTED({
        startRenderingRequested: true,
      });
      if (state.nowRendering) {
        return;
      }

      mutations.SET_NOW_RENDERING({ nowRendering: true });
      try {
        while (startRenderingRequested()) {
          mutations.SET_START_RENDERING_REQUESTED({
            startRenderingRequested: false,
          });
          await render();
          if (stopRenderingRequested()) {
            break;
          }
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
        logger.info("Waiting for rendering to stop...");
        mutations.SET_STOP_RENDERING_REQUESTED({
          stopRenderingRequested: true,
        });
        await createPromiseThatResolvesWhen(() => !state.nowRendering);
        logger.info("Rendering stopped.");
      }
    }),
  },

  FETCH_SING_FRAME_VOLUME: {
    async action(
      { actions },
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
      const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
        engineId,
      });
      return await instance.invoke("singFrameVolumeSingFrameVolumePost")({
        bodySingFrameVolumeSingFrameVolumePost: {
          score: {
            notes,
          },
          frameAudioQuery: query,
        },
        speaker: styleId,
      });
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
              singingVoiceCache,
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
        const exportLabelFile = async () => {
          if (state.nowPlaying) {
            await actions.SING_STOP_AUDIO();
          }

          if (state.savingSetting.fixedExportEnabled) {
            dirPath = state.savingSetting.fixedExportDir;
          } else {
            dirPath ??= await window.backend.showSaveDirectoryDialog({
              title: "labファイルを保存",
            });
          }
          if (!dirPath) {
            return createArray(
              state.tracks.size,
              (): SaveResultObject => ({ result: "CANCELED", path: "" }),
            );
          }

          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return !state.nowRendering || state.cancellationOfExportRequested;
            });
            if (state.cancellationOfExportRequested) {
              return createArray(
                state.tracks.size,
                (): SaveResultObject => ({ result: "CANCELED", path: "" }),
              );
            }
          }

          const results: SaveResultObject[] = [];

          for (const trackId of state.tracks.keys()) {
            const track = getOrThrow(state.tracks, trackId);
            if (track.singer == undefined) {
              continue;
            }

            const filePath = await actions.GENERATE_FILE_PATH_FOR_TRACK_EXPORT({
              trackId,
              directoryPath: dirPath,
              extension: "lab",
            });

            const frameRate = state.editorFrameRate;
            const phrases = [...state.phrases.values()]
              .filter((value) => value.trackId === trackId)
              .filter((value) => value.queryKey != undefined)
              .toSorted((a, b) => a.startTime - b.startTime);

            if (phrases.length === 0) {
              continue;
            }

            const phraseQueries = phrases.map((value) => {
              const phraseQuery =
                value.queryKey != undefined
                  ? state.phraseQueries.get(value.queryKey)
                  : undefined;
              if (phraseQuery == undefined) {
                throw new Error("phraseQuery is undefined.");
              }
              return phraseQuery;
            });
            const phraseStartTimes = phrases.map((value) => value.startTime);

            for (const phraseQuery of phraseQueries) {
              // フレーズのクエリのフレームレートとエディターのフレームレートが一致しない場合はエラー
              // TODO: 補間するようにする
              if (phraseQuery.frameRate != frameRate) {
                throw new Error(
                  "The frame rate between the phrase query and the editor does not match.",
                );
              }
            }

            const phraseStartFrames = calcPhraseStartFrames(
              phraseStartTimes,
              frameRate,
            );
            const phraseEndFrames = calcPhraseEndFrames(
              phraseStartFrames,
              phraseQueries,
            );

            const phrasePhonemeSequences = phraseQueries.map((query) => {
              return query.phonemes;
            });
            const entirePhonemeTimings = toEntirePhonemeTimings(
              phrasePhonemeSequences,
              phraseStartFrames,
            );

            // TODO: 音素タイミング編集データを取得して適用するようにする

            adjustPhonemeTimingsAndPhraseEndFrames(
              entirePhonemeTimings,
              phraseStartFrames,
              phraseEndFrames,
            );

            // 一番最初のpauseの開始フレームの値が0より大きい場合は0にする
            if (entirePhonemeTimings.length === 0) {
              throw new Error("entirePhonemeTimings.length is 0.");
            }
            if (entirePhonemeTimings[0].startFrame > 0) {
              entirePhonemeTimings[0].startFrame = 0;
            }

            // 音素の開始・終了フレームの値が0より小さい場合は0にする
            // （マイナス時間のところを書き出さないようにするため）
            for (const phonemeTiming of entirePhonemeTimings) {
              if (phonemeTiming.startFrame < 0) {
                phonemeTiming.startFrame = 0;
              }
              if (phonemeTiming.endFrame < 0) {
                phonemeTiming.endFrame = 0;
              }
            }

            // フレーム数が1未満の音素を除く
            const filteredEntirePhonemeTimings = entirePhonemeTimings.filter(
              (value) => {
                const frameLength = value.endFrame - value.startFrame;
                return frameLength >= 1;
              },
            );

            const entirePhonemes = phonemeTimingsToPhonemes(
              filteredEntirePhonemeTimings,
            );
            const labFileData = await generateLabelFileDataFromFramePhonemes(
              entirePhonemes,
              frameRate,
            );

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
    async action({ mutations, state, getters, actions }) {
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

      // パースしたJSONのノートの位置を現在の再生位置に合わせてクオンタイズして貼り付ける
      const currentPlayheadPosition = getters.PLAYHEAD_POSITION;
      const firstNotePosition = notes[0].position;
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const notesToPaste: Note[] = notes.map((note) => {
        // 新しい位置を現在の再生位置に合わせて計算する
        const pasteOriginPos =
          Number(note.position) - firstNotePosition + currentPlayheadPosition;
        // クオンタイズ
        const quantizedPastePos =
          Math.round(pasteOriginPos / snapTicks) * snapTicks;
        return {
          id: NoteId(uuid4()),
          position: quantizedPastePos,
          duration: Number(note.duration),
          noteNumber: Number(note.noteNumber),
          lyric: String(note.lyric),
        };
      });
      const pastedNoteIds = notesToPaste.map((note) => note.id);
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

          const selectedTrack = getOrThrow(
            state.tracks,
            getters.SELECTED_TRACK_ID,
          );

          const filteredTracks = trackIndexes.map((trackIndex) => {
            const track = tracks[trackIndex];
            if (!track) {
              throw new Error("Track not found.");
            }
            return {
              ...toRaw(selectedTrack),
              notes: track.notes.map((note) => ({
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
            const track = tracks[trackOrder[trackIndex]];
            if (!track) {
              throw new Error("Track not found.");
            }
            return {
              ...toRaw(track),
              notes: track.notes.map((note) => ({
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
  }),
  "song",
);
