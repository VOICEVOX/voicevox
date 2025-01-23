<template>
  <div class="sequencer-grid-spacer"></div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { gridInfoInjectionKey } from "./ScoreSequencer.vue";

const injectedValue = inject(gridInfoInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const { gridWidth, gridHeight } = injectedValue;
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-grid-spacer {
  display: block;
  width: v-bind("`${gridWidth}px`");
  height: v-bind("`${gridHeight}px`");
  pointer-events: none;
}
</style>
