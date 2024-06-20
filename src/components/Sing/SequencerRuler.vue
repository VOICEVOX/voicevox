<template>
  <div ref="sequencerRuler" class="sequencer-ruler" @click="onClick">
    <svg xmlns="http://www.w3.org/2000/svg" :width :height>
      <defs>
        <pattern
          id="sequencer-ruler-measure"
          patternUnits="userSpaceOnUse"
          :x="-offset"
          :width="beatWidth * beatsPerMeasure"
          :height
        >
          <line
            v-for="n in beatsPerMeasure"
            :key="n"
            :x1="beatWidth * (n - 1)"
            :x2="beatWidth * (n - 1)"
            :y1="n === 1 ? 16 : 24"
            y2="100%"
            stroke-width="1"
            :class="`sequencer-ruler-${n === 1 ? 'measure' : 'beat'}-line`"
          />
        </pattern>
        <symbol id="sequencer-ruler-measure-numbers">
          <text
            v-for="measureInfo in measureInfos"
            :key="measureInfo.number"
            font-size="12"
            :x="measureInfo.x + 4"
            y="20"
            class="sequencer-ruler-measure-number"
          >
            {{ measureInfo.number }}
          </text>
        </symbol>
      </defs>
      <rect :width :height fill="url(#sequencer-ruler-measure)" />
      <use href="#sequencer-ruler-measure-numbers" :x="-offset" />
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
const height = ref(32);
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
        x: Math.floor(baseX * zoomX.value),
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
  background: colors.$background;
  position: relative;
  overflow: hidden;
}

.sequencer-ruler-border-bottom {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-top: 1px solid colors.$sequencer-sub-divider;
  border-bottom: 1px solid colors.$sequencer-sub-divider;
}

.sequencer-ruler-playhead {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 100%;
  background: rgba(colors.$display-rgb, 0.6);
  pointer-events: none;
  will-change: transform;
}

.sequencer-ruler-measure-number {
  fill: colors.$display;
}

.sequencer-ruler-measure-line {
  backface-visibility: hidden;
  stroke: rgba(colors.$display-rgb, 0.5);
}

.sequencer-ruler-beat-line {
  backface-visibility: hidden;
  stroke: rgba(colors.$display-rgb, 0.25);
}
</style>
