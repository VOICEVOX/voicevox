<template>
  <div class="sequencer-parameter-panel">
    <SequencerVolumeEditor :playheadTicks :tempos :tpqn :zoomX :zoomY />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor.vue";
import { useStore } from "@/store";

const store = useStore();

const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const zoomX = computed(() => store.state.sequencerZoomX);
const zoomY = computed(() => store.state.sequencerZoomY);
</script>

<style scoped lang="scss">
.sequencer-parameter-panel {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
</style>
