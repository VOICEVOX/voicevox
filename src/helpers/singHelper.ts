import { Note } from "@/store/type";

const BASE_X_PER_QUARTER_NOTE = 120;
const BASE_Y_PER_NOTE_NUMBER = 30;

export function noteNumberToFrequency(noteNumber: number) {
  return 440 * 2 ** ((noteNumber - 69) / 12);
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

// TODO: getNumOfMeasuresに変更する
export function getMeasureNum(notes: Note[], measureDuration: number) {
  if (notes.length === 0) {
    return 0;
  }
  const lastNote = notes[notes.length - 1];
  const maxTicks = lastNote.position + lastNote.duration;
  return Math.ceil(maxTicks / measureDuration);
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

export function getKeyBaseHeight() {
  return BASE_Y_PER_NOTE_NUMBER;
}

export function tickToBaseX(ticks: number, tpqn: number) {
  return (ticks / tpqn) * BASE_X_PER_QUARTER_NOTE;
}

export function baseXToTick(baseX: number, tpqn: number) {
  return (baseX / BASE_X_PER_QUARTER_NOTE) * tpqn;
}

// NOTE: ノート番号が整数のときに、そのノート番号のキーの中央の位置を返します
export function noteNumberToBaseY(noteNumber: number) {
  return (127.5 - noteNumber) * BASE_Y_PER_NOTE_NUMBER;
}

// NOTE: integerがfalseの場合は、ノート番号のキーの中央の位置が
//       ちょうどそのノート番号となるように計算します
export function baseYToNoteNumber(baseY: number, integer = true) {
  return integer
    ? 127 - Math.floor(baseY / BASE_Y_PER_NOTE_NUMBER)
    : 127.5 - baseY / BASE_Y_PER_NOTE_NUMBER;
}

export function getSnapTypes(tpqn: number) {
  const maxSnapType = 64;
  return getRepresentableNoteTypes(tpqn).filter((value) => {
    return value <= maxSnapType;
  });
}

export function isValidSnapType(snapType: number, tpqn: number) {
  return getSnapTypes(tpqn).some((value) => value === snapType);
}

export function getPitchFromNoteNumber(noteNumber: number) {
  const mapPitches = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const pitchPos = noteNumber % 12;
  return mapPitches[pitchPos];
}

export function getDoremiFromNoteNumber(noteNumber: number) {
  const mapPitches = [
    "ド",
    "ド",
    "レ",
    "レ",
    "ミ",
    "ファ",
    "ファ",
    "ソ",
    "ソ",
    "ラ",
    "ラ",
    "シ",
  ];
  const pitchPos = noteNumber % 12;
  return mapPitches[pitchPos];
}

export function getOctaveFromNoteNumber(noteNumber: number) {
  return Math.floor(noteNumber / 12) - 1;
}

export function getKeyColorFromNoteNumber(noteNumber: number) {
  const mapWhiteKeys = ["C", "D", "E", "F", "G", "A", "B"];
  const pitch = getPitchFromNoteNumber(noteNumber);
  return mapWhiteKeys.includes(pitch) ? "white" : "black";
}

export const keyInfos = [...Array(128)]
  .map((_, noteNumber) => {
    const pitch = getPitchFromNoteNumber(noteNumber);
    const octave = getOctaveFromNoteNumber(noteNumber);
    const name = `${pitch}${octave}`;
    const color = getKeyColorFromNoteNumber(noteNumber);
    return {
      noteNumber,
      pitch,
      octave,
      name,
      color,
    };
  })
  .reverse();

export function round(value: number, digits: number) {
  const powerOf10 = 10 ** digits;
  return Math.round(value * powerOf10) / powerOf10;
}
