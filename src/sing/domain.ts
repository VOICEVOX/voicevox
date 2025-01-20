import { calculateHash, getLast, getNext, getPrev, isSorted } from "./utility";
import { convertLongVowel, moraPattern } from "@/domain/japanese";
import {
  Note,
  Phrase,
  PhraseSource,
  Tempo,
  TimeSignature,
  PhraseKey,
  Track,
  EditorFrameAudioQuery,
} from "@/store/type";
import { FramePhoneme } from "@/openapi";
import { NoteId, TrackId } from "@/type/preload";

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

export function getNumMeasures(
  notes: Note[],
  tempos: Tempo[],
  timeSignatures: TimeSignature[],
  tpqn: number,
) {
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  let maxTicks = 0;
  const lastTsPosition = tsPositions[tsPositions.length - 1];
  const lastTempoPosition = tempos[tempos.length - 1].position;
  maxTicks = Math.max(maxTicks, lastTsPosition);
  maxTicks = Math.max(maxTicks, lastTempoPosition);
  if (notes.length > 0) {
    const noteEndPositions = notes.map((note) => note.position + note.duration);
    const lastNoteEndPosition = Math.max(...noteEndPositions);
    maxTicks = Math.max(maxTicks, lastNoteEndPosition);
  }
  return tickToMeasureNumber(maxTicks, timeSignatures, tpqn);
}

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
export const SEQUENCER_MIN_NUM_MEASURES = 32;

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

export function toSortedPhrases<K extends string>(phrases: Map<K, Phrase>) {
  return [...phrases.entries()].sort((a, b) => {
    const startTicksOfPhraseA = getStartTicksOfPhrase(a[1]);
    const startTicksOfPhraseB = getStartTicksOfPhrase(b[1]);
    return startTicksOfPhraseA - startTicksOfPhraseB;
  });
}

/**
 * 次にレンダリングするべきPhraseを探す。
 * phrasesが空の場合はエラー
 * 優先順：
 * - 再生位置が含まれるPhrase
 * - 再生位置より後のPhrase
 * - 再生位置より前のPhrase
 */
export function selectPriorPhrase<K extends string>(
  phrases: Map<K, Phrase>,
  position: number,
): [K, Phrase] {
  if (phrases.size === 0) {
    throw new Error("Received empty phrases");
  }
  // 再生位置が含まれるPhrase
  for (const [phraseKey, phrase] of phrases) {
    if (
      getStartTicksOfPhrase(phrase) <= position &&
      position <= getEndTicksOfPhrase(phrase)
    ) {
      return [phraseKey, phrase];
    }
  }

  const sortedPhrases = toSortedPhrases(phrases);
  // 再生位置より後のPhrase
  for (const [phraseKey, phrase] of sortedPhrases) {
    if (getStartTicksOfPhrase(phrase) > position) {
      return [phraseKey, phrase];
    }
  }

  // 再生位置より前のPhrase
  return sortedPhrases[0];
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

type PhonemeTiming = {
  noteId: NoteId | undefined;
  startFrame: number;
  endFrame: number;
  phoneme: string;
};

export type PhonemeTimingEdit = {
  phonemeIndexInNote: number;
  offsetSeconds: number;
};

export type PhonemeTimingEditData = Map<NoteId, PhonemeTimingEdit[]>;

/**
 * 音素列を音素タイミング列に変換する。
 */
export function phonemesToPhonemeTimings(phonemes: FramePhoneme[]) {
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
export function phonemeTimingsToPhonemes(phonemeTimings: PhonemeTiming[]) {
  return phonemeTimings.map(
    (value): FramePhoneme => ({
      phoneme: value.phoneme,
      frameLength: value.endFrame - value.startFrame,
      noteId: value.noteId,
    }),
  );
}

/**
 * フレーズごとの音素列を全体の音素タイミング列に変換する。
 */
export function toEntirePhonemeTimings(
  phrasePhonemeSequences: FramePhoneme[][],
  phraseStartFrames: number[],
) {
  // 音素列を繋げて一つの音素タイミング列にする
  const flattenedPhonemeTimings = phrasePhonemeSequences.flatMap(
    (phonemes, index) => {
      const phonemeTimings = phonemesToPhonemeTimings(phonemes);
      for (const phonemeTiming of phonemeTimings) {
        phonemeTiming.startFrame += phraseStartFrames[index];
        phonemeTiming.endFrame += phraseStartFrames[index];
      }
      return phonemeTimings;
    },
  );

  // 連続するpauseを1つにまとめる
  const entirePhonemeTimings: PhonemeTiming[] = [];
  let pauseTiming: PhonemeTiming | null = null;
  for (const phonemeTiming of flattenedPhonemeTimings) {
    if (phonemeTiming.phoneme === "pau") {
      if (pauseTiming == null) {
        pauseTiming = { ...phonemeTiming };
      } else {
        pauseTiming.endFrame = phonemeTiming.endFrame;
      }
    } else {
      if (pauseTiming != null) {
        entirePhonemeTimings.push(pauseTiming);
        pauseTiming = null;
      }
      entirePhonemeTimings.push(phonemeTiming);
    }
  }
  if (pauseTiming != null) {
    entirePhonemeTimings.push(pauseTiming);
  }

  return entirePhonemeTimings;
}

/**
 * 全体の音素タイミング列をフレーズごとの音素列に変換する。
 */
function toPhrasePhonemeSequences(
  entirePhonemeTimings: PhonemeTiming[],
  phraseStartFrames: number[],
  phraseEndFrames: number[],
) {
  // 音素タイミング列をpauseで分割する
  const phrasePhonemeTimingSequences: PhonemeTiming[][] = [];
  for (let i = 0; i < entirePhonemeTimings.length; i++) {
    const phonemeTiming = entirePhonemeTimings[i];
    const prevPhonemeTiming = getPrev(entirePhonemeTimings, i);

    if (phonemeTiming.phoneme === "pau") {
      continue;
    }
    if (prevPhonemeTiming == undefined || prevPhonemeTiming.phoneme === "pau") {
      phrasePhonemeTimingSequences.push([]);
    }
    getLast(phrasePhonemeTimingSequences).push(phonemeTiming);
  }

  // フレーズの音素タイミング列の前後にpauseを追加する
  for (let i = 0; i < phrasePhonemeTimingSequences.length; i++) {
    const phrasePhonemeTimings = phrasePhonemeTimingSequences[i];
    const phraseStartFrame = phraseStartFrames[i];
    const phraseEndFrame = phraseEndFrames[i];

    const firstPauseTiming: PhonemeTiming = {
      noteId: undefined,
      startFrame: phraseStartFrame,
      endFrame: phrasePhonemeTimings[0].startFrame,
      phoneme: "pau",
    };
    const lastPauseTiming: PhonemeTiming = {
      noteId: undefined,
      startFrame: getLast(phrasePhonemeTimings).endFrame,
      endFrame: phraseEndFrame,
      phoneme: "pau",
    };

    phrasePhonemeTimings.unshift(firstPauseTiming);
    phrasePhonemeTimings.push(lastPauseTiming);
  }

  // フレーム長が1未満の音素がないかチェックする
  for (const phonemeTimings of phrasePhonemeTimingSequences) {
    for (const phonemeTiming of phonemeTimings) {
      const phonemeFrameLength =
        phonemeTiming.endFrame - phonemeTiming.startFrame;
      if (phonemeFrameLength < 1) {
        throw new Error("The phoneme frame length is less than 1.");
      }
    }
  }

  // 音素タイミング列を音素列に変換する
  const phrasePhonemeSequences: FramePhoneme[][] = [];
  for (let i = 0; i < phrasePhonemeTimingSequences.length; i++) {
    const phraseStartFrame = phraseStartFrames[i];
    const phonemeTimings = phrasePhonemeTimingSequences[i];

    for (const phonemeTiming of phonemeTimings) {
      phonemeTiming.startFrame -= phraseStartFrame;
      phonemeTiming.endFrame -= phraseStartFrame;
    }
    const phonemes = phonemeTimingsToPhonemes(phonemeTimings);
    phrasePhonemeSequences.push(phonemes);
  }

  return phrasePhonemeSequences;
}

/**
 * 音素タイミング列に音素タイミング編集を適用する。
 */
function applyPhonemeTimingEditToPhonemeTimings(
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
        const offsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );
        const roundedOffsetFrame = Math.round(offsetFrame);

        phonemeTiming.startFrame += roundedOffsetFrame;
        if (prevPhonemeTiming != undefined) {
          prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
        }
      } else if (
        phonemeTimingEdit.phonemeIndexInNote === phonemeIndexInNote + 1 &&
        nextPhonemeTiming?.phoneme === "pau"
      ) {
        // NOTE: フレーズ末尾のpauseはフレーズ最後のノートに含まれるものとして扱う
        const offsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );
        const roundedOffsetFrame = Math.round(offsetFrame);

        phonemeTiming.endFrame += roundedOffsetFrame;
        nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
      }
    }
  }
}

/**
 * 音素が重ならないように音素タイミングとフレーズの終了フレームを調整する。
 */
export function adjustPhonemeTimingsAndPhraseEndFrames(
  phonemeTimings: PhonemeTiming[],
  phraseStartFrames: number[],
  phraseEndFrames: number[],
) {
  // フレーズの最初の（pauseではない）音素の開始フレームがフレーズの開始フレーム+1以上になるように
  // 開始フレームの最小値を算出する
  const minStartFrames = new Map<number, number>();
  let phraseIndex = 0;
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);

    if (phonemeTiming.phoneme === "pau") {
      continue;
    }
    if (prevPhonemeTiming == undefined || prevPhonemeTiming.phoneme === "pau") {
      const phraseStartFrame = phraseStartFrames.at(phraseIndex);
      if (phraseStartFrame == undefined) {
        throw new Error("phraseStartFrame is undefined.");
      }
      minStartFrames.set(i, phraseStartFrame + 1);
      phraseIndex++;
    }
  }

  // 各音素のフレーム長が1以上になるように後方から調整する（音素タイミングを変更）
  // 最小の開始フレームがある場合はそちらを優先する（フレーム長を1以上にしない）
  // 最後の音素は開始フレームではなく終了フレームの方を変更する
  for (let i = phonemeTimings.length - 1; i >= 0; i--) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);
    const minStartFrame = minStartFrames.get(i);

    if (i === phonemeTimings.length - 1) {
      // NOTE: 最後の音素は終了フレームの方を変更する
      if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
        phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
      }
    } else {
      if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
        phonemeTiming.startFrame = phonemeTiming.endFrame - 1;
      }
      if (
        minStartFrame != undefined &&
        phonemeTiming.startFrame < minStartFrame
      ) {
        // NOTE: 最小開始フレームを優先する（フレーム長は下のループで1以上にする）
        phonemeTiming.startFrame = minStartFrame;
      }
      if (prevPhonemeTiming != undefined) {
        prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
      }
    }
  }

  // 各音素のフレーム長が1以上になるように前方から調整する（音素タイミングを変更）
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
      phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
    }
    if (nextPhonemeTiming != undefined) {
      nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
    }
  }

  // フレーズ末尾のpauseのフレーム長が1以上になるように調整する（フレーズの終了フレームを変更）
  phraseIndex = 0;
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    if (phonemeTiming.phoneme === "pau") {
      continue;
    }
    if (nextPhonemeTiming == undefined || nextPhonemeTiming.phoneme === "pau") {
      const phraseEndFrame = phraseEndFrames.at(phraseIndex);
      if (phraseEndFrame == undefined) {
        throw new Error("phraseEndFrame is undefined.");
      }
      if (phonemeTiming.endFrame >= phraseEndFrame) {
        phraseEndFrames[phraseIndex] = phonemeTiming.endFrame + 1;
      }
      phraseIndex++;
    }
  }
}

/**
 * フレーズの開始フレームを算出する。
 * 開始フレームは整数。
 */
export function calcPhraseStartFrames(
  phraseStartTimes: number[],
  frameRate: number,
) {
  return phraseStartTimes.map((value) =>
    secondToRoundedFrame(value, frameRate),
  );
}

/**
 * フレーズの終了フレームを算出する。
 * 終了フレームは整数。
 */
export function calcPhraseEndFrames(
  phraseStartFrames: number[],
  phraseQueries: EditorFrameAudioQuery[],
) {
  const phraseEndFrames: number[] = [];
  for (let i = 0; i < phraseStartFrames.length; i++) {
    const phraseStartFrame = phraseStartFrames[i];
    const phraseQuery = phraseQueries[i];

    let cumulativeFrame = 0;
    for (const phoneme of phraseQuery.phonemes) {
      cumulativeFrame += phoneme.frameLength;
    }
    phraseEndFrames.push(phraseStartFrame + cumulativeFrame);
  }
  return phraseEndFrames;
}

/**
 * クエリに音素タイミング編集を適用する。
 * 音素タイミングの調整も行う。
 */
export function applyPhonemeTimingEditAndAdjust(
  phraseStartTimes: number[],
  phraseQueries: EditorFrameAudioQuery[],
  phonemeTimingEditData: PhonemeTimingEditData,
  frameRate: number,
) {
  if (!isSorted(phraseStartTimes, (a, b) => a - b)) {
    throw new Error("phraseStartTimes is not sorted.");
  }
  if (phraseStartTimes.length !== phraseQueries.length) {
    throw new Error(
      "phraseStartTimes.length and phraseQueries.length are not equal.",
    );
  }
  for (const phraseQuery of phraseQueries) {
    // フレーズのクエリのフレームレートとエディターのフレームレートが一致しない場合はエラー
    // TODO: 補間するようにする
    if (phraseQuery.frameRate != frameRate) {
      throw new Error(
        "The frame rate between the phrase query and the editor does not match.",
      );
    }
  }

  const phraseStartFrames = calcPhraseStartFrames(phraseStartTimes, frameRate);
  const phraseEndFrames = calcPhraseEndFrames(phraseStartFrames, phraseQueries);

  const phrasePhonemeSequences = phraseQueries.map((query) => {
    return query.phonemes;
  });
  const entirePhonemeTimings = toEntirePhonemeTimings(
    phrasePhonemeSequences,
    phraseStartFrames,
  );

  applyPhonemeTimingEditToPhonemeTimings(
    entirePhonemeTimings,
    phonemeTimingEditData,
    frameRate,
  );
  adjustPhonemeTimingsAndPhraseEndFrames(
    entirePhonemeTimings,
    phraseStartFrames,
    phraseEndFrames,
  );

  const modifiedPhrasePhonemeSequences = toPhrasePhonemeSequences(
    entirePhonemeTimings,
    phraseStartFrames,
    phraseEndFrames,
  );
  for (let i = 0; i < phraseQueries.length; i++) {
    const phraseQuery = phraseQueries[i];
    const phrasePhonemes = modifiedPhrasePhonemeSequences[i];
    phraseQuery.phonemes = phrasePhonemes;
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

/**
 * 指定されたティックを直近のグリッドに合わせる
 */
export function snapTicksToGrid(ticks: number, snapTicks: number): number {
  return Math.round(ticks / snapTicks) * snapTicks;
}

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
    // 負の値は許容しない
    startTick >= 0 &&
    endTick >= 0 &&
    // 整数である必要がある
    Number.isInteger(startTick) &&
    Number.isInteger(endTick)
  );
};
