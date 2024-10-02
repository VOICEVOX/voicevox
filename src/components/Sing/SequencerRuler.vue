<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="gridWidth"
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
      <rect
        x="0.5"
        y="0"
        :width="gridWidth"
        :height
        fill="url(#sequencer-ruler-measure)"
      />
      <!-- ループエリア外を暗くする -->
      <g v-if="isLoopEnabled && loopStartTick !== loopEndTick">
        <!-- 左側 -->
        <rect
          x="0"
          y="0"
          :width="Math.max(0, loopStartX - offset)"
          :height
          class="sequencer-ruler-loop-mask"
          pointer-events="none"
        />
        <!-- 右側 -->
        <rect
          :x="Math.max(0, loopEndX - offset)"
          y="0"
          :width="Math.max(0, gridWidth - (loopEndX - offset))"
          :height
          class="sequencer-ruler-loop-mask"
          pointer-events="none"
        />
      </g>
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
    <SequencerLoopControl ref="loopControl" :width="gridWidth" :offset />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { getMeasureDuration, getTimeSignaturePositions } from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import SequencerLoopControl from "@/components/Sing/SequencerLoopControl.vue";
import { useLoopControl } from "@/composables/useLoopControl";

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
const { isLoopEnabled, loopStartTick, loopEndTick } = useLoopControl();
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
const gridWidth = computed(() => {
  return tickToBaseX(endTicks.value, tpqn.value) * zoomX.value;
});
const measureInfos = computed(() => {
  return timeSignatures.value.flatMap((timeSignature, i) => {
    const measureDuration = getMeasureDuration(
      timeSignature.beats,
      timeSignature.beatType,
      tpqn.value,
    );
    const nextTsPosition =
      i !== timeSignatures.value.length - 1
        ? tsPositions.value[i + 1]
        : endTicks.value;
    const start = tsPositions.value[i];
    const end = nextTsPosition;
    const numMeasures = Math.floor((end - start) / measureDuration);
    return Array.from({ length: numMeasures }, (_, index) => {
      const measureNumber = timeSignature.measureNumber + index;
      const measurePosition = start + index * measureDuration;
      const baseX = tickToBaseX(measurePosition, tpqn.value);
      return {
        number: measureNumber,
        x: Math.round(baseX * zoomX.value),
      };
    });
  });
});
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, tpqn.value);
  return Math.floor(baseX * zoomX.value);
});

// ループのX座標を計算
const loopStartX = computed(() => {
  return tickToBaseX(loopStartTick.value, tpqn.value) * zoomX.value;
});
const loopEndX = computed(() => {
  return tickToBaseX(loopEndTick.value, tpqn.value) * zoomX.value;
});

const onClick = (event: MouseEvent) => {
  void store.dispatch("DESELECT_ALL_NOTES");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const baseX = (props.offset + event.offsetX) / zoomX.value;
  const ticks = baseXToTick(baseX, tpqn.value);
  void store.dispatch("SET_PLAYHEAD_POSITION", { position: ticks });
};

const onContextMenu = (event: MouseEvent) => {
  event.preventDefault();
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

  void store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();

  void store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
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

.sequencer-ruler-border-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--scheme-color-sing-ruler-border);
}

.sequencer-ruler-loop-mask {
  fill: var(--scheme-color-scrim);
  opacity: 0.16;
}
</style>
