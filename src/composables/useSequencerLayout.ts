/**
 * シーケンサーのレイアウト計算に関するコンポーザブル
 * TODO: 元はルーラー用に作成したが、複数のコンポーネントで使用しそうなど用途が広いため、ここからの分割を想定
 */
import { computed, ComputedRef, Ref, provide, inject, InjectionKey } from "vue";
import { getTimeSignaturePositions } from "@/sing/domain";
import { tickToBaseX, SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";
import { calculateEndTicks, calculateMeasureInfos } from "@/sing/rulerHelper";
import type { TimeSignature } from "@/store/type";

// 共用のオフセット・小節数のprovide/inject
// インジェクションキーの定義
export const offsetKey: InjectionKey<Ref<number>> = Symbol("sequencerOffset");
export const numMeasuresKey: InjectionKey<Ref<number>> = Symbol(
  "sequencerNumMeasures",
);

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
  currentOffset: Ref<number>;
  currentNumMeasures: Ref<number>;
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

  // 親コンポーネントからの呼び出し時にprovide
  if (offset && numMeasures) {
    provide(offsetKey, offset);
    provide(numMeasuresKey, numMeasures);
  }

  // offsetとnumMeasuresを取得（親からinjectするか、引数から直接使用）
  const currentOffset = inject(offsetKey, offset);
  const currentNumMeasures = inject(numMeasuresKey, numMeasures);

  // 拍子の位置を計算
  const tsPositions = computed(() => {
    return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
  });

  // 終了ティック位置を計算
  const endTicks = computed(() => {
    return calculateEndTicks(
      timeSignatures.value,
      tsPositions.value,
      currentNumMeasures.value,
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
    return Math.round(baseX * sequencerZoomX.value) - currentOffset.value;
  });

  return {
    measureInfos,
    tsPositions,
    endTicks,
    rulerWidth,
    playheadX,
    currentOffset,
    currentNumMeasures,
  };
}
