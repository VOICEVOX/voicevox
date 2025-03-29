/**
 * シーケンサーのレイアウト計算に関するコンポーザブル
 * TODO: 元はルーラー用に作成したが、複数のコンポーネントで使用しそうなど用途が広いため、ここからの分割を想定
 */
import { computed, ComputedRef, Ref } from "vue";
import { getTimeSignaturePositions } from "@/sing/domain";
import { tickToBaseX, SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";
import { calculateEndTicks, calculateMeasureInfos } from "@/sing/rulerHelper";
import type { TimeSignature } from "@/store/type";

// 小節のレイアウト位置
export interface MeasureInfo {
  number: number;
  x: number;
}

export interface SequencerLayoutOptions {
  timeSignatures: Ref<TimeSignature[]>;
  tpqn: Ref<number>;
  playheadPosition: Ref<number>;
  sequencerZoomX: Ref<number>;
  offset: Ref<number>;
  numMeasures?: Ref<number>;
}

export interface SequencerLayout {
  measureInfos: ComputedRef<MeasureInfo[]>;
  tsPositions: ComputedRef<number[]>;
  endTicks: ComputedRef<number>;
  rulerWidth: ComputedRef<number>;
  playheadX: ComputedRef<number>;
}

/**
 * シーケンサーのレイアウト計算を提供するコンポーザブル
 * @param options レイアウトオプション
 * @returns レイアウト計算の結果
 */
export function useSequencerLayout(
  options: SequencerLayoutOptions,
): SequencerLayout {
  const {
    timeSignatures,
    tpqn,
    playheadPosition,
    sequencerZoomX,
    offset,
    numMeasures = computed(() => SEQUENCER_MIN_NUM_MEASURES),
  } = options;

  // 拍子の位置を計算
  const tsPositions = computed(() => {
    return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
  });

  // 終了ティック位置を計算
  const endTicks = computed(() => {
    return calculateEndTicks(
      timeSignatures.value,
      tsPositions.value,
      numMeasures.value,
      tpqn.value,
    );
  });

  // 表示する小節情報を計算
  const measureInfos = computed(() => {
    return calculateMeasureInfos(
      timeSignatures.value,
      tsPositions.value,
      endTicks.value,
      tpqn.value,
      sequencerZoomX.value,
    );
  });

  // ルーラーの幅を計算
  const rulerWidth = computed(() => {
    const baseX = tickToBaseX(endTicks.value, tpqn.value);
    return Math.round(baseX * sequencerZoomX.value);
  });

  // 再生ヘッドの位置を計算
  const playheadX = computed(() => {
    const baseX = tickToBaseX(playheadPosition.value, tpqn.value);
    return Math.round(baseX * sequencerZoomX.value) - offset.value;
  });

  return {
    measureInfos,
    tsPositions,
    endTicks,
    rulerWidth,
    playheadX,
  };
}

/**
 * ビューポート内のオブジェクトを計算するための関数
 * @param position オブジェクトの位置（X座標）
 * @param width オブジェクトの幅
 * @param offset 表示オフセット
 * @param viewportWidth ビューポートの幅
 * @returns ビューポート内かどうか
 */
export function isInViewport(
  position: number,
  width: number,
  offset: number,
  viewportWidth: number,
): boolean {
  const right = position + width;
  const left = position;

  return right >= offset && left <= offset + viewportWidth;
}

/**
 * ビューポート内の小節を計算する
 * @param measureInfos 小節情報の配列
 * @param offset 表示オフセット
 * @param viewportWidth ビューポートの幅
 * @returns ビューポート内の小節情報
 */
export function getVisibleMeasures(
  measureInfos: MeasureInfo[],
  offset: number,
  viewportWidth: number,
): MeasureInfo[] {
  if (measureInfos.length === 0) return [];

  // 隣接する小節間の幅を推定（最初の2つの小節から計算）
  let measureWidth = 0;
  if (measureInfos.length >= 2) {
    measureWidth = measureInfos[1].x - measureInfos[0].x;
  }

  // ビューポート内の小節を抽出
  return measureInfos.filter((measure) =>
    isInViewport(measure.x, measureWidth, offset, viewportWidth),
  );
}
