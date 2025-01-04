<template>
  <div
    class="sequencer-grid"
    :style="{
      width: `${gridWidth}px`,
      height: `${gridHeight}px`,
    }"
  ></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { keyInfos, getKeyBaseHeight, tickToBaseX } from "@/sing/viewHelper";
import { getMeasureDuration, getNoteDuration } from "@/sing/domain";
import { useStore } from "@/store";

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerZoomY = computed(() => store.state.sequencerZoomY);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
const numMeasures = computed(() => store.getters.SEQUENCER_NUM_MEASURES);

const gridCellTicks = computed(() => {
  return getNoteDuration(sequencerSnapType.value, tpqn.value);
});
const gridCellWidth = computed(() => {
  return tickToBaseX(gridCellTicks.value, tpqn.value) * sequencerZoomX.value;
});
const gridCellBaseHeight = getKeyBaseHeight();
const gridCellHeight = computed(() => {
  return gridCellBaseHeight * sequencerZoomY.value;
});

const gridWidth = computed(() => {
  let numOfGridColumns = 0;
  for (const [i, timeSignature] of timeSignatures.value.entries()) {
    const nextTimeSignature = timeSignatures.value[i + 1];
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? numMeasures.value + 1;
    const beats = timeSignature.beats;
    const beatType = timeSignature.beatType;
    const measureDuration = getMeasureDuration(beats, beatType, tpqn.value);
    numOfGridColumns +=
      Math.round(measureDuration / gridCellTicks.value) *
      (nextMeasureNumber - timeSignature.measureNumber);
  }
  return gridCellWidth.value * numOfGridColumns;
});
const gridHeight = computed(() => {
  return gridCellHeight.value * keyInfos.length;
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-grid {
  display: block;
  pointer-events: none;
}
</style>
