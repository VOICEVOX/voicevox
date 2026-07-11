import { decibelToLinear } from "@/sing/audio";
import {
  absoluteVolumeValueScale,
  type VolumeValueScale,
} from "@/sing/volumeValueScale";

/**
 * ボリューム編集値の解釈を定義する。
 * 相対値編集を追加する場合はこの実装を差し替える。
 * 表示と合成が同じ実装を参照するため、表示と再生結果はズレない。
 */
export type VolumeEditMode = {
  /**
   * 編集値の解釈と対になる表示スケール。
   * モードごとに有効なスケールは1つなので、不正な組み合わせを防ぐためモード側が持つ。
   */
  valueScale: VolumeValueScale;
  /** エディタ上のポインタ位置が示すdBを、volumeEditDataに保存する編集値へ変換する。 */
  toStoredValue: (db: number) => number;
  /**
   * 編集値と元のボリュームから、実際に適用する実ボリュームを計算する。
   * 実ボリュームが定まらない場合（元のボリュームを必要とするモードでoriginalValueがない場合）はundefinedを返す。
   * originalValueにVALUE_INDICATING_NO_DATAは渡さず、呼び出し側でundefinedに変換すること。
   */
  toEffectiveValue: (
    editValue: number,
    originalValue: number | undefined,
  ) => number | undefined;
};

/**
 * 絶対値編集
 * 編集値はlinear volumeそのものとして保存され、元のボリュームに依存せずそのまま適用される
 */
export const absoluteVolumeEditMode: VolumeEditMode = {
  valueScale: absoluteVolumeValueScale,
  toStoredValue: (db) => {
    if (!Number.isFinite(db)) {
      throw new Error("db must be finite.");
    }
    return decibelToLinear(db);
  },
  // NOTE: 編集結果が負値になるケースに備えて0以上にクランプする
  toEffectiveValue: (editValue) => Math.max(editValue, 0),
};
