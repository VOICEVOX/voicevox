<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width
    :height
    shape-rendering="crispEdges"
    class="grid-lane"
  >
    <defs>
      <pattern
        v-for="(gridPattern, patternIndex) in gridPatterns"
        :id="`grid-lane-measure-${patternIndex}`"
        :key="`pattern-${patternIndex}`"
        patternUnits="userSpaceOnUse"
        :x="-offset + gridPattern.x"
        :width="gridPattern.patternWidth"
        :height
      >
        <!-- 拍線（小節の最初を除く） -->
        <line
          v-for="n in gridPattern.beatsPerMeasure"
          :key="n"
          :x1="gridPattern.beatWidth * n"
          :x2="gridPattern.beatWidth * n"
          y1="32"
          :y2="height"
          class="grid-lane-beat-line"
        />
      </pattern>
    </defs>
    <rect
      v-for="(gridPattern, index) in gridPatterns"
      :key="`grid-${index}`"
      :x="0.5 + gridPattern.x - offset"
      y="0"
      :height
      :width="gridPattern.width"
      :fill="`url(#grid-lane-measure-${index})`"
    />
    <!-- 小節線と小節番号 -->
    <template v-for="measureInfo in measureInfos" :key="measureInfo.number">
      <line
        :x1="measureInfo.x - offset"
        :x2="measureInfo.x - offset"
        y1="0"
        :y2="height"
        class="grid-lane-measure-line"
        :class="{ 'first-measure-line': measureInfo.number === 1 }"
      />
      <text
        :x="measureInfo.x - offset + 4"
        y="20"
        class="grid-lane-measure-number"
      >
        {{ measureInfo.number }}
      </text>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { TimeSignature } from "@/domain/project/type";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";
import type { MeasureInfo } from "@/composables/useSequencerLayout";

defineOptions({
  name: "GridLanePresentation",
});

const props = defineProps<{
  tpqn: number;
  sequencerZoomX: number;
  numMeasures: number;
  timeSignatures: TimeSignature[];
  offset: number;
  width: number;
  totalTicks: number;
  tsPositions: number[];
  measureInfos: MeasureInfo[];
}>();

const height = ref(40);

const gridPatterns = useSequencerGrid({
  timeSignatures: computed(() => props.timeSignatures),
  tpqn: computed(() => props.tpqn),
  sequencerZoomX: computed(() => props.sequencerZoomX),
  numMeasures: computed(() => props.numMeasures),
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.grid-lane-beat-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-beat-line);
  stroke-width: 1px;
}

.grid-lane-measure-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-measure-line);
  stroke-width: 1px;

  // NOTE: 最初の小節線を非表示。必要に応じて再表示・位置合わせする
  &.first-measure-line {
    stroke: var(--scheme-color-sing-ruler-surface);
  }
}

.grid-lane-measure-number {
  font-size: 12px;
  font-weight: bold;
  fill: var(--scheme-color-on-surface-variant);
  user-select: none;
}
</style>
