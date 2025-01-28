<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures
    :timeSignatures
    :tsPositions
    :offset
    :width
    :endTicks
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useSequencerRuler } from "@/composables/useSequencerRuler";

defineOptions({
  name: "GridLaneContainer",
});

const props = defineProps<{
  numMeasures: number;
  offset: number;
}>();

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const timeSignatures = computed(() => store.state.timeSignatures);
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);

const { tsPositions, width, endTicks } = useSequencerRuler({
  offset: computed(() => props.offset),
  numMeasures: computed(() => props.numMeasures),
  tpqn,
  timeSignatures,
  sequencerZoomX,
  playheadTicks,
  sequencerSnapType,
});
</script>
