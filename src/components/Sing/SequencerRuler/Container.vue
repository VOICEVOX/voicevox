<template>
  <Presentation
    :width="rulerWidth"
    :playheadX
    :offset="currentOffset"
    @click="handleClick"
  >
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
import type { Ref, InjectionKey } from "vue";

// Provide/Injectで使用するキー
export const offsetInjectionKey: InjectionKey<Ref<number>> =
  Symbol("rulerOffset");
</script>

<script setup lang="ts">
import { computed, provide, readonly, toRef } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import { SEQUENCER_MIN_NUM_MEASURES, baseXToTick } from "@/sing/viewHelper";
import { snapTickToBeat } from "@/sing/rulerHelper";

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
    numMeasures: SEQUENCER_MIN_NUM_MEASURES,
  },
);

const store = useStore();

// provideするoffsetとnumMeasures
// toRefでリアクティブ性を維持する
const currentOffset = toRef(props, "offset");
const currentNumMeasures = toRef(props, "numMeasures");

// provideする値はreadonlyにして子コンポーネントでの変更を防ぐ
provide(offsetInjectionKey, readonly(currentOffset));

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

const { rulerWidth, playheadX } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: currentOffset,
  numMeasures: currentNumMeasures,
});

// 再生ヘッド位置の設定
const setPlayheadPosition = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

// ノートの選択解除
const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};

// クリックでスナップした位置に移動
// 再生ヘッドも移動
const handleClick = (event: MouseEvent) => {
  deselectAllNotes();
  const targetOffsetX = event.offsetX;
  const baseX = (currentOffset.value + targetOffsetX) / sequencerZoomX.value;
  const baseXTick = baseXToTick(baseX, tpqn.value);
  const nextTicks = snapTickToBeat(baseXTick, timeSignatures.value, tpqn.value);
  setPlayheadPosition(nextTicks);
};
</script>
