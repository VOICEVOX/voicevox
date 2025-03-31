<template>
  <Presentation
    :width="rulerWidth"
    :playheadX
    :offset="props.offset"
    @click="handleClick"
  >
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

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import { offsetXToSnappedTick } from "@/sing/rulerHelper";

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
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

// useSequencerLayoutを使用してレイアウト計算を行う
const { rulerWidth, playheadX, currentOffset } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: computed(() => props.offset),
  numMeasures: computed(() => props.numMeasures),
});

// 再生ヘッド位置の設定
const setPlayheadPosition = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

// ノートの選択解除
const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};

// クリック時のハンドラ
const handleClick = (event: MouseEvent) => {
  deselectAllNotes();
  const ticks = offsetXToSnappedTick(
    event.offsetX,
    currentOffset.value,
    sequencerZoomX.value,
    timeSignatures.value,
    tpqn.value,
  );
  setPlayheadPosition(ticks);
};
</script>
