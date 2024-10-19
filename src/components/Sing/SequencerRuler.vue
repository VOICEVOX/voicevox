<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <ContextMenu
      ref="contextMenu"
      :header="contextMenuHeader"
      :menudata="contextMenudata"
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
          :x="
            (-offset %
              (beatWidth(timeSignature) * beatsPerMeasure(timeSignature))) +
            gridPatterns[tsIndex].x
          "
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
  useTemplateRef,
  onMounted,
  onUnmounted,
  ExtractPropTypes,
} from "vue";
import { Dialog } from "quasar";
import TempoOrTimeSignatureChangeDialog, {
  TempoOrTimeSignatureChangeDialogResult,
} from "@/components/Dialog/TempoOrTimeSignatureChangeDialog.vue";
import { useStore } from "@/store";
import {
  getMeasureDuration,
  getNoteDuration,
  getTimeSignaturePositions,
} from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";
import { UnreachableError } from "@/type/utility";
import { TimeSignature } from "@/store/type";

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
const beatsPerMeasure = (timeSignature: TimeSignature) => timeSignature.beats;
const beatWidth = (timeSignature: TimeSignature) => {
  const beatType = timeSignature.beatType;
  const wholeNoteDuration = tpqn.value * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn.value) * zoomX.value;
};
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
const gridPatterns = computed(() => {
  const gridPatterns: { id: string; x: number; width: number }[] = [];
  for (const [i, timeSignature] of timeSignatures.value.entries()) {
    const nextTimeSignature = timeSignatures.value[i + 1];
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ??
      store.getters.SEQUENCER_NUM_MEASURES + 1;
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

const getTickFromMouseEvent = (event: MouseEvent) => {
  const baseX = (props.offset + event.offsetX) / zoomX.value;
  return baseXToTick(baseX, tpqn.value);
};

const onClick = async (event: MouseEvent) => {
  await store.dispatch("DESELECT_ALL_NOTES");

  const ticks = getTickFromMouseEvent(event);
  await store.dispatch("SET_PLAYHEAD_POSITION", { position: ticks });
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

const contextMenu =
  useTemplateRef<InstanceType<typeof ContextMenu>>("contextMenu");
const onContextMenu = async (event: MouseEvent) => {
  await store.dispatch("DESELECT_ALL_NOTES");

  const ticks = getTickFromMouseEvent(event);
  const snapTicks = getNoteDuration(store.state.sequencerSnapType, tpqn.value);
  const snappedTicks = Math.round(ticks / snapTicks) * snapTicks;
  await store.dispatch("SET_PLAYHEAD_POSITION", { position: snappedTicks });
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
  await store.dispatch("SET_PLAYHEAD_POSITION", { position: ticks });

  contextMenu.value?.show(event);
};

const currentMeasure = computed(() => {
  let currentMeasure = 1;
  for (const [tsPosition, tsInfo] of timeSignatures.value.map(
    (ts, i) => [tsPositions.value[i], ts] as const,
  )) {
    if (playheadTicks.value < tsPosition) {
      break;
    }
    const measureDuration = getMeasureDuration(
      tsInfo.beats,
      tsInfo.beatType,
      tpqn.value,
    );
    currentMeasure =
      tsInfo.measureNumber +
      Math.floor((playheadTicks.value - tsPosition) / measureDuration);
  }

  return currentMeasure;
});

const tempoOrTimeSignatureChanges = computed<TempoOrTimeSignatureChange[]>(
  () => {
    const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => {
      return {
        position: tsPosition,
        timeSignature: timeSignatures.value[i],
      };
    });
    const tempos = store.state.tempos.map((tempo) => {
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
        x: tickToBaseX(tick, tpqn.value) * zoomX.value,
      };
    });

    return result;
  },
);

const lastTempo = computed(() => {
  const maybeTempo = store.state.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!maybeTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }
  return maybeTempo;
});
const lastTimeSignature = computed(() => {
  const maybeTimeSignature = store.state.timeSignatures.findLast(
    (timeSignature) => {
      return timeSignature.measureNumber <= currentMeasure.value;
    },
  );
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

const contextMenuHeader = computed(() => `${currentMeasure.value}小節目`);

const showTempoOrTimeSignatureChangeDialog = async (
  props: ExtractPropTypes<typeof TempoOrTimeSignatureChangeDialog>,
) => {
  const { promise, resolve } = Promise.withResolvers<
    TempoOrTimeSignatureChangeDialogResult | "cancelled"
  >();

  const lastTempo = store.state.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!lastTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }

  Dialog.create({
    component: TempoOrTimeSignatureChangeDialog,
    componentProps: props,
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
    await store.dispatch("COMMAND_SET_TEMPO", {
      tempo: {
        ...result.tempoChange,
        position: playheadTicks.value,
      },
    });
  } else if (!result.tempoChange && tempoChangeExists.value) {
    await store.dispatch("COMMAND_REMOVE_TEMPO", {
      position: playheadTicks.value,
    });
  }

  if (result.timeSignatureChange) {
    await store.dispatch("COMMAND_SET_TIME_SIGNATURE", {
      timeSignature: {
        ...result.timeSignatureChange,
        measureNumber: currentMeasure.value,
      },
    });
  } else if (!result.timeSignatureChange && timeSignatureChangeExists.value) {
    await store.dispatch("COMMAND_REMOVE_TIME_SIGNATURE", {
      measureNumber: currentMeasure.value,
    });
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

  &:hover {
    cursor: pointer;
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
