<template>
  <div ref="sequencerRuler" class="sequencer-ruler" @click="onClick">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height
      shape-rendering="crispEdges"
    >
      <defs>
        <pattern
          id="sequencer-ruler-measure"
          patternUnits="userSpaceOnUse"
          :x="-offset % (beatWidth * beatsPerMeasure)"
          :width="beatWidth * beatsPerMeasure"
          :height
        >
          <!-- 拍線（小節の最初を除く） -->
          <line
            v-for="n in beatsPerMeasure - 1"
            :key="n"
            :x1="beatWidth * n"
            :x2="beatWidth * n"
            y1="28"
            :y2="height"
            class="sequencer-ruler-beat-line"
          />
        </pattern>
      </defs>
      <rect :width :height fill="url(#sequencer-ruler-measure)" />
      <!-- 小節線 -->
      <line
        v-for="measureInfo in measureInfos"
        :key="measureInfo.number"
        :x1="measureInfo.x - offset"
        :x2="measureInfo.x - offset"
        y1="20"
        :y2="height"
        class="sequencer-ruler-measure-line"
      />
      <!-- 小節番号 -->
      <text
        v-for="measureInfo in measureInfos"
        :key="measureInfo.number"
        font-size="12"
        :x="measureInfo.x - offset + 4"
        y="34"
        class="sequencer-ruler-measure-number"
      >
        {{ measureInfo.number }}
      </text>
    </svg>
    <div class="sequencer-ruler-border-bottom"></div>
    <div
      class="sequencer-ruler-playhead"
      :style="{
        transform: `translateX(${playheadX - offset}px)`,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { getMeasureDuration, getTimeSignaturePositions } from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";

const props = withDefaults(
  defineProps<{
    offset: number;
    numMeasures: number;
  }>(),
  {
    offset: 0,
    numMeasures: 32,
  },
);
const store = useStore();
const state = store.state;
const height = ref(40);
const playheadTicks = ref(0);
const tpqn = computed(() => state.tpqn);
const timeSignatures = computed(() => state.timeSignatures);
const zoomX = computed(() => state.sequencerZoomX);
const beatsPerMeasure = computed(() => {
  return timeSignatures.value[0].beats;
});
const beatWidth = computed(() => {
  const beatType = timeSignatures.value[0].beatType;
  const wholeNoteDuration = tpqn.value * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn.value) * zoomX.value;
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
      (props.numMeasures - lastTs.measureNumber + 1)
  );
});
const width = computed(() => {
  return tickToBaseX(endTicks.value, tpqn.value) * zoomX.value;
});
// measureInfosの計算を調整
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
      tpqn.value,
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
        x: Math.round(baseX * zoomX.value),
      });
      measureNumber++;
      measurePosition += measureDuration;
    }
  }
  return measureInfos;
});
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, tpqn.value);
  return Math.floor(baseX * zoomX.value);
});

const onClick = (event: MouseEvent) => {
  store.dispatch("DESELECT_ALL_NOTES");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const baseX = (props.offset + event.offsetX) / zoomX.value;
  const ticks = baseXToTick(baseX, tpqn.value);
  store.dispatch("SET_PLAYHEAD_POSITION", { position: ticks });
};

const sequencerRuler = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;

const playheadPositionChangeListener = (position: number) => {
  playheadTicks.value = position;
};

onMounted(() => {
  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  resizeObserver = new ResizeObserver((entries) => {
    let blockSize = 0;
    for (const entry of entries) {
      for (const borderBoxSize of entry.borderBoxSize) {
        blockSize = borderBoxSize.blockSize;
      }
    }
    if (blockSize > 0 && blockSize !== height.value) {
      height.value = blockSize;
    }
  });
  resizeObserver.observe(sequencerRulerElement);

  store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();

  store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-ruler {
  background: var(--scheme-color-surface-container-highest);
  height: 40px;
  position: relative;
  overflow: hidden;
}

.sequencer-ruler-playhead {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
  will-change: transform;
}

.sequencer-ruler-measure-number {
  fill: var(--scheme-color-on-surface-variant);
}

.sequencer-ruler-measure-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-measure-line);
  stroke-width: 1px;
}

.sequencer-ruler-beat-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-beat-line);
  stroke-width: 1px;
}
</style>
