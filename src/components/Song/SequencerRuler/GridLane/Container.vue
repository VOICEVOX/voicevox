<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures="numMeasures.value"
    :offset="injectedOffset"
    :timeSignatures
    :tsPositions
    :width="rulerWidth"
    :totalTicks
    :measureInfos
  />
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { numMeasuresInjectionKey } from "../../ScoreSequencer.vue";
import { offsetInjectionKey } from "../Container.vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";

defineOptions({
  name: "GridLaneContainer",
});

const store = useStore();

const injectedOffset = inject(offsetInjectionKey);
if (injectedOffset == undefined) {
  throw new Error("injectedOffset is undefined.");
}

const injectedNumMeasures = inject(numMeasuresInjectionKey);
if (injectedNumMeasures == undefined) {
  throw new Error("injectedNumMeasures is undefined.");
}

const numMeasures = computed(() => injectedNumMeasures.numMeasures);

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

const { rulerWidth, tsPositions, totalTicks, measureInfos } =
  useSequencerLayout({
    timeSignatures,
    tpqn,
    playheadPosition,
    sequencerZoomX,
    offset: injectedOffset,
    numMeasures: numMeasures.value,
  });
</script>
