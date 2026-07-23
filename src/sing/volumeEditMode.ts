import {
  relativeVolumeValueScale,
  type VolumeValueScale,
} from "@/sing/volumeValueScale";

/**
 * ボリューム編集の入力と表示の定義。
 * UI上でポインタが示すdBは、原音からの変更量としてvolumeAdjustmentDataに保存する。
 */
export type VolumeEditMode = {
  /**
   * 編集値の解釈と対になる表示スケール。
   * モードごとに有効なスケールは1つなので、不正な組み合わせを防ぐためモード側が持つ。
   */
  valueScale: VolumeValueScale;
  /**
   * エディタ上のポインタ位置が示すdBを、volumeAdjustmentDataに保存する編集値へ変換する。
   * 相対値編集ではdBをそのまま保存する。
   */
  toStoredValue: (db: number) => number;
};

/**
 * 相対値編集
 * 編集値は元のボリュームからのdB変化量（0で原音のまま）として保存される。
 */
export const relativeVolumeEditMode: VolumeEditMode = {
  valueScale: relativeVolumeValueScale,
  toStoredValue: (db) => db,
};
