<template>
  <Presentation
    :tpqn
    :timeSignatures
    :sequencerZoomX
    :sequencerZoomY
    :sequencerSnapType
    :numMeasures
    :gridWidth
    :gridHeight
    :offsetX="props.offsetX"
    :offsetY="props.offsetY"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { inject } from "vue";
import { gridInfoInjectionKey } from "../ScoreSequencer.vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";

defineOptions({
  name: "SequencerGrid",
});

const props = defineProps<{
  offsetX: number;
  offsetY: number;
}>();

const injectedValue = inject(gridInfoInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const { gridWidth, gridHeight } = injectedValue;

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerZoomY = computed(() => store.state.sequencerZoomY);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
const numMeasures = computed(() => store.getters.SEQUENCER_NUM_MEASURES);
</script>
