<template>
  <div class="sequencer-parameter-panel">
    <SequencerVolumeEditor :offsetX="props.offsetX" />
  </div>
</template>

<script setup lang="ts">
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor.vue";

const props = defineProps<{
  offsetX: number;
}>();
</script>

<style scoped lang="scss">
.sequencer-parameter-panel {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
</style>
