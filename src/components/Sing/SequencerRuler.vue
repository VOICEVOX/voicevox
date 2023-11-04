<template>
  <div class="sequencer-ruler">
    <svg xmlns="http://www.w3.org/2000/svg" :width="width" :height="height">
      <defs>
        <pattern
          id="sequencer-ruler-measure"
          patternUnits="userSpaceOnUse"
          :x="-offset"
          :width="measureWidth"
          :height="height"
        >
          <line
            x1="0"
            x2="0"
            y1="0"
            :y2="height"
            stroke-width="1"
            class="sequencer-ruler-measure-line"
          />
          <line
            :x1="measureWidth"
            :x2="measureWidth"
            y1="0"
            :y2="height"
            stroke-width="1"
            class="sequencer-ruler-measure-line"
          />
        </pattern>
        <symbol id="sequencer-ruler-measure-numbers">
          <text
            v-for="measureInfo in measureInfos"
            :key="measureInfo.number"
            font-size="14"
            :x="measureInfo.x + 6"
            y="18"
            class="sequencer-ruler-measure-number"
          >
            {{ measureInfo.number }}
          </text>
        </symbol>
      </defs>
      <rect
        :width="width"
        :height="height"
        fill="url(#sequencer-ruler-measure)"
      />
      <use href="#sequencer-ruler-measure-numbers" :x="-offset" />
    </svg>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import {
  getMeasureDuration,
  getTimeSignaturePositions,
  tickToBaseX,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerRuler",
  props: {
    offset: { type: Number, default: 0 },
    height: { type: Number, default: 32 },
    numOfMeasures: { type: Number, default: 32 },
  },
  setup(props) {
    const store = useStore();
    const state = store.state;
    const tpqn = computed(() => state.score.tpqn);
    const timeSignatures = computed(() => state.score.timeSignatures);
    const zoomX = computed(() => state.sequencerZoomX);
    const measureWidth = computed(() => {
      const measureDuration = getMeasureDuration(
        timeSignatures.value[0].beats,
        timeSignatures.value[0].beatType,
        tpqn.value
      );
      return tickToBaseX(measureDuration, tpqn.value) * zoomX.value;
    });
    const tsPositions = computed(() => {
      return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
    });
    const endTicks = computed(() => {
      const lastTs = timeSignatures.value[timeSignatures.value.length - 1];
      const lastTsPosition = tsPositions.value[tsPositions.value.length - 1];
      return (
        lastTsPosition +
        getMeasureDuration(lastTs.beats, lastTs.beatType, tpqn.value) *
          (props.numOfMeasures - lastTs.measureNumber + 1)
      );
    });
    const width = computed(() => {
      return tickToBaseX(endTicks.value, tpqn.value) * zoomX.value;
    });
    const measureInfos = computed(() => {
      const measureInfos: {
        number: number;
        x: number;
      }[] = [];
      for (let i = 0; i < timeSignatures.value.length; i++) {
        const ts = timeSignatures.value[i];
        const measureDuration = getMeasureDuration(
          ts.beats,
          ts.beatType,
          tpqn.value
        );
        const nextTsPosition =
          i !== timeSignatures.value.length - 1
            ? tsPositions.value[i + 1]
            : undefined;
        let measureNumber = ts.measureNumber;
        let measurePosition = tsPositions.value[i];
        while (measurePosition < (nextTsPosition ?? endTicks.value)) {
          const baseX = tickToBaseX(measurePosition, tpqn.value);
          measureInfos.push({
            number: measureNumber,
            x: Math.floor(baseX * zoomX.value),
          });
          measureNumber++;
          measurePosition += measureDuration;
        }
      }
      return measureInfos;
    });

    return {
      measureWidth,
      width,
      measureInfos,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sequencer-ruler {
  background: colors.$background;
  border-bottom: 1px solid #ccc;
  overflow: hidden;
}

.sequencer-ruler-measure-number {
  fill: #555;
}

.sequencer-ruler-measure-line {
  backface-visibility: hidden;
  stroke: #b0b0b0;
}
</style>
