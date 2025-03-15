<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures="props.numMeasures"
    :timeSignatures
    :tsPositions
    :offset="props.offset"
    :width="rulerWidth"
    :endTicks
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";

defineOptions({
  name: "GridLaneContainer",
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
const { rulerWidth, tsPositions, endTicks } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: computed(() => props.offset),
  numMeasures: computed(() => props.numMeasures),
});
</script>
