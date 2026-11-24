<template>
  <SplitterPanel
    class="song-splitter-panel"
    :order
    :sizeUnit
    :defaultSize
    :minSize
    :maxSize
    @resize="(size) => emit('resize', size)"
  >
    <slot />
  </SplitterPanel>
</template>

<script setup lang="ts">
import { SplitterPanel } from "reka-ui";

defineProps<{
  order?: number;
  sizeUnit?: "%" | "px";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
}>();

const emit = defineEmits<{
  resize: [size: number];
}>();
</script>

<style scoped lang="scss">
.song-splitter-panel {
  isolation: isolate;
}
</style>
