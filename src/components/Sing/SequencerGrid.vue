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
        id="sequencer-grid-pattern"
        patternUnits="userSpaceOnUse"
        :width="beatWidth * beatsPerMeasure"
        :height="gridCellHeight * 12"
      >
        <!-- セルの背景 -->
        <rect
          v-for="(keyInfo, index) in keyInfos"
          :key="`cell-${index}`"
          x="0"
          :y="gridCellHeight * index"
          :width="beatWidth * beatsPerMeasure"
          :height="gridCellHeight"
          :class="`sequencer-grid-cell sequencer-grid-cell-${keyInfo.color}`"
        />
        <!-- スナップグリッド線 -->
        <line
          v-for="x in snapLinePositions"
          :key="`snapline-${x}`"
          :x1="x"
          :x2="x"
          y1="0"
          :y2="gridCellHeight * 12"
          class="sequencer-grid-vertical-line"
        />
        <!-- E/Fの中間線 -->
        <line
          v-for="index in horizontalLineIndices"
          :key="`horizontal-${index}`"
          x1="0"
          :x2="beatWidth * beatsPerMeasure"
          :y1="gridCellHeight * (index + 1)"
          :y2="gridCellHeight * (index + 1)"
          class="sequencer-grid-horizontal-line"
        />
        <!-- 拍線 -->
        <line
          v-for="n in beatLineIndices"
          :key="`beatline-${n}`"
          :x1="beatWidth * n"
          :x2="beatWidth * n"
          y1="0"
          :y2="gridCellHeight * 12"
          class="sequencer-grid-beat-line"
        />
      </pattern>
    </defs>
    <!-- グリッドパターン背景 -->
    <rect
      x="0"
      y="0"
      :width="gridWidth"
      :height="gridHeight"
      fill="url(#sequencer-grid-pattern)"
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
      v-for="n in numberOfMeasureLines"
      :key="`measureline-${n}`"
      :x1="beatWidth * beatsPerMeasure * n"
      :x2="beatWidth * beatsPerMeasure * n"
      y1="0"
      :y2="gridHeight"
      class="sequencer-grid-measure-line"
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
// 小節幅
const measureWidth = computed(() => beatWidth.value * beatsPerMeasure.value);
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
const numberOfMeasureLines = computed(() =>
  Math.ceil(gridWidth.value / measureWidth.value),
);
const horizontalLineIndices = computed(() => gridLines.value.horizontalLines);
const octaveLineIndices = computed(() => gridLines.value.octaveLines);
const beatLineIndices = computed(() =>
  Array.from({ length: beatsPerMeasure.value - 1 }, (_, i) => i + 1),
);
const snapLinePositions = computed(() => {
  const snapTicks = gridCellTicks.value;
  const measureTicks =
    (tpqn.value * 4 * beatsPerMeasure.value) / timeSignatures.value[0].beatType;
  const snapPositions = [];
  let currentTick = 0;
  while (currentTick < measureTicks) {
    const x = (currentTick / measureTicks) * measureWidth.value;
    snapPositions.push(x);
    currentTick += snapTicks;
  }
  return snapPositions;
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
