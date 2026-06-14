<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div class="parameter-area">
      <SequencerParameterGrid class="parameter-grid" :viewportInfo />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ViewportInfo } from "@/sing/viewHelper";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";

defineProps<{
  viewportInfo: ViewportInfo;
}>();
</script>

<style scoped lang="scss">
.phoneme-timing-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;

  display: grid;
  grid-template-columns: 48px 1fr;
}

.axis-area {
  grid-column: 1;
  grid-row: 1;
  border-right: solid 1px var(--scheme-color-sing-piano-keys-right-border);
}

.parameter-area {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  position: relative;

  display: grid;
  grid-template-rows: 12px 26px 28px 1fr;
}

.parameter-grid {
  grid-column: 1;
  grid-row: 1 / 5;
}
</style>
