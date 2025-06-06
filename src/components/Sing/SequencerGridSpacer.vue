<template>
  <div class="sequencer-grid-spacer"></div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { getKeyBaseHeight, getNumKeys, tickToBaseX } from "@/sing/viewHelper";
import { useStore } from "@/store";
import { measureNumberToTick } from "@/sing/domain";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";

const injectedValue = inject(numMeasuresInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}
const { numMeasures } = injectedValue;

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const zoomX = computed(() => store.state.sequencerZoomX);
const zoomY = computed(() => store.state.sequencerZoomY);

const endMeasureNumber = computed(() => numMeasures.value + 1);

const endTicks = computed(() => {
  return measureNumberToTick(
    endMeasureNumber.value,
    timeSignatures.value,
    tpqn.value,
  );
});

const gridWidth = computed(() => {
  return tickToBaseX(endTicks.value, tpqn.value) * zoomX.value;
});

const gridHeight = computed(() => {
  return getKeyBaseHeight() * getNumKeys() * zoomY.value;
});
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
