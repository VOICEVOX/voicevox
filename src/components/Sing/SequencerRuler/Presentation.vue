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
      <rect x="0.5" y="0" :width :height fill="url(#sequencer-ruler-measure)" />
      <!-- 小節線 -->
      <line
        v-for="measureInfo in measureInfos"
        :key="measureInfo.number"
        :x1="measureInfo.x - offset"
        :x2="measureInfo.x - offset"
        y1="20"
        :y2="height"
        class="sequencer-ruler-measure-line"
        :class="{ 'first-measure-line': measureInfo.number === 1 }"
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
import { getMeasureDuration, getTimeSignaturePositions } from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { TimeSignature } from "@/store/type";

const props = defineProps<{
  offset: number;
  numMeasures: number;

  tpqn: number;
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
}>();
const playheadTicks = defineModel<number>("playheadTicks", { required: true });
const emit = defineEmits<{
  deselectAllNotes: [];
}>();

const height = ref(40);
const timeSignatures = computed(() => props.timeSignatures);
const beatsPerMeasure = computed(() => {
  return props.timeSignatures[0].beats;
});
const beatWidth = computed(() => {
  const beatType = props.timeSignatures[0].beatType;
  const wholeNoteDuration = props.tpqn * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, props.tpqn) * props.sequencerZoomX;
});
const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});
const endTicks = computed(() => {
  const lastTs = props.timeSignatures[timeSignatures.value.length - 1];
  const lastTsPosition = tsPositions.value[tsPositions.value.length - 1];
  return (
    lastTsPosition +
    getMeasureDuration(lastTs.beats, lastTs.beatType, props.tpqn) *
      (props.numMeasures - lastTs.measureNumber + 1)
  );
});
const width = computed(() => {
  return tickToBaseX(endTicks.value, props.tpqn) * props.sequencerZoomX;
});
const measureInfos = computed(() => {
  return props.timeSignatures.flatMap((timeSignature, i) => {
    const measureDuration = getMeasureDuration(
      timeSignature.beats,
      timeSignature.beatType,
      props.tpqn,
    );
    const nextTsPosition =
      i !== props.timeSignatures.length - 1
        ? tsPositions.value[i + 1]
        : endTicks.value;
    const start = tsPositions.value[i];
    const end = nextTsPosition;
    const numMeasures = Math.floor((end - start) / measureDuration);
    return Array.from({ length: numMeasures }, (_, index) => {
      const measureNumber = timeSignature.measureNumber + index;
      const measurePosition = start + index * measureDuration;
      const baseX = tickToBaseX(measurePosition, props.tpqn);
      return {
        number: measureNumber,
        x: Math.round(baseX * props.sequencerZoomX),
      };
    });
  });
});
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, props.tpqn);
  return Math.floor(baseX * props.sequencerZoomX);
});

const onClick = (event: MouseEvent) => {
  emit("deselectAllNotes");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const baseX = (props.offset + event.offsetX) / props.sequencerZoomX;
  const ticks = baseXToTick(baseX, props.tpqn);
  playheadTicks.value = ticks;
};

const sequencerRuler = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;

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
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-ruler {
  background: var(--scheme-color-sing-ruler-surface);
  height: 40px;
  position: relative;
  overflow: hidden;
}

.sequencer-ruler-playhead {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
  will-change: transform;
  z-index: vars.$z-index-sing-playhead;
}

.sequencer-ruler-measure-number {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);
}

.sequencer-ruler-measure-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-measure-line);
  stroke-width: 1px;

  // NOTE: 最初の小節線を非表示。必要に応じて再表示・位置合わせする
  &.first-measure-line {
    stroke: var(--scheme-color-sing-ruler-surface);
  }
}

.sequencer-ruler-beat-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-beat-line);
  stroke-width: 1px;
}
</style>
