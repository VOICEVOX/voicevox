import { Note, Phrase, Score, Tempo, TimeSignature } from "@/store/type";

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

export const isValidScore = (score: Score) => {
  return (
    isValidTpqn(score.tpqn) &&
    isValidTempos(score.tempos) &&
    isValidTimeSignatures(score.timeSignatures) &&
    isValidNotes(score.notes)
  );
};

const tickToSecondForConstantBpm = (
  ticks: number,
  bpm: number,
  tpqn: number
) => {
  const quarterNotesPerMinute = bpm;
  const quarterNotesPerSecond = quarterNotesPerMinute / 60;
  return ticks / tpqn / quarterNotesPerSecond;
};

const secondToTickForConstantBpm = (
  seconds: number,
  bpm: number,
  tpqn: number
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
      tpqn
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
  tpqn: number
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
        tpqn
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
  tpqn: number
) {
  const tsPositions: number[] = [0];
  for (let i = 0; i < timeSignatures.length - 1; i++) {
    const ts = timeSignatures[i];
    const tsPosition = tsPositions[i];
    const nextTs = timeSignatures[i + 1];
    const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
    const numOfMeasures = nextTs.measureNumber - ts.measureNumber;
    const nextTsPosition = tsPosition + measureDuration * numOfMeasures;
    tsPositions.push(nextTsPosition);
  }
  return tsPositions;
}

export function tickToMeasureNumber(
  ticks: number,
  timeSignatures: TimeSignature[],
  tpqn: number
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
  tpqn: number
) {
  const wholeNoteDuration = tpqn * 4;
  return (wholeNoteDuration / beatType) * beats;
}

export function getNumOfMeasures(
  notes: Note[],
  tempos: Tempo[],
  timeSignatures: TimeSignature[],
  tpqn: number
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

export function isValidvolumeRangeAdjustment(volumeRangeAdjustment: number) {
  return (
    Number.isInteger(volumeRangeAdjustment) &&
    volumeRangeAdjustment <= 20 &&
    volumeRangeAdjustment >= -20
  );
}

export function toSortedPhrases(phrases: Map<string, Phrase>) {
  return [...phrases.entries()].sort((a, b) => {
    return a[1].startTicks - b[1].startTicks;
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
  phrases: Map<string, Phrase>,
  position: number
): [string, Phrase] {
  if (phrases.size === 0) {
    throw new Error("Received empty phrases");
  }
  // 再生位置が含まれるPhrase
  for (const [phraseKey, phrase] of phrases) {
    if (phrase.startTicks <= position && position <= phrase.endTicks) {
      return [phraseKey, phrase];
    }
  }

  const sortedPhrases = toSortedPhrases(phrases);
  // 再生位置より後のPhrase
  for (const [phraseKey, phrase] of sortedPhrases) {
    if (phrase.startTicks > position) {
      return [phraseKey, phrase];
    }
  }

  // 再生位置より前のPhrase
  return sortedPhrases[0];
}
