import { decibelToLinear } from "@/sing/audio";
import {
  absoluteVolumeValueScale,
  type VolumeValueScale,
} from "@/sing/volumeValueScale";

/**
 * ボリューム編集の入力と表示の定義。
 * UI上でポインタが示すdBはここで編集値へ変換されてvolumeEditDataに保存される。
 *
 * TODO: 後続PRで編集値の意味を「元のボリューム（エンジン出力）に掛ける倍率」へ
 * 変更し、toStoredValueの変換とapplyVolumeEditの適用を差し替える。
 */
export type VolumeEditMode = {
  /**
   * 編集値の解釈と対になる表示スケール。
   * モードごとに有効なスケールは1つなので、不正な組み合わせを防ぐためモード側が持つ。
   */
  valueScale: VolumeValueScale;
  /** エディタ上のポインタ位置が示すdBを、volumeEditDataに保存する編集値へ変換する。 */
  toStoredValue: (db: number) => number;
};

/**
 * 絶対値編集：描いた形状がそのまま最終的なボリュームになる方式。
 * ポインタが示すdBを振幅へ変換して編集値とする。
 */
export const absoluteVolumeEditMode: VolumeEditMode = {
  valueScale: absoluteVolumeValueScale,
  toStoredValue: (db) => {
    if (!Number.isFinite(db)) {
      throw new Error("db must be finite.");
    }
    return decibelToLinear(db);
  },
};
