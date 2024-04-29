import { z } from "zod";
import { StyleInfo, isMac } from "@/type/preload";
import { calculateHash } from "@/sing/utility";

const BASE_X_PER_QUARTER_NOTE = 120;
const BASE_Y_PER_SEMITONE = 30;

export const ZOOM_X_MIN = 0.2;
export const ZOOM_X_MAX = 1;
export const ZOOM_X_STEP = 0.05;
export const ZOOM_Y_MIN = 0.5;
export const ZOOM_Y_MAX = 1.5;
export const ZOOM_Y_STEP = 0.05;
export const PREVIEW_SOUND_DURATION = 0.15;

export function getKeyBaseHeight() {
  return BASE_Y_PER_SEMITONE;
}

export function tickToBaseX(ticks: number, tpqn: number) {
  return (ticks / tpqn) * BASE_X_PER_QUARTER_NOTE;
}

// NOTE: 戻り値は実数
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

interface AreaInfo {
  readonly id: string;
}

type ClickInfo<T extends AreaInfo> = {
  readonly clickCount: number;
  readonly areaInfo: T;
};

type DoubleClickInfo<T extends AreaInfo> = {
  readonly clickInfos: [ClickInfo<T>, ClickInfo<T>];
};

export class DoubleClickDetector<T extends AreaInfo> {
  private clickInfos: ClickInfo<T>[] = [];

  recordClick(clickCount: number, areaInfo: T) {
    if (clickCount === 1) {
      this.clickInfos = [];
    }
    this.clickInfos.push({ clickCount, areaInfo });
  }

  detect(): DoubleClickInfo<T> | undefined {
    if (this.clickInfos.length < 2) {
      return undefined;
    }
    const clickInfo1 = this.clickInfos[this.clickInfos.length - 2];
    const clickInfo2 = this.clickInfos[this.clickInfos.length - 1];
    if (
      clickInfo1.clickCount === 1 &&
      clickInfo2.clickCount === 2 &&
      clickInfo1.areaInfo.id === clickInfo2.areaInfo.id
    ) {
      return { clickInfos: [clickInfo1, clickInfo2] };
    }
    return undefined;
  }
}

export class NoteAreaInfo implements AreaInfo {
  readonly type: "note";
  readonly id: string;
  readonly noteId: string;

  constructor(noteId: string) {
    this.type = "note";
    this.id = `NOTE-${noteId}`;
    this.noteId = noteId;
  }
}

export class GridAreaInfo implements AreaInfo {
  readonly type: "grid";
  readonly id: string;

  constructor() {
    this.type = "grid";
    this.id = "GRID";
  }
}

export type FramewiseDataSection = {
  readonly startFrame: number;
  readonly frameRate: number;
  readonly data: number[];
};

const framewiseDataSectionHashSchema = z
  .string()
  .brand<"FramewiseDataSectionHash">();

export type FramewiseDataSectionHash = z.infer<
  typeof framewiseDataSectionHashSchema
>;

export async function calculateFramewiseDataSectionHash(
  dataSection: FramewiseDataSection,
) {
  const hash = await calculateHash(dataSection);
  return framewiseDataSectionHashSchema.parse(hash);
}

export type MouseButton = "LEFT_BUTTON" | "RIGHT_BUTTON" | "OTHER_BUTTON";

export function getButton(event: MouseEvent): MouseButton {
  // macOSの場合、Ctrl+クリックは右クリック
  if (isMac && event.button === 0 && event.ctrlKey) {
    return "RIGHT_BUTTON";
  }
  if (event.button === 0) {
    return "LEFT_BUTTON";
  } else if (event.button === 2) {
    return "RIGHT_BUTTON";
  } else {
    return "OTHER_BUTTON";
  }
}
