import { calculateHash, getNext, getPrev } from "./utility";
import { convertLongVowel, moraPattern } from "@/domain/japanese";
import {
  Phrase,
  PhraseSource,
  PhraseKey,
  EditorFrameAudioQuery,
} from "@/store/type";
import { FramePhoneme } from "@/openapi";
import { NoteId, TrackId } from "@/type/preload";
import type {
  Note,
  PhonemeTimingEditData,
  Tempo,
  TimeSignature,
  Track,
} from "@/domain/project/type";

// TODO: 後でdomain/type.tsに移す
export type MeasuresBeats = {
  measures: number;
  beats: number;
};

export const BEAT_TYPES = [2, 4, 8, 16, 32];
const MIN_BPM = 40;
const MAX_SNAP_TYPE = 32;

export const isTracksEmpty = (tracks: Track[]) =>
  tracks.length === 0 || (tracks.length === 1 && tracks[0].notes.length === 0);

export const isValidTpqn = (tpqn: number) => {
  return (
    Number.isInteger(tpqn) &&
    BEAT_TYPES.every((value) => (tpqn * 4) % value === 0) &&
    tpqn % 3 === 0
  );
};

export const isValidBpm = (bpm: number) => {
  return Number.isFinite(bpm) && bpm >= MIN_BPM;
};

export const isValidTempo = (tempo: Tempo) => {
  return (
    Number.isInteger(tempo.position) &&
    tempo.position >= 0 &&
    isValidBpm(tempo.bpm)
  );
};

export const isValidBeats = (beats: number) => {
  return Number.isInteger(beats) && beats >= 1;
};

export const isValidBeatType = (beatType: number) => {
  return Number.isInteger(beatType) && BEAT_TYPES.includes(beatType);
};

export const isValidTimeSignature = (timeSignature: TimeSignature) => {
  return (
    Number.isInteger(timeSignature.measureNumber) &&
    timeSignature.measureNumber >= 1 &&
    isValidBeats(timeSignature.beats) &&
    isValidBeatType(timeSignature.beatType)
  );
};

export const isValidNote = (note: Note) => {
  return (
    Number.isInteger(note.position) &&
    Number.isInteger(note.duration) &&
    Number.isInteger(note.noteNumber) &&
    note.position >= 0 &&
    note.duration >= 1 &&
    note.noteNumber >= 0 &&
    note.noteNumber <= 127
  );
};

export const isValidTempos = (tempos: Tempo[]) => {
  return (
    tempos.length >= 1 &&
    tempos[0].position === 0 &&
    tempos.every((value) => isValidTempo(value))
  );
};

export const isValidTimeSignatures = (timeSignatures: TimeSignature[]) => {
  return (
    timeSignatures.length >= 1 &&
    timeSignatures[0].measureNumber === 1 &&
    timeSignatures.every((value) => isValidTimeSignature(value))
  );
};

export const isValidNotes = (notes: Note[]) => {
  return notes.every((value) => isValidNote(value));
};

export const isValidTrack = (track: Track) => {
  return (
    isValidKeyRangeAdjustment(track.keyRangeAdjustment) &&
    isValidVolumeRangeAdjustment(track.volumeRangeAdjustment) &&
    isValidNotes(track.notes)
  );
};

const tickToSecondForConstantBpm = (
  ticks: number,
  bpm: number,
  tpqn: number,
) => {
  const quarterNotesPerMinute = bpm;
  const quarterNotesPerSecond = quarterNotesPerMinute / 60;
  return ticks / tpqn / quarterNotesPerSecond;
};

const secondToTickForConstantBpm = (
  seconds: number,
  bpm: number,
  tpqn: number,
) => {
  const quarterNotesPerMinute = bpm;
  const quarterNotesPerSecond = quarterNotesPerMinute / 60;
  return seconds * quarterNotesPerSecond * tpqn;
};

export const tickToSecond = (ticks: number, tempos: Tempo[], tpqn: number) => {
  let timeOfTempo = 0;
  let tempo = tempos[tempos.length - 1];
  for (let i = 0; i < tempos.length; i++) {
    if (i === tempos.length - 1) {
      break;
    }
    if (tempos[i + 1].position > ticks) {
      tempo = tempos[i];
      break;
    }
    timeOfTempo += tickToSecondForConstantBpm(
      tempos[i + 1].position - tempos[i].position,
      tempos[i].bpm,
      tpqn,
    );
  }
  return (
    timeOfTempo +
    tickToSecondForConstantBpm(ticks - tempo.position, tempo.bpm, tpqn)
  );
};

export const secondToTick = (
  seconds: number,
  tempos: Tempo[],
  tpqn: number,
) => {
  let timeOfTempo = 0;
  let tempo = tempos[tempos.length - 1];
  for (let i = 0; i < tempos.length; i++) {
    if (i === tempos.length - 1) {
      break;
    }
    const timeOfNextTempo =
      timeOfTempo +
      tickToSecondForConstantBpm(
        tempos[i + 1].position - tempos[i].position,
        tempos[i].bpm,
        tpqn,
      );
    if (timeOfNextTempo > seconds) {
      tempo = tempos[i];
      break;
    }
    timeOfTempo = timeOfNextTempo;
  }
  return (
    tempo.position +
    secondToTickForConstantBpm(seconds - timeOfTempo, tempo.bpm, tpqn)
  );
};

// NOTE: 戻り値の単位はtick
export function getTimeSignaturePositions(
  timeSignatures: TimeSignature[],
  tpqn: number,
) {
  const tsPositions: number[] = [0];
  for (let i = 0; i < timeSignatures.length - 1; i++) {
    const ts = timeSignatures[i];
    const tsPosition = tsPositions[i];
    const nextTs = timeSignatures[i + 1];
    const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
    const numMeasures = nextTs.measureNumber - ts.measureNumber;
    const nextTsPosition = tsPosition + measureDuration * numMeasures;
    tsPositions.push(nextTsPosition);
  }
  return tsPositions;
}

/**
 * tick位置に対応する小節番号（整数）を計算する。
 */
export function tickToMeasureNumber(
  ticks: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
) {
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  const nextTsIndex = tsPositions.findIndex((value) => ticks < value);
  const lastTsIndex = tsPositions.length - 1;
  const tsIndex = nextTsIndex !== -1 ? nextTsIndex - 1 : lastTsIndex;
  const ts = timeSignatures[tsIndex];
  const tsPosition = tsPositions[tsIndex];
  const ticksWithinTs = ticks - tsPosition;
  const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
  return ts.measureNumber + Math.floor(ticksWithinTs / measureDuration);
}

/**
 * 小節番号に対応するtick位置（小節の開始位置）を計算する。
 */
export function measureNumberToTick(
  measureNumber: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
) {
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  const tsIndex = timeSignatures.findLastIndex((value) => {
    return measureNumber >= value.measureNumber;
  });
  const ts = timeSignatures[tsIndex];
  const tsPosition = tsPositions[tsIndex];
  const measureOffset = measureNumber - ts.measureNumber;
  const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
  return tsPosition + measureOffset * measureDuration;
}

// NOTE: 戻り値の単位はtick
export function getMeasureDuration(
  beats: number,
  beatType: number,
  tpqn: number,
) {
  return ((tpqn * 4) / beatType) * beats;
}

// NOTE: 戻り値の単位はtick
export function getBeatDuration(beatType: number, tpqn: number) {
  return (tpqn * 4) / beatType;
}

export const ticksToMeasuresBeats = (
  ticks: number,
  timeSignatures: (TimeSignature & { position: number })[],
  tpqn: number,
): MeasuresBeats => {
  let tsIndex = 0;
  if (ticks >= 0) {
    for (let i = 0; i < timeSignatures.length; i++) {
      if (
        i === timeSignatures.length - 1 ||
        timeSignatures[i + 1].position > ticks
      ) {
        tsIndex = i;
        break;
      }
    }
  }
  const ts = timeSignatures[tsIndex];

  const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
  const beatDuration = getBeatDuration(ts.beatType, tpqn);

  const posInTs = ticks - ts.position;
  const measuresInTs = Math.floor(posInTs / measureDuration);
  const measures = ts.measureNumber + measuresInTs;

  const posInMeasure = posInTs - measureDuration * measuresInTs;
  const beats = 1 + posInMeasure / beatDuration;

  return { measures, beats };
};

// NOTE: 戻り値の単位はtick
export function getNoteDuration(noteType: number, tpqn: number) {
  return (tpqn * 4) / noteType;
}

export function getRepresentableNoteTypes(tpqn: number) {
  const maxNoteType = 128;
  const wholeNoteDuration = tpqn * 4;
  const noteTypes = [1];
  for (let noteType = 2; noteType <= maxNoteType; noteType *= 2) {
    if (wholeNoteDuration % noteType !== 0) {
      break;
    }
    noteTypes.push(noteType);
  }
  for (let noteType = 3; noteType <= maxNoteType; noteType *= 2) {
    if (wholeNoteDuration % noteType !== 0) {
      break;
    }
    noteTypes.push(noteType);
  }
  return noteTypes;
}

export function isTriplet(noteType: number) {
  return noteType % 3 === 0;
}

export function noteNumberToFrequency(noteNumber: number) {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

export function frequencyToNoteNumber(frequency: number) {
  return 69 + Math.log2(frequency / 440) * 12;
}

export function linearToDecibel(linearValue: number) {
  if (linearValue === 0) {
    return -1000;
  }
  return 20 * Math.log10(linearValue);
}

export function decibelToLinear(decibelValue: number) {
  if (decibelValue <= -1000) {
    return 0;
  }
  return Math.pow(10, decibelValue / 20);
}

export const DEFAULT_TRACK_NAME = "無名トラック";

export const DEFAULT_TPQN = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_BEATS = 4;
export const DEFAULT_BEAT_TYPE = 4;

// マルチエンジン対応のために将来的に廃止予定で、利用は非推奨
export const DEPRECATED_DEFAULT_EDITOR_FRAME_RATE = 93.75;

export const VALUE_INDICATING_NO_DATA = -1;

export const VOWELS = ["N", "a", "e", "i", "o", "u", "A", "E", "I", "O", "U"];

export const UNVOICED_PHONEMES = [
  "pau",
  "cl",
  "ch",
  "f",
  "h",
  "k",
  "p",
  "s",
  "sh",
  "t",
  "ts",
];

export function isVowel(phoneme: string) {
  return VOWELS.includes(phoneme);
}

export function createDefaultTempo(position: number): Tempo {
  return { position, bpm: DEFAULT_BPM };
}

export function createDefaultTimeSignature(
  measureNumber: number,
): TimeSignature {
  return {
    measureNumber,
    beats: DEFAULT_BEATS,
    beatType: DEFAULT_BEAT_TYPE,
  };
}

export function createDefaultTrack(): Track {
  return {
    name: DEFAULT_TRACK_NAME,
    singer: undefined,
    keyRangeAdjustment: 0,
    volumeRangeAdjustment: 0,
    notes: [],
    pitchEditData: [],
    volumeEditData: [],
    phonemeTimingEditData: new Map(),

    solo: false,
    mute: false,
    gain: 1,
    pan: 0,
  };
}

export function getSnapTypes(tpqn: number) {
  return getRepresentableNoteTypes(tpqn).filter((value) => {
    return value <= MAX_SNAP_TYPE;
  });
}

export function isValidSnapType(snapType: number, tpqn: number) {
  return getSnapTypes(tpqn).some((value) => value === snapType);
}

export function isValidKeyRangeAdjustment(keyRangeAdjustment: number) {
  return (
    Number.isInteger(keyRangeAdjustment) &&
    keyRangeAdjustment <= 28 &&
    keyRangeAdjustment >= -28
  );
}

export function isValidVolumeRangeAdjustment(volumeRangeAdjustment: number) {
  return (
    Number.isInteger(volumeRangeAdjustment) &&
    volumeRangeAdjustment <= 20 &&
    volumeRangeAdjustment >= -20
  );
}

export function isValidPitchEditData(pitchEditData: number[]) {
  return pitchEditData.every(
    (value) =>
      Number.isFinite(value) &&
      (value > 0 || value === VALUE_INDICATING_NO_DATA),
  );
}

export function isValidVolumeEditData(volumeEditData: number[]) {
  // NOTE: APIの返却が0未満になる場合があるため、0以上かどうかのみ検証する
  return volumeEditData.every(
    (value) =>
      Number.isFinite(value) &&
      (value >= 0 || value === VALUE_INDICATING_NO_DATA),
  );
}

export const calculatePhraseKey = async (phraseSource: PhraseSource) => {
  const hash = await calculateHash(phraseSource);
  return PhraseKey(hash);
};

export function getStartTicksOfPhrase(phrase: Phrase) {
  if (phrase.notes.length === 0) {
    throw new Error("phrase.notes.length is 0.");
  }
  return phrase.notes[0].position;
}

export function getEndTicksOfPhrase(phrase: Phrase) {
  if (phrase.notes.length === 0) {
    throw new Error("phrase.notes.length is 0.");
  }
  const lastNote = phrase.notes[phrase.notes.length - 1];
  return lastNote.position + lastNote.duration;
}

export type PhraseRange = {
  startTicks: number;
  endTicks: number;
};

export function toSortedPhraseRanges<K extends string>(
  phraseRanges: Map<K, PhraseRange>,
) {
  return [...phraseRanges.entries()].sort((a, b) => {
    return a[1].startTicks - b[1].startTicks;
  });
}

/**
 * 次にレンダリングするべきPhraseを探す。
 * phraseRangesが空の場合はエラー
 * 優先順：
 * - 再生位置が含まれるPhrase
 * - 再生位置より後のPhrase
 * - 再生位置より前のPhrase
 */
export function selectPriorPhrase<K extends string>(
  phraseRanges: Map<K, PhraseRange>,
  playheadPosition: number,
): K {
  if (phraseRanges.size === 0) {
    throw new Error("phraseRanges.size is 0.");
  }
  // 再生位置が含まれるPhrase
  for (const [phraseKey, phraseRange] of phraseRanges) {
    if (
      phraseRange.startTicks <= playheadPosition &&
      playheadPosition <= phraseRange.endTicks
    ) {
      return phraseKey;
    }
  }

  const sortedPhraseRanges = toSortedPhraseRanges(phraseRanges);
  // 再生位置より後のPhrase
  for (const [phraseKey, phraseRange] of sortedPhraseRanges) {
    if (phraseRange.startTicks > playheadPosition) {
      return phraseKey;
    }
  }

  // 再生位置より前のPhrase
  return sortedPhraseRanges[0][0];
}

export function convertToFramePhonemes(phonemes: FramePhoneme[]) {
  const framePhonemes: string[] = [];
  for (const phoneme of phonemes) {
    for (let i = 0; i < phoneme.frameLength; i++) {
      framePhonemes.push(phoneme.phoneme);
    }
  }
  return framePhonemes;
}

function secondToRoundedFrame(seconds: number, frameRate: number) {
  return Math.round(seconds * frameRate);
}

export type PhonemeTiming = {
  noteId: NoteId | undefined;
  startFrame: number;
  endFrame: number;
  phoneme: string;
};

/**
 * 音素列を音素タイミング列に変換する。
 */
export function toPhonemeTimings(phonemes: FramePhoneme[]) {
  const phonemeTimings: PhonemeTiming[] = [];
  let cumulativeFrame = 0;
  for (const phoneme of phonemes) {
    phonemeTimings.push({
      noteId: phoneme.noteId != undefined ? NoteId(phoneme.noteId) : undefined,
      startFrame: cumulativeFrame,
      endFrame: cumulativeFrame + phoneme.frameLength,
      phoneme: phoneme.phoneme,
    });
    cumulativeFrame += phoneme.frameLength;
  }
  return phonemeTimings;
}

/**
 * 音素タイミング列を音素列に変換する。
 */
export function toPhonemes(phonemeTimings: PhonemeTiming[]) {
  return phonemeTimings.map(
    (value): FramePhoneme => ({
      phoneme: value.phoneme,
      frameLength: value.endFrame - value.startFrame,
      noteId: value.noteId,
    }),
  );
}

/**
 * 音素タイミング列に音素タイミング編集を適用する。
 */
export function applyPhonemeTimingEdit(
  phonemeTimings: PhonemeTiming[],
  phonemeTimingEditData: PhonemeTimingEditData,
  frameRate: number,
) {
  let phonemeIndexInNote = 0;
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    if (
      prevPhonemeTiming == undefined ||
      phonemeTiming.noteId !== prevPhonemeTiming.noteId
    ) {
      phonemeIndexInNote = 0;
    } else {
      phonemeIndexInNote++;
    }

    if (phonemeTiming.phoneme === "pau") {
      continue;
    }
    if (phonemeTiming.noteId == undefined) {
      throw new Error("phonemeTiming.noteId is undefined.");
    }
    const phonemeTimingEdits = phonemeTimingEditData.get(phonemeTiming.noteId);
    if (phonemeTimingEdits == undefined) {
      continue;
    }
    for (const phonemeTimingEdit of phonemeTimingEdits) {
      if (phonemeTimingEdit.phonemeIndexInNote === phonemeIndexInNote) {
        const roundedOffsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );

        phonemeTiming.startFrame += roundedOffsetFrame;
        if (prevPhonemeTiming != undefined) {
          prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
        }
      } else if (
        phonemeTimingEdit.phonemeIndexInNote === phonemeIndexInNote + 1 &&
        nextPhonemeTiming?.phoneme === "pau"
      ) {
        // NOTE: フレーズ末尾のpauseはフレーズ最後のノートに含まれるものとして扱う
        const roundedOffsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );

        phonemeTiming.endFrame += roundedOffsetFrame;
        nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
      }
    }
  }
}

/**
 * 音素タイミングを調整する。
 *
 * - 各音素の長さが1フレーム以上になるように調整。
 * - 先頭のpauの開始フレームを0に設定。
 * - pauではない区間の開始フレーム（先頭のpauの終了フレーム）が最小開始フレーム以上になるように調整。
 * - pauではない区間の終了フレーム（末尾のpauの開始フレーム）が最大終了フレーム以下になるように調整。
 *   （余裕がない場合は最大終了フレームを超えるので注意）
 *
 * @param phonemeTimings - 音素タイミング列（先頭・末尾がpau）
 * @param minNonPauseStartFrame - pauではない区間（子音・母音の区間）の最小開始フレーム（1以上）
 * @param maxNonPauseEndFrame - pauではない区間（子音・母音の区間）の最大終了フレーム
 */
export function adjustPhonemeTimings(
  phonemeTimings: PhonemeTiming[],
  minNonPauseStartFrame: number | undefined,
  maxNonPauseEndFrame: number | undefined,
) {
  // 末尾のpauのタイミングを調整し、
  // 各音素のフレーム長が1以上になるように後方から調整する
  for (let i = phonemeTimings.length - 1; i >= 0; i--) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);

    // 末尾のpauの場合
    if (i === phonemeTimings.length - 1) {
      // 開始フレームを制約内に収める
      // NOTE: 末尾のpauの開始フレーム＝pauではない区間の終了フレーム
      if (
        maxNonPauseEndFrame != undefined &&
        phonemeTiming.startFrame > maxNonPauseEndFrame
      ) {
        phonemeTiming.startFrame = maxNonPauseEndFrame;
      }
      // フレーム長が1以上になるように終了フレームを調整する
      if (phonemeTiming.endFrame <= phonemeTiming.startFrame) {
        phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
      }
    }

    // 音素（pauを含む）のフレーム長が1以上になるように開始フレームを調整する
    if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
      phonemeTiming.startFrame = phonemeTiming.endFrame - 1;
    }
    if (prevPhonemeTiming != undefined) {
      prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
    }
  }

  // 先頭のpauのタイミングを調整し、
  // 各音素のフレーム長が1以上になるように前方から調整する
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    // 先頭のpauの場合
    if (i === 0) {
      // 開始フレームを0に設定
      phonemeTiming.startFrame = 0;
      // 終了フレームを制限内に収める
      // NOTE: 先頭のpauの終了フレーム＝pauではない区間の開始フレーム
      if (
        minNonPauseStartFrame != undefined &&
        phonemeTiming.endFrame < minNonPauseStartFrame
      ) {
        phonemeTiming.endFrame = minNonPauseStartFrame;
      }
    }

    // 音素（pauを含む）のフレーム長が1以上になるように終了フレームを調整する
    if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
      phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
    }
    if (nextPhonemeTiming != undefined) {
      nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
    }
  }
}

export function applyPitchEdit(
  phraseQuery: EditorFrameAudioQuery,
  phraseStartTime: number,
  pitchEditData: number[],
  editorFrameRate: number,
) {
  // フレーズのクエリのフレームレートとエディターのフレームレートが一致しない場合はエラー
  // TODO: 補間するようにする
  if (phraseQuery.frameRate !== editorFrameRate) {
    throw new Error(
      "The frame rate between the phrase query and the editor does not match.",
    );
  }
  const unvoicedPhonemes = UNVOICED_PHONEMES;
  const f0 = phraseQuery.f0;
  const phonemes = phraseQuery.phonemes;

  // 各フレームの音素の配列を生成する
  const framePhonemes = convertToFramePhonemes(phonemes);
  if (f0.length !== framePhonemes.length) {
    throw new Error("f0.length and framePhonemes.length do not match.");
  }

  // フレーズのクエリの開始フレームと終了フレームを計算する
  const phraseQueryFrameLength = f0.length;
  const phraseQueryStartFrame = Math.round(
    phraseStartTime * phraseQuery.frameRate,
  );
  const phraseQueryEndFrame = phraseQueryStartFrame + phraseQueryFrameLength;

  // ピッチ編集をf0に適用する
  const startFrame = Math.max(0, phraseQueryStartFrame);
  const endFrame = Math.min(pitchEditData.length, phraseQueryEndFrame);
  for (let i = startFrame; i < endFrame; i++) {
    const phoneme = framePhonemes[i - phraseQueryStartFrame];
    const voiced = !unvoicedPhonemes.includes(phoneme);
    if (voiced && pitchEditData[i] !== VALUE_INDICATING_NO_DATA) {
      f0[i - phraseQueryStartFrame] = pitchEditData[i];
    }
  }
}

export function applyVolumeEdit(
  phraseQuery: EditorFrameAudioQuery,
  phraseStartTime: number,
  volumeEditData: number[],
  editorFrameRate: number,
) {
  if (phraseQuery.frameRate !== editorFrameRate) {
    throw new Error(
      "The frame rate between the phrase query and the editor does not match.",
    );
  }

  const volume = phraseQuery.volume;
  const phraseQueryFrameLength = volume.length;
  const phraseQueryStartFrame = Math.round(
    phraseStartTime * phraseQuery.frameRate,
  );
  const phraseQueryEndFrame = phraseQueryStartFrame + phraseQueryFrameLength;

  const startFrame = Math.max(0, phraseQueryStartFrame);
  const endFrame = Math.min(volumeEditData.length, phraseQueryEndFrame);
  for (let i = startFrame; i < endFrame; i++) {
    const editedVolume = volumeEditData[i];
    if (editedVolume === VALUE_INDICATING_NO_DATA) {
      continue;
    }
    // NOTE: ボリューム編集結果が負値になるケースに備えて0以上にクランプする
    volume[i - phraseQueryStartFrame] = Math.max(editedVolume, 0);
  }
}

/**
 * 文字列をモーラと非モーラに分割する。長音は展開される。連続する非モーラはまとめる。
 * 例："カナー漢字" -> ["カ", "ナ", "ア", "漢字"]
 *
 * @param text 分割する文字列
 * @param maxLength 最大の要素数
 * @returns 分割された文字列
 */
export const splitLyricsByMoras = (
  text: string,
  maxLength = Infinity,
): string[] => {
  const moraAndNonMoras: string[] = [];
  const matches = convertLongVowel(text).matchAll(moraPattern);
  let lastMatchEnd = 0;
  // aアbイウc で説明：
  for (const match of matches) {
    if (match.index == undefined) {
      throw new Error("match.index is undefined.");
    }
    // 直前のモーラとの間 = a、b、空文字列
    if (lastMatchEnd < match.index) {
      moraAndNonMoras.push(text.substring(lastMatchEnd, match.index));
    }
    // モーラ = ア、イ、ウ
    moraAndNonMoras.push(match[0]);
    lastMatchEnd = match.index + match[0].length;
  }
  // 最後のモーラから後 = cの部分
  if (lastMatchEnd < text.length) {
    moraAndNonMoras.push(text.substring(lastMatchEnd));
  }
  // 指定した最大要素数より多い場合は配列を削る
  if (moraAndNonMoras.length > maxLength) {
    moraAndNonMoras.splice(
      maxLength - 1,
      moraAndNonMoras.length,
      moraAndNonMoras.slice(maxLength - 1).join(""),
    );
  }
  return moraAndNonMoras;
};

/**
 * トラックのミュート・ソロ状態から再生すべきトラックを判定する。
 *
 * ソロのトラックが存在する場合は、ソロのトラックのみ再生する。（ミュートは無視される）
 * ソロのトラックが存在しない場合は、ミュートされていないトラックを再生する。
 */
export const shouldPlayTracks = (tracks: Map<TrackId, Track>): Set<TrackId> => {
  const soloTrackExists = [...tracks.values()].some((track) => track.solo);
  return new Set(
    [...tracks.entries()]
      .filter(([, track]) => (soloTrackExists ? track.solo : !track.mute))
      .map(([trackId]) => trackId),
  );
};

/*
 * ループ範囲が有効かどうかを判定する
 * @param startTick ループ開始位置(tick)
 * @param endTick ループ終了位置(tick)
 * @returns ループ範囲が有効な場合はtrue
 */
export const isValidLoopRange = (
  startTick: number,
  endTick: number,
): boolean => {
  return (
    startTick >= 0 &&
    endTick >= 0 &&
    Number.isInteger(startTick) &&
    Number.isInteger(endTick) &&
    startTick <= endTick // 範囲差0は許容する
  );
};
