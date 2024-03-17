import { StyleInfo } from "@/type/preload";

const BASE_X_PER_QUARTER_NOTE = 120;
const BASE_Y_PER_SEMITONE = 30;

export const ZOOM_X_MIN = 0.2;
export const ZOOM_X_MAX = 1;
export const ZOOM_X_STEP = 0.05;
export const ZOOM_Y_MIN = 0.35;
export const ZOOM_Y_MAX = 1;
export const ZOOM_Y_STEP = 0.05;
export const PREVIEW_SOUND_DURATION = 0.15;

export function getKeyBaseHeight() {
  return BASE_Y_PER_SEMITONE;
}

export function tickToBaseX(ticks: number, tpqn: number) {
  return (ticks / tpqn) * BASE_X_PER_QUARTER_NOTE;
}

export function baseXToTick(baseX: number, tpqn: number) {
  return (baseX / BASE_X_PER_QUARTER_NOTE) * tpqn;
}

// NOTE: ノート番号が整数のときに、そのノート番号のキーの中央の位置を返します
export function noteNumberToBaseY(noteNumber: number) {
  return (127.5 - noteNumber) * BASE_Y_PER_SEMITONE;
}

// NOTE: integerがfalseの場合は、ノート番号のキーの中央の位置が
//       ちょうどそのノート番号となるように計算します
export function baseYToNoteNumber(baseY: number, integer = true) {
  return integer
    ? 127 - Math.floor(baseY / BASE_Y_PER_SEMITONE)
    : 127.5 - baseY / BASE_Y_PER_SEMITONE;
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

export const getStyleDescription = (style: StyleInfo) => {
  const description: string[] = [];
  if (style.styleType === "talk") {
    description.push("トーク");
  } else if (style.styleType === "frame_decode") {
    description.push("ハミング");
  } else if (style.styleType === "sing") {
    description.push("ソング");
  } else {
    throw new Error("Unknown style type.");
  }
  if (style.styleName != undefined) {
    description.push(style.styleName);
  }
  return description.join("・");
};

type ClickInfo<T> = {
  readonly detail: number;
  readonly targetId: T;
};

type DetectedDoubleClickInfo<T> = {
  readonly targetId: T;
};

export class DoubleClickDetector<T> {
  private clickInfos: ClickInfo<T>[] = [];

  recordClick(detail: number, targetId: T) {
    if (detail === 1) {
      this.clickInfos = [];
    }
    this.clickInfos.push({ detail, targetId });
  }

  detect(): DetectedDoubleClickInfo<T> | undefined {
    if (this.clickInfos.length < 2) {
      return undefined;
    }
    const clickInfo1 = this.clickInfos[this.clickInfos.length - 2];
    const clickInfo2 = this.clickInfos[this.clickInfos.length - 1];
    if (
      clickInfo1.detail === 1 &&
      clickInfo2.detail === 2 &&
      clickInfo1.targetId === clickInfo2.targetId
    ) {
      return { targetId: clickInfo1.targetId };
    }
    return undefined;
  }

  clear() {
    this.clickInfos = [];
  }
}
