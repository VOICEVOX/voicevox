<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures="currentNumMeasures"
    :timeSignatures
    :tsPositions
    :offset="currentOffset"
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

const store = useStore();

// 基本的な値
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

// useSequencerLayoutを使用してレイアウト計算を行う
const { rulerWidth, tsPositions, endTicks, currentOffset, currentNumMeasures } =
  useSequencerLayout({
    timeSignatures,
    tpqn,
    playheadPosition,
    sequencerZoomX,
    offset: computed(() => 0),
  });
</script>
