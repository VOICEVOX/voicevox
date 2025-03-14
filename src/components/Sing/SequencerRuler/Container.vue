<template>
  <Presentation :width :playheadX :offset @click="handleClick">
    <!-- TODO: 各コンポーネントもなるべく疎にしたつもりだが、少なくともplayheadまわりがリファクタリング必要そう -->
    <template #grid>
      <GridLaneContainer />
    </template>
    <template #changes>
      <ValueChangesLaneContainer />
    </template>
    <template #loop>
      <LoopLaneContainer />
    </template>
  </Presentation>
</template>

<script lang="ts">
import { ComputedRef } from "vue";
import type { InjectionKey } from "vue";

export const sequencerRulerInjectionKey: InjectionKey<{
  tpqn: ComputedRef<number>;
  tempos: ComputedRef<Tempo[]>;
  timeSignatures: ComputedRef<TimeSignature[]>;
  tsPositions: ComputedRef<number[]>;
  endTicks: ComputedRef<number>;
  baseX: (tick: number) => number;
  sequencerZoomX: ComputedRef<number>;
  width: ComputedRef<number>;
  numMeasures: number;
  offset: number;
  sequencerSnapType: ComputedRef<number>;
  uiLocked: ComputedRef<boolean>;
  loopStartTick: ComputedRef<number>;
  loopEndTick: ComputedRef<number>;
  isLoopEnabled: ComputedRef<boolean>;
  playheadTicks: ComputedRef<number>;
  offsetXToSnappedTick: (offsetX: number) => number;
  ticksToSnappedBeat: (
    ticks: number,
    timeSignatures: TimeSignature[],
    tpqn: number,
  ) => number;
  setLoopRange: (loopStartTick: number, loopEndTick: number) => void;
  clearLoopRange: () => void;
  setLoopEnabled: (isLoopEnabled: boolean) => void;
  setPlayheadPosition: (ticks: number) => void;
  setTempo: (tempo: Tempo) => void;
  removeTempo: (position: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  removeTimeSignature: (measureNumber: number) => void;
}> = Symbol();
</script>

<script setup lang="ts">
import { computed, provide } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import type { TimeSignature, Tempo } from "@/store/type";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import {
  getTimeSignaturePositions,
  getMeasureDuration,
  getBeatDuration,
} from "@/sing/domain";

defineOptions({
  name: "SequencerRuler",
});

const props = withDefaults(
  defineProps<{
    offset?: number;
    numMeasures?: number;
  }>(),
  {
    offset: 0,
    numMeasures: 32,
  },
);

const store = useStore();

// 基本的な値
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const tempos = computed(() => store.state.tempos);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const loopStartTick = computed(() => store.state.loopStartTick);
const loopEndTick = computed(() => store.state.loopEndTick);
const isLoopEnabled = computed(() => store.state.isLoopEnabled);

// 拍子ごとのTick位置
const tsPositions = computed(() =>
  getTimeSignaturePositions(timeSignatures.value, tpqn.value),
);

// 終了tick位置
const endTicks = computed(() => {
  const tsList = timeSignatures.value;
  if (tsList.length === 0) return 0;
  const lastTs = tsList[tsList.length - 1];
  const positions = tsPositions.value;
  const lastTsPosition = positions[positions.length - 1];
  const measureDuration = getMeasureDuration(
    lastTs.beats,
    lastTs.beatType,
    tpqn.value,
  );
  return (
    lastTsPosition +
    measureDuration * (props.numMeasures - lastTs.measureNumber + 1)
  );
});

// ルーラーの幅(px)
const width = computed(
  () => tickToBaseX(endTicks.value, tpqn.value) * sequencerZoomX.value,
);

// 再生ヘッドのX位置(px)
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, tpqn.value);
  return baseX * sequencerZoomX.value;
});

// NOTE: usePlayheadPositionができたら再生ヘッド周辺を置き換える
const setPlayheadPosition = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};

const setTempo = (tempo: Tempo) => {
  void store.actions.COMMAND_SET_TEMPO({ tempo });
};

const removeTempo = (position: number) => {
  void store.actions.COMMAND_REMOVE_TEMPO({ position });
};

const setTimeSignature = (timeSignature: TimeSignature) => {
  void store.actions.COMMAND_SET_TIME_SIGNATURE({ timeSignature });
};

const removeTimeSignature = (measureNumber: number) => {
  void store.actions.COMMAND_REMOVE_TIME_SIGNATURE({ measureNumber });
};

const setLoopRange = (loopStartTick: number, loopEndTick: number) => {
  void store.actions.SET_LOOP_RANGE({ loopStartTick, loopEndTick });
};

const clearLoopRange = () => {
  void store.actions.CLEAR_LOOP_RANGE();
};

const setLoopEnabled = (isLoopEnabled: boolean) => {
  void store.actions.SET_LOOP_ENABLED({ isLoopEnabled });
};

/**
 * 指定されたティックを直近の拍に合わせる
 * @param ticks スナップ対象のtick位置
 * @param timeSignatures 拍子情報の配列
 * @param tpqn TPQNの値
 * @returns スナップ後のtick位置
 */
const ticksToSnappedBeat = (
  ticks: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
): number => {
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  const nextTsIndex = tsPositions.findIndex((pos: number) => pos > ticks);
  const currentTsIndex =
    nextTsIndex === -1 ? tsPositions.length - 1 : nextTsIndex - 1;
  const currentTs = timeSignatures[currentTsIndex];

  // 現在の拍子に基づくグリッドサイズを計算
  const gridSize = getBeatDuration(currentTs.beatType, tpqn);

  // 拍子の開始位置からの相対位置を計算
  const tsPosition = tsPositions[currentTsIndex];
  const relativePosition = ticks - tsPosition;

  // グリッドにスナップ
  const snappedRelativePosition =
    Math.round(relativePosition / gridSize) * gridSize;

  return tsPosition + snappedRelativePosition;
};

// ルーラー用にoffsetされたX位置からスナップされたtickを取得
const offsetXToSnappedTick = (offsetX: number) => {
  const baseX = (props.offset + offsetX) / sequencerZoomX.value;
  const baseTick = baseXToTick(baseX, tpqn.value);
  return ticksToSnappedBeat(baseTick, timeSignatures.value, tpqn.value);
};

// provide/inject
// NOTE: 依存関係が多いが、親Containerのみstoreに依存する形
// 子のContainerはUIロジックを担う
// 位置関連など減らせる＆まとめられるものもありそうだが、Sequencer側とあわせて整理がよさそう
provide(sequencerRulerInjectionKey, {
  tsPositions,
  tempos,
  tpqn,
  playheadTicks,
  timeSignatures,
  endTicks,
  baseX: (tick: number) => tickToBaseX(tick, tpqn.value),
  sequencerZoomX,
  width,
  numMeasures: props.numMeasures,
  offset: props.offset,
  sequencerSnapType,
  uiLocked,
  loopStartTick,
  loopEndTick,
  isLoopEnabled,
  ticksToSnappedBeat,
  offsetXToSnappedTick,
  setLoopRange,
  clearLoopRange,
  setLoopEnabled,
  setPlayheadPosition,
  setTempo,
  removeTempo,
  setTimeSignature,
  removeTimeSignature,
});

const handleClick = (event: MouseEvent) => {
  deselectAllNotes();
  const ticks = offsetXToSnappedTick(event.offsetX);
  setPlayheadPosition(ticks);
};
</script>
