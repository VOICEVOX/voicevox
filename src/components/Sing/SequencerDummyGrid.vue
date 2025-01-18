<template>
  <div class="sequencer-grid"></div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { gridInfoInjectionKey } from "@/components/Sing/sequencerInjectionKeys";

const injectedValue = inject(gridInfoInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const gridWidth = injectedValue.gridWidth;
const gridHeight = injectedValue.gridHeight;
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-grid {
  display: block;
  width: v-bind("`${gridWidth}px`");
  height: v-bind("`${gridHeight}px`");
  pointer-events: none;
}
</style>
