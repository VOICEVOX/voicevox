<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    :data-ui-locked="uiLocked"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <slot
      name="contextMenu"
      :header="contextMenuHeader"
      :menudata="contextMenudata"
      :onContextMenuMounted="(el) => (contextMenu = el)"
    />
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height
      shape-rendering="crispEdges"
    >
      <defs>
        <pattern
          v-for="(timeSignature, tsIndex) in timeSignatures"
          :id="`sequencer-ruler-measure-${tsIndex}`"
          :key="`pattern-${tsIndex}`"
          patternUnits="userSpaceOnUse"
          :x="-offset + gridPatterns[tsIndex].x"
          :width="beatWidth(timeSignature) * beatsPerMeasure(timeSignature)"
          :height
        >
          <!-- 拍線（小節の最初を除く） -->
          <line
            v-for="n in beatsPerMeasure(timeSignature)"
            :key="n"
            :x1="beatWidth(timeSignature) * n"
            :x2="beatWidth(timeSignature) * n"
            y1="28"
            :y2="height"
            class="sequencer-ruler-beat-line"
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
        :fill="`url(#sequencer-ruler-measure-${index})`"
      />
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
      <!-- BPM・拍子表示 -->
      <template
        v-for="tempoOrTimeSignatureChange in tempoOrTimeSignatureChanges"
        :key="tempoOrTimeSignatureChange.position"
      >
        <text
          font-size="12"
          :x="tempoOrTimeSignatureChange.x - offset + 4"
          y="16"
          class="sequencer-ruler-tempo-or-time-signature-change"
          @click.stop="
            onTempoOrTimeSignatureChangeClick(
              $event,
              tempoOrTimeSignatureChange,
            )
          "
        >
          {{ tempoOrTimeSignatureChange.text }}
        </text>
        <line
          :x1="tempoOrTimeSignatureChange.x - offset"
          :x2="tempoOrTimeSignatureChange.x - offset"
          y1="0"
          :y2="height"
          class="sequencer-ruler-tempo-or-time-signature-change-line"
        />
      </template>
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
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  ExtractPropTypes,
  ComponentPublicInstance,
  useTemplateRef,
} from "vue";
import { ComponentProps } from "vue-component-type-helpers";
import { Dialog } from "quasar";
import {
  getMeasureDuration,
  getNoteDuration,
  getTimeSignaturePositions,
  ticksToMeasuresBeats,
  tickToMeasureNumber,
} from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { Tempo, TimeSignature } from "@/store/type";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";
import { UnreachableError } from "@/type/utility";
import TempoOrTimeSignatureChangeDialog, {
  TempoOrTimeSignatureChangeDialogResult,
} from "@/components/Dialog/TempoOrTimeSignatureChangeDialog.vue";

const props = defineProps<{
  offset: number;
  numMeasures: number;
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  snapType: number;

  uiLocked: boolean;
}>();
const playheadTicks = defineModel<number>("playheadTicks", {
  required: true,
});
const emit = defineEmits<{
  deselectAllNotes: [];

  setTempo: [tempo: Tempo];
  removeTempo: [position: number];
  setTimeSignature: [timeSignature: TimeSignature];
  removeTimeSignature: [measureNumber: number];
}>();
defineSlots<{
  contextMenu(
    props: ComponentProps<typeof ContextMenu> & {
      onContextMenuMounted: (
        el: ComponentPublicInstance<typeof ContextMenu>,
      ) => void;
    },
  ): never;
}>();

const height = ref(40);
const beatsPerMeasure = (timeSignature: TimeSignature) => timeSignature.beats;
const beatWidth = (timeSignature: TimeSignature) => {
  const beatType = timeSignature.beatType;
  const wholeNoteDuration = props.tpqn * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, props.tpqn) * props.sequencerZoomX;
};
const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});
const endTicks = computed(() => {
  const lastTs = props.timeSignatures[props.timeSignatures.length - 1];
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
const gridPatterns = computed(() => {
  const gridPatterns: { id: string; x: number; width: number }[] = [];
  for (const [i, timeSignature] of props.timeSignatures.entries()) {
    const nextTimeSignature = props.timeSignatures[i + 1];
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? props.numMeasures + 1;
    gridPatterns.push({
      id: `sequencer-grid-pattern-${i}`,
      x:
        gridPatterns.length === 0
          ? 0
          : gridPatterns[gridPatterns.length - 1].x +
            gridPatterns[gridPatterns.length - 1].width,
      width:
        beatWidth(timeSignature) *
        beatsPerMeasure(timeSignature) *
        (nextMeasureNumber - timeSignature.measureNumber),
    });
  }

  return gridPatterns;
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

const getTickFromMouseEvent = (event: MouseEvent) => {
  const baseX = (props.offset + event.offsetX) / props.sequencerZoomX;
  return baseXToTick(baseX, props.tpqn);
};

const onClick = async (event: MouseEvent) => {
  if (props.uiLocked) {
    return;
  }
  emit("deselectAllNotes");

  const ticks = getTickFromMouseEvent(event);
  playheadTicks.value = ticks;
};

const sequencerRuler = useTemplateRef<HTMLDivElement>("sequencerRuler");
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

const contextMenu = ref<ComponentPublicInstance<typeof ContextMenu> | null>(
  null,
);
const onContextMenu = async (event: MouseEvent) => {
  emit("deselectAllNotes");

  const ticks = getTickFromMouseEvent(event);
  const snapTicks = getNoteDuration(props.snapType, props.tpqn);
  const snappedTicks = Math.round(ticks / snapTicks) * snapTicks;
  playheadTicks.value = snappedTicks;
};

type TempoOrTimeSignatureChange = {
  position: number;
  text: string;
  x: number;
};

const onTempoOrTimeSignatureChangeClick = async (
  event: MouseEvent,
  tempoOrTimeSignatureChange: TempoOrTimeSignatureChange,
) => {
  const ticks = tempoOrTimeSignatureChange.position;
  playheadTicks.value = ticks;
  contextMenu.value?.show(event);
};

const currentMeasure = computed(() =>
  tickToMeasureNumber(playheadTicks.value, props.timeSignatures, props.tpqn),
);

const tempoOrTimeSignatureChanges = computed<TempoOrTimeSignatureChange[]>(
  () => {
    const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => {
      return {
        position: tsPosition,
        timeSignature: props.timeSignatures[i],
      };
    });
    const tempos = props.tempos.map((tempo) => {
      return {
        position: tempo.position,
        tempo,
      };
    });
    const ticks = new Set([
      ...timeSignaturesWithTicks.map((ts) => ts.position),
      ...tempos.map((tempo) => tempo.position),
    ]);
    const sortedTicks = Array.from(ticks).sort((a, b) => a - b);
    const result: {
      position: number;
      text: string;
      x: number;
    }[] = sortedTicks.map((tick) => {
      const tempo = tempos.find((tempo) => tempo.position === tick);
      const timeSignature = timeSignaturesWithTicks.find(
        (ts) => ts.position === tick,
      );

      return {
        position: tick,
        text: `${tempo?.tempo.bpm ?? ""} ${timeSignature ? `${timeSignature.timeSignature.beats}/${timeSignature.timeSignature.beatType}` : ""}`,
        x: tickToBaseX(tick, props.tpqn) * props.sequencerZoomX,
      };
    });

    return result;
  },
);

const lastTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!maybeTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }
  return maybeTempo;
});
const lastTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= currentMeasure.value;
  });
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: At least one time signature exists.");
  }
  return maybeTimeSignature;
});
const tempoChangeExists = computed(
  () => lastTempo.value.position === playheadTicks.value,
);
const timeSignatureChangeExists = computed(
  () => lastTimeSignature.value.measureNumber === currentMeasure.value,
);

const contextMenuHeader = computed(() => {
  const measuresBeats = ticksToMeasuresBeats(
    playheadTicks.value,
    props.timeSignatures.map((ts, i) => ({
      ...ts,
      position: tsPositions.value[i],
    })),
    props.tpqn,
  );

  return `${String(measuresBeats.measures).padStart(3, "0")}.${measuresBeats.beats.toFixed(2).padStart(5, "0")}`;
});

const showTempoOrTimeSignatureChangeDialog = async (
  componentProps: ExtractPropTypes<typeof TempoOrTimeSignatureChangeDialog>,
) => {
  const { promise, resolve } = Promise.withResolvers<
    TempoOrTimeSignatureChangeDialogResult | "cancelled"
  >();

  const lastTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!lastTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }

  Dialog.create({
    component: TempoOrTimeSignatureChangeDialog,
    componentProps,
  })
    .onOk((result: TempoOrTimeSignatureChangeDialogResult) => {
      resolve(result);
    })
    .onCancel(() => {
      resolve("cancelled");
    });

  const result = await promise;
  if (result === "cancelled") {
    return;
  }

  if (result.tempoChange) {
    emit("setTempo", {
      ...result.tempoChange,
      position: playheadTicks.value,
    });
  } else if (!result.tempoChange && tempoChangeExists.value) {
    emit("removeTempo", playheadTicks.value);
  }

  if (result.timeSignatureChange) {
    emit("setTimeSignature", {
      ...result.timeSignatureChange,
      measureNumber: currentMeasure.value,
    });
  } else if (!result.timeSignatureChange && timeSignatureChangeExists.value) {
    emit("removeTimeSignature", currentMeasure.value);
  }
};

const contextMenudata = computed<ContextMenuItemData[]>(() => {
  const canDeleteTempo = !(
    lastTempo.value.position === 0 && tempoChangeExists.value
  );
  const canDeleteTimeSignature = !(
    lastTimeSignature.value.measureNumber === 1 &&
    timeSignatureChangeExists.value
  );
  return [
    {
      type: "button",
      label: tempoChangeExists.value ? `BPM変化を編集` : "BPM変化を挿入",
      onClick: () => {
        void showTempoOrTimeSignatureChangeDialog({
          timeSignatureChange: timeSignatureChangeExists.value
            ? lastTimeSignature.value
            : undefined,
          tempoChange: {
            bpm: lastTempo.value.bpm,
          },
          mode: tempoChangeExists.value ? "edit" : "add",
          canDeleteTempo,
          canDeleteTimeSignature,
        });
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: timeSignatureChangeExists.value
        ? `拍子変化を編集`
        : "拍子変化を挿入",
      onClick: () => {
        void showTempoOrTimeSignatureChangeDialog({
          tempoChange: tempoChangeExists.value ? lastTempo.value : undefined,
          timeSignatureChange: {
            beats: lastTimeSignature.value.beats,
            beatType: lastTimeSignature.value.beatType,
          },
          mode: timeSignatureChangeExists.value ? "edit" : "add",
          canDeleteTempo,
          canDeleteTimeSignature,
        });
      },
      disableWhenUiLocked: true,
    },
  ];
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
.sequencer-ruler-tempo-or-time-signature-change {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);

  :not([data-ui-locked]) &:hover {
    cursor: pointer;

    text-decoration: underline;
  }
}

.sequencer-ruler-tempo-or-time-signature-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
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
