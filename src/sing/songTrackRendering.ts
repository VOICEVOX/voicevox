import { getDoremiFromNoteNumber } from "./viewHelper";
import { getNoteDuration, secondToTick, tickToSecond } from "@/sing/music";
import { decibelToLinear } from "@/sing/audio";
import {
  EditorFrameAudioQuery,
  EditorFrameAudioQueryKey,
  PhraseKey,
  SingingPitch,
  SingingPitchKey,
  SingingVoice,
  SingingVoiceKey,
  SingingVolume,
  SingingVolumeKey,
} from "@/store/type";
import {
  calculateHash,
  getLast,
  getNext,
  getPrev,
  linearInterpolation,
} from "@/sing/utility";
import {
  adjustPhonemeTimings,
  applyPhonemeTimingEdit,
  applyPitchEdit,
  applyVolumeEdit,
  calculatePhraseKey,
  toPhonemeTimings,
  toPhonemes,
  selectPriorPhrase,
} from "@/sing/domain";
import { FramePhoneme, Note as NoteForRequestToEngine } from "@/openapi";
import { EngineId, NoteId, StyleId, TrackId } from "@/type/preload";
import { getOrThrow } from "@/helpers/mapHelper";
import type { Note, Singer, Tempo, Track } from "@/domain/project/type";
import { UnreachableError } from "@/type/utility";

/**
 * レンダリングに必要なデータのスナップショット
 */
export type SnapshotForRender = Readonly<{
  tpqn: number;
  tempos: Tempo[];
  tracks: Map<TrackId, Track>;
  trackOverlappingNoteIds: Map<TrackId, Set<NoteId>>;
  engineFrameRates: Map<EngineId, number>;
  editorFrameRate: number;
}>;

/**
 * レンダリング用のフレーズ
 */
export type PhraseForRender = {
  readonly singer: Singer | undefined;
  readonly firstRestDuration: number;
  readonly notes: Note[];
  readonly startTicks: number;
  readonly endTicks: number;
  readonly startTime: number;
  readonly minNonPauseStartFrame: number | undefined;
  readonly maxNonPauseEndFrame: number | undefined;
  readonly trackId: TrackId;
  queryKey?: EditorFrameAudioQueryKey;
  query?: EditorFrameAudioQuery;
  singingPitchKey?: SingingPitchKey;
  singingPitch?: SingingPitch;
  singingVolumeKey?: SingingVolumeKey;
  singingVolume?: SingingVolume;
  singingVoiceKey?: SingingVoiceKey;
  singingVoice?: SingingVoice;
};

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
  minNonPauseStartFrame: number | undefined;
  maxNonPauseEndFrame: number | undefined;
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
 * エンジンの歌声合成API
 */
type EngineSongApi = Readonly<{
  fetchFrameAudioQuery: (args: {
    engineId: EngineId;
    styleId: StyleId;
    engineFrameRate: number;
    notes: NoteForRequestToEngine[];
  }) => Promise<EditorFrameAudioQuery>;

  fetchSingFrameF0: (args: {
    notes: NoteForRequestToEngine[];
    query: EditorFrameAudioQuery;
    engineId: EngineId;
    styleId: StyleId;
  }) => Promise<number[]>;

  fetchSingFrameVolume: (args: {
    notes: NoteForRequestToEngine[];
    query: EditorFrameAudioQuery;
    engineId: EngineId;
    styleId: StyleId;
  }) => Promise<number[]>;

  frameSynthesis: (args: {
    query: EditorFrameAudioQuery;
    engineId: EngineId;
    styleId: StyleId;
  }) => Promise<Blob>;
}>;

/**
 * ソングトラックのレンダリングの設定。
 */
type SongTrackRenderingConfig = Readonly<{
  singingTeacherStyleId: StyleId;
  firstRestMinDurationSeconds: number;
  lastRestDurationSeconds: number;
  fadeOutDurationSeconds: number;
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
      lyric: note.lyric ?? getDoremiFromNoteNumber(note.noteNumber),
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

const ensureNonNegativeVolume = (volume: number[]) => {
  for (let i = 0; i < volume.length; i++) {
    volume[i] = Math.max(volume[i], 0);
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

/**
 * トラックのノーツからフレーズごとのノーツを抽出する。
 */
const extractPhraseNotes = (trackNotes: Note[]) => {
  const phraseNotes: Note[][] = [];
  let currentPhraseNotes: Note[] = [];

  for (let i = 0; i < trackNotes.length; i++) {
    const note = trackNotes[i];
    const nextNote = trackNotes.at(i + 1);
    const currentNoteEndPos = note.position + note.duration;

    currentPhraseNotes.push(note);

    // ノートが途切れていたら別のフレーズにする
    if (nextNote == undefined || currentNoteEndPos !== nextNote.position) {
      phraseNotes.push([...currentPhraseNotes]);
      currentPhraseNotes = [];
    }
  }

  return phraseNotes;
};

/**
 * `a`と`b`の差が大きいほど`b`に、小さいほど`a`に近づく値を計算する。
 * `k`と`p`を使い、`b`への近づき方を調整できる。
 *
 * @param a - `a`の値
 * @param b - `b`の値
 * @param k - 結果が`b`に収束する速さを調整する係数
 * @param p - `b`に収束する際のカーブの形状を決定する指数
 * @returns `a`と`b`の差に応じて計算された値
 */
const interpByDiff = (a: number, b: number, k: number, p: number) => {
  if (a > b) {
    throw new Error("a must be less than or equal to b.");
  }
  if (k < 0) {
    throw new Error("k must be a positive number.");
  }
  if (p < 0 || p > 1) {
    throw new Error("p must be between 0 and 1.");
  }
  const d = b - a;
  return b - d / (d ** p * k + 1);
};

/**
 * フレーズごとのノーツからフレーズを生成する。
 */
const createPhrasesFromNotes = async (
  phraseNotesList: Note[][],
  trackId: TrackId,
  snapshot: SnapshotForRender,
  firstRestMinDurationSeconds: number,
) => {
  const track = getOrThrow(snapshot.tracks, trackId);

  let engineFrameRate: number | undefined = undefined;
  if (track.singer != undefined) {
    engineFrameRate = getOrThrow(
      snapshot.engineFrameRates,
      track.singer.engineId,
    );
  }

  const phrases = new Map<PhraseKey, PhraseForRender>();

  let prevPhrase: PhraseForRender | undefined = undefined;
  for (let i = 0; i < phraseNotesList.length; i++) {
    const phraseNotes = phraseNotesList[i];
    const phraseFirstNote = phraseNotes[0];
    const phraseLastNote = getLast(phraseNotes);
    const prevPhraseNotes = getPrev(phraseNotesList, i);
    const prevPhraseLastNote = prevPhraseNotes?.at(-1);
    const nextPhraseNotes = getNext(phraseNotesList, i);
    const nextPhraseFirstNote = nextPhraseNotes?.[0];

    const phraseFirstRestDuration = calcPhraseFirstRestDuration(
      prevPhraseLastNote,
      phraseFirstNote,
      firstRestMinDurationSeconds,
      snapshot.tempos,
      snapshot.tpqn,
    );
    const phraseStartTime = calculatePhraseStartTime(
      phraseFirstRestDuration,
      phraseNotes,
      snapshot.tempos,
      snapshot.tpqn,
    );
    const phraseKey = await calculatePhraseKey({
      firstRestDuration: phraseFirstRestDuration,
      notes: phraseNotes,
      startTime: phraseStartTime,
      trackId,
    });

    let minNonPauseStartFrame: number | undefined = undefined;
    if (prevPhrase != undefined && engineFrameRate != undefined) {
      if (prevPhrase.maxNonPauseEndFrame == undefined) {
        throw new UnreachableError(
          "prevPhrase.maxNonPauseEndFrame is undefined.",
        );
      }
      minNonPauseStartFrame =
        Math.round(
          (prevPhrase.startTime - phraseStartTime) * engineFrameRate +
            prevPhrase.maxNonPauseEndFrame,
        ) + 1;
      minNonPauseStartFrame = Math.max(1, minNonPauseStartFrame);
    }

    let maxNonPauseEndFrame: number | undefined = undefined;
    if (nextPhraseFirstNote != undefined && engineFrameRate != undefined) {
      const t1 = tickToSecond(
        phraseFirstNote.position,
        snapshot.tempos,
        snapshot.tpqn,
      );
      const t2 = tickToSecond(
        phraseLastNote.position + phraseLastNote.duration,
        snapshot.tempos,
        snapshot.tpqn,
      );
      const t3 = tickToSecond(
        nextPhraseFirstNote.position,
        snapshot.tempos,
        snapshot.tpqn,
      );

      const minBoundaryTime = interpByDiff(t1, t2, 7, 1);
      const boundaryTime = interpByDiff(minBoundaryTime, t3, 3.5, 0.6);

      maxNonPauseEndFrame = Math.floor(
        (boundaryTime - phraseStartTime) * engineFrameRate,
      );
      if (minNonPauseStartFrame != undefined) {
        maxNonPauseEndFrame = Math.max(
          minNonPauseStartFrame,
          maxNonPauseEndFrame,
        );
      }
    }

    const phrase: PhraseForRender = {
      singer: track.singer,
      firstRestDuration: phraseFirstRestDuration,
      notes: phraseNotes,
      startTicks: phraseFirstNote.position,
      endTicks: phraseLastNote.position + phraseLastNote.duration,
      startTime: phraseStartTime,
      minNonPauseStartFrame,
      maxNonPauseEndFrame,
      trackId,
    };

    phrases.set(phraseKey, phrase);
    prevPhrase = phrase;
  }

  return phrases;
};

/**
 * 各トラックのノーツからフレーズを生成する。
 * 重なっているノートはフレーズには含まれない。
 */
const generatePhrases = async (
  snapshot: SnapshotForRender,
  config: SongTrackRenderingConfig,
) => {
  const phrases = new Map<PhraseKey, PhraseForRender>();

  for (const [trackId, track] of snapshot.tracks) {
    // 重なっているノートを除く
    const overlappingNoteIds = getOrThrow(
      snapshot.trackOverlappingNoteIds,
      trackId,
    );
    const trackNotes = track.notes.filter(
      (value) => !overlappingNoteIds.has(value.id),
    );

    // トラックのノーツからフレーズごとのノーツを抽出
    const phraseNotesList = extractPhraseNotes(trackNotes);

    // フレーズごとのノーツからフレーズを生成
    const trackPhrases = await createPhrasesFromNotes(
      phraseNotesList,
      trackId,
      snapshot,
      config.firstRestMinDurationSeconds,
    );

    // 結果をマージ
    for (const [key, phrase] of trackPhrases) {
      phrases.set(key, phrase);
    }
  }

  return phrases;
};

const generateQuerySource = (
  phrase: PhraseForRender,
  snapshot: SnapshotForRender,
): QuerySource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  const engineFrameRate = getOrThrow(
    snapshot.engineFrameRates,
    track.singer.engineId,
  );
  return {
    engineId: track.singer.engineId,
    engineFrameRate,
    tpqn: snapshot.tpqn,
    tempos: snapshot.tempos,
    firstRestDuration: phrase.firstRestDuration,
    notes: phrase.notes,
    keyRangeAdjustment: track.keyRangeAdjustment,
    minNonPauseStartFrame: phrase.minNonPauseStartFrame,
    maxNonPauseEndFrame: phrase.maxNonPauseEndFrame,
  };
};

const generateSingingPitchSource = (
  phrase: PhraseForRender,
  snapshot: SnapshotForRender,
): SingingPitchSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.query == undefined) {
    throw new Error("phrase.query is undefined.");
  }

  const clonedQuery = structuredClone(phrase.query);

  // 音素タイミング編集を適用して調整を行う
  const phonemeTimings = toPhonemeTimings(clonedQuery.phonemes);
  applyPhonemeTimingEdit(
    phonemeTimings,
    track.phonemeTimingEditData,
    clonedQuery.frameRate,
  );
  adjustPhonemeTimings(
    phonemeTimings,
    phrase.minNonPauseStartFrame,
    phrase.maxNonPauseEndFrame,
  );
  clonedQuery.phonemes = toPhonemes(phonemeTimings);

  return {
    engineId: track.singer.engineId,
    engineFrameRate: phrase.query.frameRate,
    tpqn: snapshot.tpqn,
    tempos: snapshot.tempos,
    firstRestDuration: phrase.firstRestDuration,
    notes: phrase.notes,
    keyRangeAdjustment: track.keyRangeAdjustment,
    queryForPitchGeneration: clonedQuery,
  };
};

const generateSingingVolumeSource = (
  phrase: PhraseForRender,
  snapshot: SnapshotForRender,
): SingingVolumeSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.query == undefined) {
    throw new Error("phrase.query is undefined.");
  }
  if (phrase.singingPitch == undefined) {
    throw new Error("phrase.singingPitch is undefined.");
  }

  const clonedQuery = structuredClone(phrase.query);

  // ピッチ編集を適用したf0をボリューム生成に使うため、ピッチをクローンして適用する
  const clonedSingingPitch = structuredClone(phrase.singingPitch);
  clonedQuery.f0 = clonedSingingPitch;

  applyPitchEdit(
    clonedQuery,
    phrase.startTime,
    track.pitchEditData,
    snapshot.editorFrameRate,
  );

  return {
    engineId: track.singer.engineId,
    engineFrameRate: phrase.query.frameRate,
    tpqn: snapshot.tpqn,
    tempos: snapshot.tempos,
    firstRestDuration: phrase.firstRestDuration,
    notes: phrase.notes,
    keyRangeAdjustment: track.keyRangeAdjustment,
    volumeRangeAdjustment: track.volumeRangeAdjustment,
    queryForVolumeGeneration: clonedQuery,
  };
};

const generateSingingVoiceSource = (
  phrase: PhraseForRender,
  snapshot: SnapshotForRender,
): SingingVoiceSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.query == undefined) {
    throw new Error("phrase.query is undefined.");
  }
  if (phrase.singingPitch == undefined) {
    throw new Error("phrase.singingPitch is undefined.");
  }
  if (phrase.singingVolume == undefined) {
    throw new Error("phrase.singingVolume is undefined.");
  }

  const clonedQuery = structuredClone(phrase.query);
  const clonedSingingPitch = structuredClone(phrase.singingPitch);
  const clonedSingingVolume = structuredClone(phrase.singingVolume);

  clonedQuery.f0 = clonedSingingPitch;
  clonedQuery.volume = clonedSingingVolume;

  applyPitchEdit(
    clonedQuery,
    phrase.startTime,
    track.pitchEditData,
    snapshot.editorFrameRate,
  );
  applyVolumeEdit(
    clonedQuery,
    phrase.startTime,
    track.volumeEditData,
    snapshot.editorFrameRate,
  );
  shiftVolume(clonedQuery.volume, track.volumeRangeAdjustment);

  return {
    singer: track.singer,
    queryForSingingVoiceSynthesis: clonedQuery,
  };
};

const generateQuery = async (
  querySource: QuerySource,
  config: SongTrackRenderingConfig,
  engineSongApi: EngineSongApi,
) => {
  const notesForRequestToEngine = createNotesForRequestToEngine(
    querySource.firstRestDuration,
    config.lastRestDurationSeconds,
    querySource.notes,
    querySource.tempos,
    querySource.tpqn,
    querySource.engineFrameRate,
  );

  shiftKeyOfNotes(notesForRequestToEngine, -querySource.keyRangeAdjustment);

  const query = await engineSongApi.fetchFrameAudioQuery({
    engineId: querySource.engineId,
    styleId: config.singingTeacherStyleId,
    engineFrameRate: querySource.engineFrameRate,
    notes: notesForRequestToEngine,
  });

  shiftPitch(query.f0, querySource.keyRangeAdjustment);

  const phonemeTimings = toPhonemeTimings(query.phonemes);
  adjustPhonemeTimings(
    phonemeTimings,
    querySource.minNonPauseStartFrame,
    querySource.maxNonPauseEndFrame,
  );
  query.phonemes = toPhonemes(phonemeTimings);

  return query;
};

const generateSingingPitch = async (
  singingPitchSource: SingingPitchSource,
  config: SongTrackRenderingConfig,
  engineSongApi: EngineSongApi,
) => {
  const notesForRequestToEngine = createNotesForRequestToEngine(
    singingPitchSource.firstRestDuration,
    config.lastRestDurationSeconds,
    singingPitchSource.notes,
    singingPitchSource.tempos,
    singingPitchSource.tpqn,
    singingPitchSource.engineFrameRate,
  );
  const queryForPitchGeneration = singingPitchSource.queryForPitchGeneration;

  shiftKeyOfNotes(
    notesForRequestToEngine,
    -singingPitchSource.keyRangeAdjustment,
  );

  const singingPitch = await engineSongApi.fetchSingFrameF0({
    notes: notesForRequestToEngine,
    query: queryForPitchGeneration,
    engineId: singingPitchSource.engineId,
    styleId: config.singingTeacherStyleId,
  });

  shiftPitch(singingPitch, singingPitchSource.keyRangeAdjustment);

  return singingPitch;
};

const generateSingingVolume = async (
  singingVolumeSource: SingingVolumeSource,
  config: SongTrackRenderingConfig,
  engineSongApi: EngineSongApi,
) => {
  const notesForRequestToEngine = createNotesForRequestToEngine(
    singingVolumeSource.firstRestDuration,
    config.lastRestDurationSeconds,
    singingVolumeSource.notes,
    singingVolumeSource.tempos,
    singingVolumeSource.tpqn,
    singingVolumeSource.engineFrameRate,
  );
  const queryForVolumeGeneration = singingVolumeSource.queryForVolumeGeneration;

  shiftKeyOfNotes(
    notesForRequestToEngine,
    -singingVolumeSource.keyRangeAdjustment,
  );
  shiftPitch(
    queryForVolumeGeneration.f0,
    -singingVolumeSource.keyRangeAdjustment,
  );

  const singingVolume = await engineSongApi.fetchSingFrameVolume({
    notes: notesForRequestToEngine,
    query: queryForVolumeGeneration,
    engineId: singingVolumeSource.engineId,
    styleId: config.singingTeacherStyleId,
  });

  muteLastPauSection(
    singingVolume,
    queryForVolumeGeneration.phonemes,
    singingVolumeSource.engineFrameRate,
    config.fadeOutDurationSeconds,
  );

  ensureNonNegativeVolume(singingVolume);

  return singingVolume;
};

const synthesizeSingingVoice = async (
  singingVoiceSource: SingingVoiceSource,
  engineSongApi: EngineSongApi,
) => {
  const singingVoice = await engineSongApi.frameSynthesis({
    query: singingVoiceSource.queryForSingingVoiceSynthesis,
    engineId: singingVoiceSource.singer.engineId,
    styleId: singingVoiceSource.singer.styleId,
  });

  return singingVoice;
};

/**
 * ソングトラックのレンダリング結果。
 */
export type SongTrackRenderingResult =
  | {
      readonly type: "complete";
      readonly phrases: Map<PhraseKey, PhraseForRender>;
    }
  | {
      readonly type: "interrupted";
    };

/**
 * フレーズが生成されたときに発行されるイベント。
 */
export type PhrasesGeneratedEvent = {
  readonly type: "phrasesGenerated";
  readonly phrases: Map<PhraseKey, PhraseForRender>;
  readonly snapshot: SnapshotForRender;
};

/**
 * キャッシュからデータが読み込まれ、フレーズに適用されたときに発行されるイベント。
 */
export type CacheLoadedEvent = {
  readonly type: "cacheLoaded";
  readonly phrases: Map<PhraseKey, PhraseForRender>;
  readonly snapshot: SnapshotForRender;
};

/**
 * 特定のフレーズのレンダリングが開始されたときに発行されるイベント。
 */
export type PhraseRenderingStartedEvent = {
  readonly type: "phraseRenderingStarted";
  readonly phraseKey: PhraseKey;
};

/**
 * 音声合成クエリの生成が完了したときに発行されるイベント。
 */
export type QueryGenerationCompleteEvent = {
  readonly type: "queryGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly queryKey: EditorFrameAudioQueryKey;
  readonly query: EditorFrameAudioQuery;
};

/**
 * 歌唱ピッチの生成が完了したときに発行されるイベント。
 */
export type PitchGenerationCompleteEvent = {
  readonly type: "pitchGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly singingPitchKey: SingingPitchKey;
  readonly singingPitch: SingingPitch;
};

/**
 * 歌唱ボリュームの生成が完了したときに発行されるイベント。
 */
export type VolumeGenerationCompleteEvent = {
  readonly type: "volumeGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly singingVolumeKey: SingingVolumeKey;
  readonly singingVolume: SingingVolume;
};

/**
 * 歌声の合成が完了したときに発行されるイベント。
 */
export type VoiceSynthesisCompleteEvent = {
  readonly type: "voiceSynthesisComplete";
  readonly phraseKey: PhraseKey;
  readonly singingVoiceKey: SingingVoiceKey;
  readonly singingVoice: SingingVoice;
};

/**
 * 特定のフレーズのレンダリング（クエリ生成、ピッチ生成、ボリューム生成、音声合成）が
 * 全て完了したときに発行されるイベント。
 */
export type PhraseRenderingCompleteEvent = {
  readonly type: "phraseRenderingComplete";
  readonly phraseKey: PhraseKey;
  readonly phrase: PhraseForRender;
  readonly snapshot: SnapshotForRender;
};

/**
 * 特定のフレーズのレンダリング中にエラーが発生したときに発行されるイベント。
 */
export type PhraseRenderingErrorEvent = {
  readonly type: "phraseRenderingError";
  readonly phraseKey: PhraseKey;
  readonly error: unknown;
};

export type SongTrackRenderingEvent =
  | PhrasesGeneratedEvent
  | CacheLoadedEvent
  | PhraseRenderingStartedEvent
  | QueryGenerationCompleteEvent
  | PitchGenerationCompleteEvent
  | VolumeGenerationCompleteEvent
  | VoiceSynthesisCompleteEvent
  | PhraseRenderingCompleteEvent
  | PhraseRenderingErrorEvent;

/**
 * ソングトラックのレンダリング処理を担当するクラス。
 * フレーズ生成、キャッシュ管理、エンジンAPIとの連携、イベント通知などを行う。
 */
export class SongTrackRenderer {
  private readonly config: SongTrackRenderingConfig;
  private readonly engineSongApi: EngineSongApi;
  private readonly playheadPositionGetter: () => number;

  private readonly queryCache: Map<
    EditorFrameAudioQueryKey,
    EditorFrameAudioQuery
  > = new Map();
  private readonly singingPitchCache: Map<SingingPitchKey, SingingPitch> =
    new Map();
  private readonly singingVolumeCache: Map<SingingVolumeKey, SingingVolume> =
    new Map();
  private readonly singingVoiceCache: Map<SingingVoiceKey, SingingVoice> =
    new Map();

  private readonly listeners: Set<(event: SongTrackRenderingEvent) => void> =
    new Set();

  private _isRendering = false;
  private interruptionRequested = false;

  /**
   * 現在レンダリング処理を実行中かどうかを取得する。
   *
   * @returns レンダリング中の場合は `true`、そうでない場合は `false`。
   */
  get isRendering() {
    return this._isRendering;
  }

  /**
   * SongTrackRenderer の新しいインスタンスを生成する。
   *
   * @param args コンストラクタ引数。
   * @param args.config レンダリングに関する設定。
   * @param args.engineSongApi エンジンAPIへのインターフェース。
   * @param args.playheadPositionGetter 再生ヘッド位置のゲッター。
   */
  constructor(args: {
    config: SongTrackRenderingConfig;
    engineSongApi: EngineSongApi;
    playheadPositionGetter: () => number;
  }) {
    this.config = args.config;
    this.engineSongApi = args.engineSongApi;
    this.playheadPositionGetter = args.playheadPositionGetter;
  }

  /**
   * 指定されたスナップショットに基づいてソングトラックのレンダリングを実行する。
   *
   * @param snapshot レンダリングの元となるプロジェクトの状態のスナップショット。
   * @returns レンダリング結果。完了した場合はフレーズ情報、中断された場合は中断を示す情報。
   * @throws 既に別のレンダリング処理が進行中の場合にエラーをスローする。
   */
  async render(snapshot: SnapshotForRender): Promise<SongTrackRenderingResult> {
    if (this._isRendering) {
      throw new Error("Rendering is already in progress.");
    }
    this._isRendering = true;

    try {
      // スナップショットからフレーズを生成
      const phrases = await generatePhrases(snapshot, this.config);
      this.dispatchEvent({
        type: "phrasesGenerated",
        phrases: SongTrackRenderer.clonePhrases(phrases),
        snapshot,
      });

      // レンダリング可能なフレーズを抽出
      const renderablePhrases = this.filterRenderablePhrases(phrases, snapshot);

      // 既存のキャッシュデータをフレーズに適用
      await this.applyCachedDataToPhrases(renderablePhrases, snapshot);
      this.dispatchEvent({
        type: "cacheLoaded",
        phrases: SongTrackRenderer.clonePhrases(phrases),
        snapshot,
      });

      // レンダリングが必要な（キャッシュが適用されなかった）フレーズを抽出
      const phrasesToRender =
        this.filterPhrasesRequiringRender(renderablePhrases);

      // レンダリングが必要なフレーズがなくなるか、中断要求があるまでループ
      while (phrasesToRender.size > 0 && !this.interruptionRequested) {
        // 再生ヘッド位置に近いフレーズから優先的に処理
        const phraseKey = selectPriorPhrase(
          phrasesToRender,
          this.playheadPositionGetter(),
        );
        const phrase = getOrThrow(phrasesToRender, phraseKey);
        phrasesToRender.delete(phraseKey);

        // フレーズをレンダリング
        try {
          await this.renderPhrase(phrase, phraseKey, snapshot);
        } catch (error) {
          // レンダリング中にエラーが発生した場合は、とりあえずイベントを送出してcontinueする
          // NOTE: ほとんどは歌詞のエラー
          // FIXME: 歌詞以外のエラーの場合はthrowして、エラーダイアログを表示するようにする
          this.dispatchEvent({
            type: "phraseRenderingError",
            phraseKey,
            error,
          });
          continue;
        }
      }

      // 中断要求があった場合は interrupted、中断要求がなかった場合は complete を返す
      if (this.interruptionRequested) {
        return { type: "interrupted" };
      } else {
        return { type: "complete", phrases };
      }
    } finally {
      this.interruptionRequested = false;
      this._isRendering = false;
    }
  }

  /**
   * 現在進行中のレンダリング処理の中断を要求する。
   * 中断要求は、次のフレーズのレンダリング処理に移る前にチェックされる。
   * 既に実行中の個々のフレーズレンダリング処理は中断されない。
   *
   * @throws レンダリング処理が進行中でない場合にエラーをスローする。
   */
  requestRenderingInterruption() {
    if (!this._isRendering) {
      throw new Error("Rendering is not in progress.");
    }
    this.interruptionRequested = true;
  }

  /**
   * レンダリングイベントを受け取るリスナー関数を追加する。
   *
   * @param listener イベントを受け取るリスナー関数。
   * @throws 同じリスナー関数が既に登録されている場合にエラーをスローする。
   */
  addEventListener(listener: (event: SongTrackRenderingEvent) => void) {
    const exists = this.listeners.has(listener);
    if (exists) {
      throw new Error("Listener already exists.");
    }
    this.listeners.add(listener);
  }

  /**
   * 登録されているイベントリスナー関数を削除する。
   *
   * @param listener 削除するリスナー関数。
   * @throws 指定されたリスナー関数が存在しない場合にエラーをスローする。
   */
  removeEventListener(listener: (event: SongTrackRenderingEvent) => void) {
    const exists = this.listeners.has(listener);
    if (!exists) {
      throw new Error("Listener does not exist.");
    }
    this.listeners.delete(listener);
  }

  /**
   * フレーズのマップから、レンダリング可能なフレーズを抽出する。
   *
   * @param phrases 全てのフレーズを含むマップ。
   * @returns レンダリング可能なフレーズのみを含む新しいマップ。
   */
  private filterRenderablePhrases(
    phrases: Map<PhraseKey, PhraseForRender>,
    snapshot: SnapshotForRender,
  ) {
    const renderablePhrases = new Map<PhraseKey, PhraseForRender>();
    for (const [phraseKey, phrase] of phrases) {
      // フレーズが属するトラックにシンガーが割り当てられていれば、レンダリング可能とする
      const track = getOrThrow(snapshot.tracks, phrase.trackId);
      if (track.singer != undefined) {
        renderablePhrases.set(phraseKey, phrase);
      }
    }
    return renderablePhrases;
  }

  /**
   * 既存のキャッシュ（クエリ、ピッチ、ボリューム、歌声）を読み込み、
   * 対応するフレーズオブジェクトにデータを設定する。
   * キャッシュヒットした場合、そのデータがフレーズオブジェクトのプロパティに直接割り当てられる。
   * キャッシュが見つからなかった場合、対応するプロパティは `undefined` のままとなる。
   *
   * @param phrases 対象となるフレーズのマップ。このマップ内のフレーズオブジェクトが変更される。
   * @param snapshot 現在のスナップショット。キャッシュキーの計算に使用される。
   */
  private async applyCachedDataToPhrases(
    phrases: Map<PhraseKey, PhraseForRender>,
    snapshot: SnapshotForRender,
  ) {
    for (const phrase of phrases.values()) {
      // クエリキャッシュの読み込みと適用
      const queryAndKey = await this.loadQueryAndKeyFromCache(phrase, snapshot);
      if (queryAndKey != undefined) {
        phrase.queryKey = queryAndKey.key;
        phrase.query = queryAndKey.query;
      } else {
        continue;
      }

      // 歌唱ピッチキャッシュの読み込みと適用
      const singingPitchAndKey = await this.loadSingingPitchAndKeyFromCache(
        phrase,
        snapshot,
      );
      if (singingPitchAndKey != undefined) {
        phrase.singingPitchKey = singingPitchAndKey.key;
        phrase.singingPitch = singingPitchAndKey.singingPitch;
      } else {
        continue;
      }

      // 歌唱ボリュームキャッシュの読み込みと適用
      const singingVolumeAndKey = await this.loadSingingVolumeAndKeyFromCache(
        phrase,
        snapshot,
      );
      if (singingVolumeAndKey != undefined) {
        phrase.singingVolumeKey = singingVolumeAndKey.key;
        phrase.singingVolume = singingVolumeAndKey.singingVolume;
      } else {
        continue;
      }

      // 歌声キャッシュの読み込みと適用
      const singingVoiceAndKey = await this.loadSingingVoiceAndKeyFromCache(
        phrase,
        snapshot,
      );
      if (singingVoiceAndKey != undefined) {
        phrase.singingVoiceKey = singingVoiceAndKey.key;
        phrase.singingVoice = singingVoiceAndKey.singingVoice;
      }
    }
  }

  /**
   * フレーズのマップから、実際にレンダリング（クエリ生成など）が必要なフレーズのみを抽出する。
   * クエリ、ピッチ、ボリューム、歌声のいずれかが未設定のフレーズが対象となる。
   *
   * @param phrases 全てのフレーズを含むマップ。
   * @returns レンダリングが必要なフレーズのみを含む新しいマップ。
   */
  private filterPhrasesRequiringRender(
    phrases: Map<PhraseKey, PhraseForRender>,
  ) {
    const phrasesToRender = new Map<PhraseKey, PhraseForRender>();
    for (const [phraseKey, phrase] of phrases) {
      if (
        phrase.query == undefined ||
        phrase.singingPitch == undefined ||
        phrase.singingVolume == undefined ||
        phrase.singingVoice == undefined
      ) {
        phrasesToRender.set(phraseKey, phrase);
      }
    }
    return phrasesToRender;
  }

  /**
   * 指定された単一のフレーズをレンダリングする。
   * クエリ、ピッチ、ボリュームの生成、および歌声の合成を順次行う。
   *
   * @param phrase レンダリング対象のフレーズオブジェクト。このオブジェクトは処理中に変更される。
   * @param phraseKey レンダリング対象のフレーズのキー。
   * @param snapshot 現在のスナップショット。
   * @throws エンジンAPI呼び出しなどでエラーが発生した場合、例外がスローされる可能性がある。
   */
  private async renderPhrase(
    phrase: PhraseForRender,
    phraseKey: PhraseKey,
    snapshot: SnapshotForRender,
  ) {
    this.dispatchEvent({ type: "phraseRenderingStarted", phraseKey });

    // クエリ生成 (必要な場合)
    if (phrase.query == undefined) {
      const { key, query } = await this.generateQueryWithKey(phrase, snapshot);
      phrase.queryKey = key;
      phrase.query = query;
      this.queryCache.set(key, query);

      this.dispatchEvent({
        type: "queryGenerationComplete",
        phraseKey,
        queryKey: key,
        query,
      });
    }

    // 歌唱ピッチ生成 (必要な場合)
    if (phrase.singingPitch == undefined) {
      const { key, singingPitch } = await this.generateSingingPitchWithKey(
        phrase,
        snapshot,
      );
      phrase.singingPitchKey = key;
      phrase.singingPitch = singingPitch;
      this.singingPitchCache.set(key, singingPitch);

      this.dispatchEvent({
        type: "pitchGenerationComplete",
        phraseKey,
        singingPitchKey: key,
        singingPitch,
      });
    }

    // 歌唱ボリューム生成 (必要な場合)
    if (phrase.singingVolume == undefined) {
      const { key, singingVolume } = await this.generateSingingVolumeWithKey(
        phrase,
        snapshot,
      );
      phrase.singingVolumeKey = key;
      phrase.singingVolume = singingVolume;
      this.singingVolumeCache.set(key, singingVolume);

      this.dispatchEvent({
        type: "volumeGenerationComplete",
        phraseKey,
        singingVolumeKey: key,
        singingVolume,
      });
    }

    // 音声合成 (必要な場合)
    if (phrase.singingVoice == undefined) {
      const { key, singingVoice } = await this.synthesizeSingingVoiceWithKey(
        phrase,
        snapshot,
      );
      phrase.singingVoiceKey = key;
      phrase.singingVoice = singingVoice;
      this.singingVoiceCache.set(key, singingVoice);

      this.dispatchEvent({
        type: "voiceSynthesisComplete",
        phraseKey,
        singingVoiceKey: key,
        singingVoice,
      });
    }

    this.dispatchEvent({
      type: "phraseRenderingComplete",
      phraseKey,
      phrase: SongTrackRenderer.clonePhrase(phrase),
      snapshot,
    });
  }

  /**
   * クエリキャッシュからデータを読み込む。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。キャッシュキー計算に使用。
   * @returns キャッシュヒットした場合はキーとクエリのオブジェクト、なければ undefined。
   */
  private async loadQueryAndKeyFromCache(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const querySource = generateQuerySource(phrase, snapshot);
    const key = await calculateQueryKey(querySource);
    const query = this.queryCache.get(key);
    return query != undefined ? { key, query } : undefined;
  }

  /**
   * 歌唱ピッチキャッシュからデータを読み込む。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。キャッシュキー計算に使用。
   * @returns キャッシュヒットした場合はキーとピッチのオブジェクト、なければ undefined。
   */
  private async loadSingingPitchAndKeyFromCache(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingPitchSource = generateSingingPitchSource(phrase, snapshot);
    const key = await calculateSingingPitchKey(singingPitchSource);
    const singingPitch = this.singingPitchCache.get(key);
    return singingPitch != undefined ? { key, singingPitch } : undefined;
  }

  /**
   * 歌唱ボリュームキャッシュからデータを読み込む。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。キャッシュキー計算に使用。
   * @returns キャッシュヒットした場合はキーとボリュームのオブジェクト、なければ undefined。
   */
  private async loadSingingVolumeAndKeyFromCache(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingVolumeSource = generateSingingVolumeSource(phrase, snapshot);
    const key = await calculateSingingVolumeKey(singingVolumeSource);
    const singingVolume = this.singingVolumeCache.get(key);
    return singingVolume != undefined ? { key, singingVolume } : undefined;
  }

  /**
   * 歌声キャッシュからデータを読み込む。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。キャッシュキー計算に使用。
   * @returns キャッシュヒットした場合はキーと歌声のオブジェクト、なければ undefined。
   */
  private async loadSingingVoiceAndKeyFromCache(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingVoiceSource = generateSingingVoiceSource(phrase, snapshot);
    const key = await calculateSingingVoiceKey(singingVoiceSource);
    const singingVoice = this.singingVoiceCache.get(key);
    return singingVoice != undefined ? { key, singingVoice } : undefined;
  }

  /**
   * クエリを生成し、そのキーも計算して返す。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。
   * @returns 生成されたクエリとそのキー。
   */
  private async generateQueryWithKey(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const querySource = generateQuerySource(phrase, snapshot);
    const key = await calculateQueryKey(querySource);
    const query = await generateQuery(
      querySource,
      this.config,
      this.engineSongApi,
    );
    return { key, query };
  }

  /**
   * 歌唱ピッチを生成し、そのキーも計算して返す。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。
   * @returns 生成された歌唱ピッチとそのキー。
   */
  private async generateSingingPitchWithKey(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingPitchSource = generateSingingPitchSource(phrase, snapshot);
    const key = await calculateSingingPitchKey(singingPitchSource);
    const singingPitch = await generateSingingPitch(
      singingPitchSource,
      this.config,
      this.engineSongApi,
    );
    return { key, singingPitch };
  }

  /**
   * 歌唱ボリュームを生成し、そのキーも計算して返す。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。
   * @returns 生成された歌唱ボリュームとそのキー。
   */
  private async generateSingingVolumeWithKey(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingVolumeSource = generateSingingVolumeSource(phrase, snapshot);
    const key = await calculateSingingVolumeKey(singingVolumeSource);
    const singingVolume = await generateSingingVolume(
      singingVolumeSource,
      this.config,
      this.engineSongApi,
    );
    return { key, singingVolume };
  }

  /**
   * 歌声を合成し、そのキーも計算して返す。
   *
   * @param phrase 対象フレーズ。
   * @param snapshot 現在のスナップショット。
   * @returns 合成された歌声とそのキー。
   */
  private async synthesizeSingingVoiceWithKey(
    phrase: PhraseForRender,
    snapshot: SnapshotForRender,
  ) {
    const singingVoiceSource = generateSingingVoiceSource(phrase, snapshot);
    const key = await calculateSingingVoiceKey(singingVoiceSource);
    const singingVoice = await synthesizeSingingVoice(
      singingVoiceSource,
      this.engineSongApi,
    );
    return { key, singingVoice };
  }

  /**
   * 登録されているすべてのリスナーにイベントをディスパッチ（発行）する。
   *
   * @param event 発行するイベントオブジェクト。
   */
  private dispatchEvent(event: SongTrackRenderingEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * フレーズのマップを複製する。（シャローコピー）
   *
   * @param phrases フレーズのマップ。
   * @returns 複製されたフレーズのマップ。
   */
  private static clonePhrases(phrases: Map<PhraseKey, PhraseForRender>) {
    return new Map(
      [...phrases.entries()].map(([phraseKey, phrase]) => {
        return [phraseKey, SongTrackRenderer.clonePhrase(phrase)];
      }),
    );
  }

  /**
   * フレーズを複製する。（シャローコピー）
   *
   * @param phrase フレーズオブジェクト。
   * @returns 複製されたフレーズオブジェクト。
   */
  private static clonePhrase(phrase: PhraseForRender): PhraseForRender {
    // 歌唱ピッチや歌声などは、SongTrackRenderer内ではイミュータブルとして扱われるので、シャローコピーで問題なし
    return { ...phrase };
  }
}
