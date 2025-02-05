import { z } from "zod";
import { StyleInfo } from "@/type/preload";
import { isMac } from "@/helpers/platform";

const BASE_X_PER_QUARTER_NOTE = 120;
const BASE_Y_PER_SEMITONE = 30;

export const ZOOM_X_MIN = 0.15;
export const ZOOM_X_MAX = 2;
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

export const keyInfos = Array.from({ length: 128 }, (_, noteNumber) => {
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
}).toReversed();

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

export type MouseButton = "LEFT_BUTTON" | "RIGHT_BUTTON" | "OTHER_BUTTON";

export type PreviewMode =
  | "IDLE"
  | "ADD_NOTE"
  | "MOVE_NOTE"
  | "RESIZE_NOTE_RIGHT"
  | "RESIZE_NOTE_LEFT"
  | "DRAW_PITCH"
  | "ERASE_PITCH";

// マウスダウン時の振る舞い
export const mouseDownBehaviorSchema = z.enum([
  "IGNORE",
  "DESELECT_ALL",
  "ADD_NOTE",
  "START_RECT_SELECT",
  "DRAW_PITCH",
  "ERASE_PITCH",
]);
export type MouseDownBehavior = z.infer<typeof mouseDownBehaviorSchema>;

// ダブルクリック時の振る舞い
export const mouseDoubleClickBehaviorSchema = z.enum(["IGNORE", "ADD_NOTE"]);
export type MouseDoubleClickBehavior = z.infer<
  typeof mouseDoubleClickBehaviorSchema
>;

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

// カーソルの状態
export const cursorStateSchema = z.enum([
  "UNSET",
  "DRAW",
  "MOVE",
  "EW_RESIZE",
  "CROSSHAIR",
  "ERASE",
]);
export type CursorState = z.infer<typeof cursorStateSchema>;
