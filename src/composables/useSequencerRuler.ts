import { computed, ComputedRef } from "vue";
import { TimeSignature } from "@/store/type";
import {
  getTimeSignaturePositions,
  getMeasureDuration,
  snapTicksToGrid,
} from "@/sing/domain";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";

/**
 * シーケンサのルーラーに関わる計算ロジックをまとめたコンポーザブル。
 * storeに依存させず、計算に必要なパラメータはすべて外部から受け取る想定。
 */
export const useSequencerRuler = (params: {
  offset: ComputedRef<number>;
  numMeasures: ComputedRef<number>;
  tpqn: ComputedRef<number>;
  timeSignatures: ComputedRef<TimeSignature[]>;
  sequencerZoomX: ComputedRef<number>;
  playheadTicks: ComputedRef<number>;
  sequencerSnapType: ComputedRef<number>;
}) => {
  // 拍子ごとのTick位置
  const tsPositions = computed(() => {
    return getTimeSignaturePositions(
      params.timeSignatures.value,
      params.tpqn.value,
    );
  });

  // 終了tick位置
  const endTicks = computed(() => {
    const tsList = params.timeSignatures.value;
    if (tsList.length === 0) return 0;
    const lastTs = tsList[tsList.length - 1];
    const positions = tsPositions.value;
    const lastTsPosition = positions[positions.length - 1];
    const measureDuration = getMeasureDuration(
      lastTs.beats,
      lastTs.beatType,
      params.tpqn.value,
    );
    return (
      lastTsPosition +
      measureDuration * (params.numMeasures.value - lastTs.measureNumber + 1)
    );
  });

  // ルーラーの幅(px)
  const width = computed(() => {
    return (
      tickToBaseX(endTicks.value, params.tpqn.value) *
      params.sequencerZoomX.value
    );
  });

  // 再生ヘッドのX位置(px)
  const playheadX = computed(() => {
    const baseX = tickToBaseX(params.playheadTicks.value, params.tpqn.value);
    return baseX * params.sequencerZoomX.value;
  });

  /**
   * 任意のクリック位置(offsetX)から、スナップされたTickを返す
   */
  const getSnappedTickFromOffsetX = (offsetX: number) => {
    const baseX = (params.offset.value + offsetX) / params.sequencerZoomX.value;
    const baseTick = baseXToTick(baseX, params.tpqn.value);
    return snapTicksToGrid(
      baseTick,
      params.timeSignatures.value,
      params.tpqn.value,
    );
  };

  return {
    tsPositions,
    endTicks,
    width,
    playheadX,
    getSnappedTickFromOffsetX,
  };
};
