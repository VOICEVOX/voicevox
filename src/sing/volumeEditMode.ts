import { decibelToLinear } from "@/sing/audio";

/**
 * ボリューム編集値のセマンティクス（絶対値・相対値など）を定義するストラテジ。
 * 表示（エディタ）と音声合成の両方がこれを参照することで、表示と再生結果のズレを防ぐ。
 */
export type VolumeEditMode = {
  /** ポインタ位置のdBを保存値（volumeEditDataに入れる値）へ変換する */
  toStoredValue: (db: number, originalValue: number | undefined) => number;
  /**
   * 保存値と元ボリュームから実効値（表示・音声出力に使うlinear volume）を計算する。
   * 元ボリュームが存在しないフレームではoriginalValueにundefinedが渡される。
   */
  toEffectiveValue: (
    editValue: number,
    originalValue: number | undefined,
  ) => number;
};

/** 絶対値編集。保存値はlinear volumeそのもので、元ボリュームには依存しない。 */
export const absoluteVolumeEditMode: VolumeEditMode = {
  toStoredValue: (db) => {
    if (!Number.isFinite(db)) {
      throw new Error("db must be finite.");
    }
    return Math.min(decibelToLinear(db), 1);
  },
  // NOTE: ボリューム編集結果が負値になるケースに備えて0以上にクランプする
  toEffectiveValue: (editValue) => Math.max(editValue, 0),
};
