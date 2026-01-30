import { Note, Tempo, TimeSignature } from "@/domain/project/type";

export type MeasuresBeats = {
  measures: number;
  beats: number;
};

export const BEAT_TYPES = [2, 4, 8, 16, 32];

const MIN_BPM = 40;

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
