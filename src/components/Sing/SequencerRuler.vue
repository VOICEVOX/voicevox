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
      <!-- BPM・拍子表示 -->
      <text
        v-for="tempoOrTimeSignatureChange in tempoAndTimeSignatureChanges"
        :key="tempoOrTimeSignatureChange.position"
        font-size="12"
        :x="tempoOrTimeSignatureChange.x - offset + 4"
        y="16"
        class="sequencer-ruler-tempo-or-time-signature-change"
      >
        {{ tempoOrTimeSignatureChange.text }}
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

const onContextMenu = async (event: MouseEvent) => {
  await store.dispatch("DESELECT_ALL_NOTES");

  const ticks = getTickFromMouseEvent(event);
  const snapTicks = getNoteDuration(store.state.sequencerSnapType, tpqn.value);
  const snappedTicks = Math.round(ticks / snapTicks) * snapTicks;
  await store.dispatch("SET_PLAYHEAD_POSITION", { position: snappedTicks });
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

const tempoAndTimeSignatureChanges = computed(() => {
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
});

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

const contextMenuHeader = computed(() => `${currentMeasure.value}小節目`);

const contextMenudata = computed<ContextMenuItemData[]>(() => {
  const tempoChangeExists = lastTempo.value.position === playheadTicks.value;
  const timeSignatureChangeExists =
    lastTimeSignature.value.measureNumber === currentMeasure.value;
  const canDeleteTempo = !(lastTempo.value.position === 0 && tempoChangeExists);
  const canDeleteTimeSignature = !(
    lastTimeSignature.value.measureNumber === 1 && timeSignatureChangeExists
  );
  return [
    {
      type: "button",
      label: tempoChangeExists ? `BPM変化を編集` : "BPM変化を挿入",
      onClick: async () => {
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
          componentProps: {
            timeSignatureChange: timeSignatureChangeExists
              ? lastTimeSignature.value
              : undefined,
            tempoChange: {
              bpm: lastTempo.bpm,
            },
            mode: tempoChangeExists ? "edit" : "add",
            canDeleteTempo,
            canDeleteTimeSignature,
          },
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

        console.log(result);
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: timeSignatureChangeExists ? `拍子変化を編集` : "拍子変化を挿入",
      onClick: async () => {
        const lastTimeSignature = store.state.timeSignatures.findLast(
          (timeSignature) => {
            return timeSignature.measureNumber <= currentMeasure.value;
          },
        );
        if (!lastTimeSignature) {
          throw new UnreachableError(
            "assert: At least one time signature exists.",
          );
        }

        const { promise, resolve } = Promise.withResolvers<
          TempoOrTimeSignatureChangeDialogResult | "cancelled"
        >();

        Dialog.create({
          component: TempoOrTimeSignatureChangeDialog,
          componentProps: {
            timeSignatureChange: {
              beats: lastTimeSignature.beats,
              beatType: lastTimeSignature.beatType,
            },
            tempoChange: tempoChangeExists ? lastTempo.value : undefined,
            mode: timeSignatureChangeExists ? "edit" : "add",
            canDeleteTempo,
            canDeleteTimeSignature,
          },
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

        console.log(result);
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
