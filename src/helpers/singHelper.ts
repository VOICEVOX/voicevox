import { Note, Tempo, TimeSignature } from "@/store/type";

export const BEAT_TYPES = [2, 4, 8, 16];

export const DEFAULT_TPQN = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_BEATS = 4;
export const DEFAULT_BEAT_TYPE = 4;

const BASE_X_PER_QUARTER_NOTE = 120;
const BASE_Y_PER_NOTE_NUMBER = 30;

export function noteNumberToFrequency(noteNumber: number) {
  return 440 * 2 ** ((noteNumber - 69) / 12);
}

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

export class FrequentlyUpdatedState<T> {
  private _value: T;
  private listeners = new Set<(newValue: T) => void>();

  get value() {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.listeners.forEach((listener) => listener(newValue));
  }

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  addValueChangeListener(listener: (newValue: T) => void) {
    if (this.listeners.has(listener)) {
      throw new Error("The listener already exists.");
    }
    this.listeners.add(listener);
    listener(this.value);
  }

  removeValueChangeListener(listener: (newValue: T) => void) {
    if (!this.listeners.has(listener)) {
      throw new Error("The listener does not exist.");
    }
    this.listeners.delete(listener);
  }
}

export class AnimationFrameRunner {
  private readonly maxFrameTime: number;

  private requestId?: number;
  private prevTimeStamp?: number;
  private frameTimeDiff = 0;

  get isStarted() {
    return this.requestId !== undefined;
  }

  constructor(maxFrameRate = 60) {
    this.maxFrameTime = 1000 / maxFrameRate;
  }

  start(onAnimationFrame: () => void) {
    if (this.requestId !== undefined) {
      throw new Error("The animation frame runner is already started.");
    }

    this.frameTimeDiff = 0;
    this.prevTimeStamp = undefined;

    const callback = (timeStamp: number) => {
      if (this.prevTimeStamp === undefined) {
        this.frameTimeDiff += this.maxFrameTime;
      } else {
        this.frameTimeDiff += timeStamp - this.prevTimeStamp;
      }
      let isExecuted = false;
      while (this.frameTimeDiff >= this.maxFrameTime) {
        this.frameTimeDiff -= this.maxFrameTime;
        if (!isExecuted) {
          onAnimationFrame();
          isExecuted = true;
        }
      }
      this.prevTimeStamp = timeStamp;
      this.requestId = window.requestAnimationFrame(callback);
    };
    this.requestId = window.requestAnimationFrame(callback);
  }

  stop() {
    if (this.requestId === undefined) {
      throw new Error("The animation frame runner is not started.");
    }
    window.cancelAnimationFrame(this.requestId);
    this.requestId = undefined;
  }
}
