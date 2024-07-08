import { calculateHash } from "./utility";
import { convertLongVowel } from "@/domain/japanese";
import {
  Note,
  Phrase,
  PhraseSource,
  PhraseSourceHash,
  SingingGuide,
  SingingGuideSource,
  SingingVoiceSource,
  Tempo,
  TimeSignature,
  phraseSourceHashSchema,
  Track,
  singingGuideSourceHashSchema,
  singingVoiceSourceHashSchema,
} from "@/store/type";
import { FramePhoneme } from "@/openapi";

const BEAT_TYPES = [2, 4, 8, 16];
const MIN_BPM = 40;
const MAX_SNAP_TYPE = 32;

export const isValidTpqn = (tpqn: number) => {
  return (
    Number.isInteger(tpqn) &&
    BEAT_TYPES.every((value) => tpqn % value === 0) &&
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
  const wholeNoteDuration = tpqn * 4;
  return (wholeNoteDuration / beatType) * beats;
}

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
    const lastNote = notes[notes.length - 1];
    const lastNoteEndPosition = lastNote.position + lastNote.duration;
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

export const DEFAULT_TPQN = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_BEATS = 4;
export const DEFAULT_BEAT_TYPE = 4;
export const SEQUENCER_MIN_NUM_MEASURES = 32;

// マルチエンジン対応のために将来的に廃止予定で、利用は非推奨
export const DEPRECATED_DEFAULT_EDIT_FRAME_RATE = 93.75;

export const VALUE_INDICATING_NO_DATA = -1;

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
    singer: undefined,
    keyRangeAdjustment: 0,
    volumeRangeAdjustment: 0,
    notes: [],
    pitchEditData: [],
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

export const calculatePhraseSourceHash = async (phraseSource: PhraseSource) => {
  const hash = await calculateHash(phraseSource);
  return phraseSourceHashSchema.parse(hash);
};

export const calculateSingingGuideSourceHash = async (
  singingGuideSource: SingingGuideSource,
) => {
  const hash = await calculateHash(singingGuideSource);
  return singingGuideSourceHashSchema.parse(hash);
};

export const calculateSingingVoiceSourceHash = async (
  singingVoiceSource: SingingVoiceSource,
) => {
  const hash = await calculateHash(singingVoiceSource);
  return singingVoiceSourceHashSchema.parse(hash);
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

export function toSortedPhrases(phrases: Map<PhraseSourceHash, Phrase>) {
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
export function selectPriorPhrase(
  phrases: Map<PhraseSourceHash, Phrase>,
  position: number,
): [PhraseSourceHash, Phrase] {
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

export function applyPitchEdit(
  singingGuide: SingingGuide,
  pitchEditData: number[],
  editFrameRate: number,
) {
  // 歌い方のフレームレートと編集フレームレートが一致しない場合はエラー
  // TODO: 補間するようにする
  if (singingGuide.frameRate !== editFrameRate) {
    throw new Error(
      "The frame rate between the singing guide and the edit data does not match.",
    );
  }
  const unvoicedPhonemes = UNVOICED_PHONEMES;
  const f0 = singingGuide.query.f0;
  const phonemes = singingGuide.query.phonemes;

  // 各フレームの音素の配列を生成する
  const framePhonemes = convertToFramePhonemes(phonemes);
  if (f0.length !== framePhonemes.length) {
    throw new Error("f0.length and framePhonemes.length do not match.");
  }

  // 歌い方の開始フレームと終了フレームを計算する
  const singingGuideFrameLength = f0.length;
  const singingGuideStartFrame = Math.round(
    singingGuide.startTime * singingGuide.frameRate,
  );
  const singingGuideEndFrame = singingGuideStartFrame + singingGuideFrameLength;

  // ピッチ編集をf0に適用する
  const startFrame = Math.max(0, singingGuideStartFrame);
  const endFrame = Math.min(pitchEditData.length, singingGuideEndFrame);
  for (let i = startFrame; i < endFrame; i++) {
    const phoneme = framePhonemes[i - singingGuideStartFrame];
    const voiced = !unvoicedPhonemes.includes(phoneme);
    if (voiced && pitchEditData[i] !== VALUE_INDICATING_NO_DATA) {
      f0[i - singingGuideStartFrame] = pitchEditData[i];
    }
  }
}

// 参考：https://github.com/VOICEVOX/voicevox_core/blob/0848630d81ae3e917c6ff2038f0b15bbd4270702/crates/voicevox_core/src/user_dict/word.rs#L83-L90
export const moraPattern = new RegExp(
  "(?:" +
    "[イ][ェ]|[ヴ][ャュョ]|[トド][ゥ]|[テデ][ィャュョ]|[デ][ェ]|[クグ][ヮ]|" + // rule_others
    "[キシチニヒミリギジビピ][ェャュョ]|" + // rule_line_i
    "[ツフヴ][ァ]|[ウスツフヴズ][ィ]|[ウツフヴ][ェォ]|" + // rule_line_u
    "[ァ-ヴー]|" + // rule_one_mora
    "[い][ぇ]|[ゃゅょ]|[とど][ぅ]|[てで][ぃゃゅょ]|[で][ぇ]|[くぐ][ゎ]|" + // rule_others
    "[きしちにひみりぎじびぴ][ぇゃゅょ]|" + // rule_line_i
    "[つふゔ][ぁ]|[うすつふゔず][ぃ]|[うつふゔ][ぇぉ]|" + // rule_line_u
    "[ぁ-ゔー]" + // rule_one_mora
    ")",
  "g",
);

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
