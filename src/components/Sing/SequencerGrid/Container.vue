<template>
  <Presentation
    :tpqn
    :timeSignatures
    :sequencerZoomX
    :sequencerZoomY
    :sequencerSnapType
    :numMeasures
    :isLoopEnabled
    :loopStartTick
    :loopEndTick
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";

defineOptions({
  name: "SequencerGrid",
});

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerZoomY = computed(() => store.state.sequencerZoomY);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
const numMeasures = computed(() => store.getters.SEQUENCER_NUM_MEASURES);
const { isLoopEnabled, loopStartTick, loopEndTick } = useLoopControl();
</script>
