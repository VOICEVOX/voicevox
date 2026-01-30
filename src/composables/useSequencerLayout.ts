/**
 * シーケンサーのレイアウト計算に関するコンポーザブル
 * NOTE: 雑多です
 */
import { computed, ComputedRef, Ref } from "vue";
import { getTimeSignaturePositions } from "@/sing/music";
import { tickToBaseX } from "@/sing/viewHelper";
import { getTotalTicks, calculateMeasureInfos } from "@/sing/rulerHelper";
import type { TimeSignature } from "@/domain/project/type";

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
  numMeasures: Ref<number>;
}

export interface SequencerLayout {
  measureInfos: ComputedRef<MeasureInfo[]>;
  tsPositions: ComputedRef<number[]>;
  totalTicks: ComputedRef<number>;
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
    numMeasures,
  } = options;

  // 拍子の位置を計算
  const tsPositions = computed(() => {
    return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
  });

  // 終了ティック位置を計算
  const totalTicks = computed(() => {
    return getTotalTicks(timeSignatures.value, numMeasures.value, tpqn.value);
  });

  // 表示する小節情報を計算
  const measureInfos = computed(() => {
    return calculateMeasureInfos(
      timeSignatures.value,
      numMeasures.value,
      tpqn.value,
      sequencerZoomX.value,
    );
  });

  // ルーラーの幅を計算
  const rulerWidth = computed(() => {
    const baseX = tickToBaseX(totalTicks.value, tpqn.value);
    return Math.round(baseX * sequencerZoomX.value);
  });

  // 再生ヘッドの位置を計算
  const playheadX = computed(() => {
    const baseX = tickToBaseX(playheadPosition.value, tpqn.value);
    const playheadBaseX = Math.floor(baseX * sequencerZoomX.value);
    return playheadBaseX - offset.value;
  });

  return {
    measureInfos,
    tsPositions,
    totalTicks,
    rulerWidth,
    playheadX,
  };
}
