import {
  EditorFrameAudioQuery,
  EditorFrameAudioQueryKey,
  Note,
  Phrase,
  PhraseKey,
  Singer,
  SingingPitch,
  SingingPitchKey,
  SingingVoiceKey,
  SingingVolume,
  SingingVolumeKey,
  Tempo,
  Track,
} from "@/store/type";
import { calculateHash, getPrev, linearInterpolation } from "@/sing/utility";
import {
  applyPitchEdit,
  calculatePhraseKey,
  decibelToLinear,
  getNoteDuration,
  secondToTick,
  tickToSecond,
} from "@/sing/domain";
import { FramePhoneme, Note as NoteForRequestToEngine } from "@/openapi";
import { EngineId, NoteId, TrackId } from "@/type/preload";
import { getOrThrow } from "@/helpers/mapHelper";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

/**
 * フレーズレンダリングに必要なデータのスナップショット
 */
export type SnapshotForPhraseRender = Readonly<{
  tpqn: number;
  tempos: Tempo[];
  tracks: Map<TrackId, Track>;
  trackOverlappingNoteIds: Map<TrackId, Set<NoteId>>;
  engineFrameRates: Map<EngineId, number>;
  editorFrameRate: number;
}>;

/**
 * クエリの生成に必要なデータ
 */
export type QuerySource = Readonly<{
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
export type SingingPitchSource = Readonly<{
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
export type SingingVolumeSource = Readonly<{
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
export type SingingVoiceSource = Readonly<{
  singer: Singer;
  queryForSingingVoiceSynthesis: EditorFrameAudioQuery;
}>;

/**
 * リクエスト用のノーツ（と休符）を作成する。
 */
export const createNotesForRequestToEngine = (
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

export const shiftKeyOfNotes = (
  notes: NoteForRequestToEngine[],
  keyShift: number,
) => {
  for (const note of notes) {
    if (note.key != undefined) {
      note.key += keyShift;
    }
  }
};

export const getPhonemes = (query: EditorFrameAudioQuery) => {
  return query.phonemes.map((value) => value.phoneme).join(" ");
};

export const shiftPitch = (f0: number[], pitchShift: number) => {
  for (let i = 0; i < f0.length; i++) {
    f0[i] *= Math.pow(2, pitchShift / 12);
  }
};

export const shiftVolume = (volume: number[], volumeShift: number) => {
  for (let i = 0; i < volume.length; i++) {
    volume[i] *= decibelToLinear(volumeShift);
  }
};

/**
 * 末尾のpauの区間のvolumeを0にする。（歌とpauの呼吸音が重ならないようにする）
 * fadeOutDurationSecondsが0の場合は即座にvolumeを0にする。
 */
export const muteLastPauSection = (
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

export const calculateQueryKey = async (querySource: QuerySource) => {
  const hash = await calculateHash(querySource);
  return EditorFrameAudioQueryKey(hash);
};

export const calculateSingingPitchKey = async (
  singingPitchSource: SingingPitchSource,
) => {
  const hash = await calculateHash(singingPitchSource);
  return SingingPitchKey(hash);
};

export const calculateSingingVolumeKey = async (
  singingVolumeSource: SingingVolumeSource,
) => {
  const hash = await calculateHash(singingVolumeSource);
  return SingingVolumeKey(hash);
};

export const calculateSingingVoiceKey = async (
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
 * フレーズごとのノーツからフレーズを生成する。
 */
const createPhrasesFromNotes = async (
  phraseNotesList: Note[][],
  trackId: TrackId,
  snapshot: SnapshotForPhraseRender,
  firstRestMinDurationSeconds: number,
) => {
  const phrases = new Map<PhraseKey, Phrase>();

  for (let i = 0; i < phraseNotesList.length; i++) {
    const phraseNotes = phraseNotesList[i];
    const phraseFirstNote = phraseNotes[0];
    const prevPhraseNotes = getPrev(phraseNotesList, i);
    const prevPhraseLastNote = prevPhraseNotes?.at(-1);

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
    phrases.set(phraseKey, {
      firstRestDuration: phraseFirstRestDuration,
      notes: phraseNotes,
      startTime: phraseStartTime,
      state: "WAITING_TO_BE_RENDERED",
      trackId,
    });
  }

  return phrases;
};

/**
 * 各トラックのノーツからフレーズを生成する。
 * 重なっているノートはフレーズには含まれない。
 */
export const generatePhrases = async (
  snapshot: SnapshotForPhraseRender,
  firstRestMinDurationSeconds: number,
) => {
  const phrases = new Map<PhraseKey, Phrase>();

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
      firstRestMinDurationSeconds,
    );

    // 結果をマージ
    for (const [key, phrase] of trackPhrases) {
      phrases.set(key, phrase);
    }
  }

  return phrases;
};

export const generateQuerySource = (
  phrase: Phrase,
  snapshot: SnapshotForPhraseRender,
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
  };
};

export const generateSingingPitchSource = (
  query: EditorFrameAudioQuery,
  phrase: Phrase,
  snapshot: SnapshotForPhraseRender,
): SingingPitchSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.queryKey == undefined) {
    throw new Error("phrase.queryKey is undefined.");
  }

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

export const generateSingingVolumeSource = (
  query: EditorFrameAudioQuery,
  singingPitch: SingingPitch,
  phrase: Phrase,
  snapshot: SnapshotForPhraseRender,
): SingingVolumeSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.queryKey == undefined) {
    throw new Error("phrase.queryKey is undefined.");
  }
  if (phrase.singingPitchKey == undefined) {
    throw new Error("phrase.singingPitchKey is undefined.");
  }

  const clonedQuery = cloneWithUnwrapProxy(query);
  const clonedSingingPitch = cloneWithUnwrapProxy(singingPitch);

  clonedQuery.f0 = clonedSingingPitch;

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

export const generateSingingVoiceSource = (
  query: EditorFrameAudioQuery,
  singingPitch: SingingPitch,
  singingVolume: SingingVolume,
  phrase: Phrase,
  snapshot: SnapshotForPhraseRender,
): SingingVoiceSource => {
  const track = getOrThrow(snapshot.tracks, phrase.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  if (phrase.queryKey == undefined) {
    throw new Error("phrase.queryKey is undefined.");
  }
  if (phrase.singingPitchKey == undefined) {
    throw new Error("phrase.singingPitchKey is undefined.");
  }
  if (phrase.singingVolumeKey == undefined) {
    throw new Error("phrase.singingVolumeKey is undefined.");
  }

  const clonedQuery = cloneWithUnwrapProxy(query);
  const clonedSingingPitch = cloneWithUnwrapProxy(singingPitch);
  const clonedSingingVolume = cloneWithUnwrapProxy(singingVolume);

  clonedQuery.f0 = clonedSingingPitch;
  clonedQuery.volume = clonedSingingVolume;

  applyPitchEdit(
    clonedQuery,
    phrase.startTime,
    track.pitchEditData,
    snapshot.editorFrameRate,
  );

  return {
    singer: track.singer,
    queryForSingingVoiceSynthesis: clonedQuery,
  };
};
