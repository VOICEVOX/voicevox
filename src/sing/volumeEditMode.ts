import { decibelToLinear } from "@/sing/audio";

/**
 * ボリュームの編集値をどう解釈するかを定義する
 * 今後の相対値編集が必要になった場合、VolumeEditModeを変更することで切り替えられるようにする
 * エディタの表示と合成の両方がこの型を参照することで、表示と再生結果のズレを防ぐ
 */
export type VolumeEditMode = {
  /**
   * エディタ上のポインタ位置が示すdBを、volumeEditDataに保存する編集値へ変換する
   * 相対値編集の場合は変換に元のボリュームが必要になるため、originalValueも受け取る
   */
  toStoredValue: (db: number, originalValue: number | undefined) => number;
  /**
   * 編集値と元のボリュームから、実際に適用する実ボリュームを計算する
   * この計算結果がエディタでの表示と合成の両方に使われる
   * 元のボリュームが存在しないフレームでは、originalValueにundefinedが渡される
   * VALUE_INDICATING_NO_DATAは呼び出し側でundefinedに変換し、この関数には渡さないようにする
   */
  toEffectiveValue: (
    editValue: number,
    originalValue: number | undefined,
  ) => number;
};

/**
 * 絶対値編集
 * 編集値はlinear volumeそのものとして保存され、元のボリュームに依存せずそのまま適用される
 */
export const absoluteVolumeEditMode: VolumeEditMode = {
  toStoredValue: (db) => {
    if (!Number.isFinite(db)) {
      throw new Error("db must be finite.");
    }
    return Math.min(decibelToLinear(db), 1);
  },
  // NOTE: 編集値が負値になっているケースがありえそうなため、0以上にクランプする
  toEffectiveValue: (editValue) => Math.max(editValue, 0),
};
