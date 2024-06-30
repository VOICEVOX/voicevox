<template>
  <!-- NOTE: 現状オクターブごとの罫線なし -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="gridWidth"
    :height="gridHeight"
    class="sequencer-grid"
  >
    <defs>
      <pattern
        id="sequencer-grid-octave-cells"
        patternUnits="userSpaceOnUse"
        :width="gridCellWidth"
        :height="gridCellHeight * 12"
      >
        <rect
          v-for="(keyInfo, index) in keyInfos"
          :key="index"
          x="0"
          :y="gridCellHeight * index"
          :width="gridCellWidth"
          :height="gridCellHeight"
          :class="`sequencer-grid-cell sequencer-grid-cell-${keyInfo.color}`"
        />
        <template v-for="(keyInfo, index) in keyInfos" :key="index">
          <line
            v-if="keyInfo.pitch === 'C'"
            x1="0"
            :x2="gridCellWidth"
            :y1="gridCellHeight * (index + 1)"
            :y2="gridCellHeight * (index + 1)"
            stroke-width="1"
            class="sequencer-grid-octave-line"
          />
        </template>
      </pattern>
      <pattern
        id="sequencer-grid-measure"
        patternUnits="userSpaceOnUse"
        :width="beatWidth * beatsPerMeasure"
        :height="gridHeight"
      >
        <line
          v-for="n in beatsPerMeasure"
          :key="n"
          :x1="beatWidth * (n - 1)"
          :x2="beatWidth * (n - 1)"
          y1="0"
          y2="100%"
          stroke-width="1"
          :class="`sequencer-grid-${n === 1 ? 'measure' : 'beat'}-line`"
        />
      </pattern>
    </defs>
    <rect
      x="0"
      y="0"
      width="100%"
      height="100%"
      fill="url(#sequencer-grid-octave-cells)"
    />
    <rect
      x="0"
      y="0"
      width="100%"
      height="100%"
      fill="url(#sequencer-grid-measure)"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { keyInfos, getKeyBaseHeight, tickToBaseX } from "@/sing/viewHelper";
import { getMeasureDuration, getNoteDuration } from "@/sing/domain";

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const zoomX = computed(() => store.state.sequencerZoomX);
const zoomY = computed(() => store.state.sequencerZoomY);
const gridCellTicks = computed(() => {
  return getNoteDuration(store.state.sequencerSnapType, tpqn.value);
});
const gridCellWidth = computed(() => {
  return tickToBaseX(gridCellTicks.value, tpqn.value) * zoomX.value;
});
const gridCellBaseHeight = getKeyBaseHeight();
const gridCellHeight = computed(() => {
  return gridCellBaseHeight * zoomY.value;
});
const beatsPerMeasure = computed(() => {
  return timeSignatures.value[0].beats;
});
const beatWidth = computed(() => {
  const beatType = timeSignatures.value[0].beatType;
  const wholeNoteDuration = tpqn.value * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn.value) * zoomX.value;
});
const gridWidth = computed(() => {
  // TODO: 複数拍子に対応する
  const beats = timeSignatures.value[0].beats;
  const beatType = timeSignatures.value[0].beatType;
  const measureDuration = getMeasureDuration(beats, beatType, tpqn.value);
  const numMeasures = store.getters.SEQUENCER_NUM_MEASURES;
  const numOfGridColumns =
    Math.round(measureDuration / gridCellTicks.value) * numMeasures;
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

.sequencer-grid-cell {
  display: block;
  stroke: rgba(colors.$sequencer-sub-divider-rgb, 0.3);
  stroke-width: 1;
}

.sequencer-grid-octave-cell {
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-octave-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-cell-white {
  fill: colors.$sequencer-whitekey-cell;
}

.sequencer-grid-cell-black {
  fill: colors.$sequencer-blackkey-cell;
}

.sequencer-grid-measure-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-beat-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-sub-divider;
}
</style>
