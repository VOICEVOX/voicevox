<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="gridWidth"
    :height="gridHeight"
    class="sequencer-grid"
    shape-rendering="crispEdges"
  >
    <defs>
      <pattern
        id="sequencer-grid-pattern-background"
        patternUnits="userSpaceOnUse"
        :x="0"
        :width="gridCellWidth"
        :height="gridCellHeight * 12"
      >
        <!-- セルの背景 -->
        <rect
          v-for="(keyInfo, index) in keyInfos"
          :key="`cell-${index}`"
          x="0"
          :y="gridCellHeight * index"
          :width="gridCellWidth"
          :height="gridCellHeight * 12"
          :class="`sequencer-grid-cell sequencer-grid-cell-${keyInfo.color}`"
        />
        <!-- スナップグリッド線 -->
        <line
          :x1="gridCellWidth"
          :x2="gridCellWidth"
          y1="0"
          :y2="gridCellHeight * 12"
          class="sequencer-grid-vertical-line"
        />
      </pattern>
      <pattern
        v-for="(pattern, patternIndex) in gridPatterns"
        :id="`sequencer-grid-pattern-${patternIndex}`"
        :key="`pattern-${patternIndex}`"
        patternUnits="userSpaceOnUse"
        :x="pattern.x"
        :width="pattern.patternWidth"
        :height="gridCellHeight * 12"
      >
        <!-- E/Fの中間線 -->
        <line
          v-for="index in horizontalLineIndices"
          :key="`horizontal-${index}`"
          x1="0"
          :x2="pattern.patternWidth"
          :y1="gridCellHeight * (index + 1)"
          :y2="gridCellHeight * (index + 1)"
          class="sequencer-grid-horizontal-line"
        />
        <!-- 拍線 -->
        <line
          v-for="n in pattern.timeSignature.beats"
          :key="`beatline-${n}`"
          :x1="pattern.beatWidth * n"
          :x2="pattern.beatWidth * n"
          y1="0"
          :y2="gridCellHeight * 12"
          class="sequencer-grid-beat-line"
        />
      </pattern>
    </defs>
    <!-- グリッド背景 -->
    <rect
      x="0"
      y="0"
      :width="gridWidth"
      :height="gridHeight"
      :fill="`url(#sequencer-grid-pattern-background)`"
    />
    <!-- グリッドパターン -->
    <rect
      v-for="gridPattern in gridPatterns"
      :key="`grid-${gridPattern.id}`"
      :x="gridPattern.x"
      y="0"
      :width="gridPattern.width"
      :height="gridHeight"
      :fill="`url(#${gridPattern.id})`"
    />
    <!-- オクターブ線（グリッドの上に描画） -->
    <line
      v-for="index in octaveLineIndices"
      :key="`octave-${index}`"
      x1="0"
      :x2="gridWidth"
      :y1="gridCellHeight * (index + 1)"
      :y2="gridCellHeight * (index + 1)"
      class="sequencer-grid-octave-line"
    />
    <!-- 小節線（グリッドおよびオクターブ線の上に描画） -->
    <line
      v-for="x in measureLines"
      :key="`measureline-${x}`"
      :x1="x"
      :x2="x"
      y1="0"
      :y2="gridHeight"
      class="sequencer-grid-measure-line"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import { keyInfos, getKeyBaseHeight, tickToBaseX } from "@/sing/viewHelper";
import { getMeasureDuration, getNoteDuration } from "@/sing/domain";
import { TimeSignature } from "@/store/type";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";

const props = defineProps<{
  tpqn: number;
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  sequencerZoomY: number;
  sequencerSnapType: number;
  numMeasures: number;
}>();

const gridCellTicks = computed(() => {
  return getNoteDuration(props.sequencerSnapType, props.tpqn);
});
const gridCellWidth = computed(() => {
  return tickToBaseX(gridCellTicks.value, props.tpqn) * props.sequencerZoomX;
});
const gridCellBaseHeight = getKeyBaseHeight();
const gridCellHeight = computed(() => {
  return gridCellBaseHeight * props.sequencerZoomY;
});
const beatWidth = (timeSignature: TimeSignature) => {
  const beatType = timeSignature.beatType;
  const wholeNoteDuration = props.tpqn * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, props.tpqn) * props.sequencerZoomX;
};

const gridWidth = computed(() => {
  let numOfGridColumns = 0;
  for (const [i, timeSignature] of props.timeSignatures.entries()) {
    const nextTimeSignature = props.timeSignatures[i + 1];
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? props.numMeasures + 1;
    const beats = timeSignature.beats;
    const beatType = timeSignature.beatType;
    const measureDuration = getMeasureDuration(beats, beatType, props.tpqn);
    numOfGridColumns +=
      Math.round(measureDuration / gridCellTicks.value) *
      (nextMeasureNumber - timeSignature.measureNumber);
  }
  return gridCellWidth.value * numOfGridColumns;
});
const gridHeight = computed(() => {
  return gridCellHeight.value * keyInfos.length;
});

const gridPatterns = useSequencerGrid({
  timeSignatures: toRef(() => props.timeSignatures),
  tpqn: toRef(() => props.tpqn),
  sequencerZoomX: toRef(() => props.sequencerZoomX),
  numMeasures: toRef(() => props.numMeasures),
});

// 小節幅
const measureWidth = (timeSignature: TimeSignature) =>
  beatWidth(timeSignature) * timeSignature.beats;

// グリッド線の計算
// オクターブ線や小節線と重なる線は除外
const gridLines = computed(() => {
  return keyInfos.reduce<{
    horizontalLines: number[];
    octaveLines: number[];
  }>(
    (acc, keyInfo, index) => {
      if (keyInfo.pitch === "F") acc.horizontalLines.push(index);
      else if (keyInfo.pitch === "C") acc.octaveLines.push(index);
      return acc;
    },
    { horizontalLines: [], octaveLines: [] },
  );
});
const measureLines = computed(() => {
  const measureLines = [0];
  for (const [i, timeSignature] of props.timeSignatures.entries()) {
    const nextTimeSignature = props.timeSignatures.at(i + 1);
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? props.numMeasures + 1;
    const width = measureWidth(timeSignature);

    const left = measureLines[measureLines.length - 1];
    for (
      let measureNumber = timeSignature.measureNumber;
      measureNumber < nextMeasureNumber;
      measureNumber++
    ) {
      measureLines.push(
        left + width * (measureNumber - timeSignature.measureNumber + 1),
      );
    }
  }
  return measureLines;
});
const horizontalLineIndices = computed(() => gridLines.value.horizontalLines);
const octaveLineIndices = computed(() => gridLines.value.octaveLines);
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
  stroke: 0;
}

.sequencer-grid-cell-white {
  fill: var(--scheme-color-sing-grid-cell-white);
}

.sequencer-grid-cell-black {
  fill: var(--scheme-color-sing-grid-cell-black);
}

.sequencer-grid-vertical-line {
  stroke: var(--scheme-color-sing-grid-vertical-line);
  stroke-width: 1px;
}

.sequencer-grid-horizontal-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-grid-horizontal-line);
  stroke-width: 1px;
}

.sequencer-grid-octave-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-grid-octave-line);
  stroke-width: 1px;
}

.sequencer-grid-measure-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-grid-measure-line);
  stroke-width: 1px;
}

.sequencer-grid-beat-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-grid-beat-line);
  stroke-width: 1px;
}

.edit-pitch {
  .sequencer-grid-vertical-line {
    stroke: transparent;
  }

  .sequencer-grid-horizontal-line {
    stroke: var(--scheme-color-sing-grid-horizontal-line);
  }

  .sequencer-grid-measure-line {
    stroke: var(--scheme-color-sing-grid-beat-line);
  }

  .sequencer-grid-octave-line {
    stroke: var(--scheme-color-sing-grid-beat-line);
  }

  .sequencer-grid-beat-line {
    stroke: transparent;
  }
}
</style>
