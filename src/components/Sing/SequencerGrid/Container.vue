<template>
  <Presentation
    :tpqn
    :tempos
    :timeSignatures
    :zoomX
    :zoomY
    :snapType
    :uiLocked
    :numMeasures
  />
</template>
<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";

defineOptions({
  name: "SequencerGrid",
});

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const zoomX = computed(() => store.state.sequencerZoomX);
const zoomY = computed(() => store.state.sequencerZoomY);
const snapType = computed(() => store.state.sequencerSnapType);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const numMeasures = computed(() => store.getters.SEQUENCER_NUM_MEASURES);
</script>
