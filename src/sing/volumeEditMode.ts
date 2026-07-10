import { decibelToLinear, linearToDecibel } from "@/sing/audio";
import { clamp, linearInterpolation } from "@/sing/utility";
import {
  relativeVolumeValueScale,
  type VolumeValueScale,
} from "@/sing/volumeValueScale";

/**
 * ボリューム編集の入力と表示の定義。
 * UI上でポインタが示すdBは、原音に掛ける倍率へ変換してvolumeEditDataに保存する。
 */
export type VolumeEditMode = {
  /**
   * 編集値の解釈と対になる表示スケール。
   * モードごとに有効なスケールは1つなので、不正な組み合わせを防ぐためモード側が持つ。
   */
  valueScale: VolumeValueScale;
  /** エディタ上のポインタ位置が示すdBを、volumeEditDataに保存する編集値へ変換する。 */
  toStoredValue: (db: number) => number;
  /** 編集値を表示スケールの範囲内にクランプする。 */
  clampStoredValue: (value: number) => number;
  /**
   * 2つの編集値の間をxの位置で補間する。
   * カーソル入力間を知覚に沿うdB空間で補うために使用する。
   */
  interpolateStoredValues: (
    x0: number,
    value0: number,
    x1: number,
    value1: number,
    x: number,
  ) => number;
};

/**
 * 相対値編集
 * 編集値は元のボリュームに掛ける倍率（リニア比、1で原音のまま）として保存される。
 * 倍率は常に正のため、VALUE_INDICATING_NO_DATAと衝突しない。
 */
export const relativeVolumeEditMode: VolumeEditMode = {
  valueScale: relativeVolumeValueScale,
  toStoredValue: (db) => {
    if (!Number.isFinite(db)) {
      throw new Error("db must be finite.");
    }
    return decibelToLinear(db);
  },
  clampStoredValue: (value) =>
    clamp(
      value,
      decibelToLinear(relativeVolumeValueScale.minDb),
      decibelToLinear(relativeVolumeValueScale.maxDb),
    ),
  // 倍率のまま補間すると持ち上げ側に膨らむため、知覚に沿うdB空間で線形補間する
  interpolateStoredValues: (x0, value0, x1, value1, x) =>
    decibelToLinear(
      linearInterpolation(
        x0,
        linearToDecibel(value0),
        x1,
        linearToDecibel(value1),
        x,
      ),
    ),
};

/** 現在使用するボリューム編集モード。 */
export const currentVolumeEditMode = relativeVolumeEditMode;
