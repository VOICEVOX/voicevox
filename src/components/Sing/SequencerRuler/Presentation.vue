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
      :menudata="contextMenuData"
      :uiLocked
    />
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height
      shape-rendering="crispEdges"
    >
      <defs>
        <pattern
          v-for="(gridPattern, patternIndex) in gridPatterns"
          :id="`sequencer-ruler-measure-${patternIndex}`"
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
        :x="measureInfo.x - offset + valueChangeTextPadding"
        y="34"
        class="sequencer-ruler-measure-number"
      >
        {{ measureInfo.number }}
      </text>
      <!-- テンポ・拍子表示 -->
      <template v-for="valueChange in valueChanges" :key="valueChange.position">
        <text
          ref="valueChangeText"
          font-size="12"
          :x="valueChange.x - offset + valueChangeTextPadding"
          y="16"
          class="sequencer-ruler-value-change"
          @click.stop="onValueChangeClick($event, valueChange)"
          @contextmenu.stop="onValueChangeClick($event, valueChange)"
        >
          {{ valueChange.displayText }}
        </text>
        <line
          :x1="valueChange.x - offset"
          :x2="valueChange.x - offset"
          y1="0"
          :y2="height"
          class="sequencer-ruler-value-change-line"
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
  ComponentPublicInstance,
  useTemplateRef,
  toRef,
} from "vue";
import { Dialog } from "quasar";
import {
  getMeasureDuration,
  getNoteDuration,
  getTimeSignaturePositions,
  snapTicksToGrid,
  tickToMeasureNumber,
} from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { Tempo, TimeSignature } from "@/store/type";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import { UnreachableError } from "@/type/utility";
import TempoChangeDialog from "@/components/Sing/ChangeValueDialog/TempoChangeDialog.vue";
import TimeSignatureChangeDialog from "@/components/Sing/ChangeValueDialog/TimeSignatureChangeDialog.vue";
import { FontSpecification, predictTextWidth } from "@/helpers/textWidth";
import { createLogger } from "@/helpers/log";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";

const props = defineProps<{
  offset: number;
  numMeasures: number;
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  uiLocked: boolean;
  sequencerSnapType: number;
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

const log = createLogger("SequencerRuler");

const height = ref(40);
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
const gridPatterns = useSequencerGrid({
  timeSignatures: toRef(() => props.timeSignatures),
  tpqn: toRef(() => props.tpqn),
  sequencerZoomX: toRef(() => props.sequencerZoomX),
  numMeasures: toRef(() => props.numMeasures),
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

const snapTicks = computed(() => {
  return getNoteDuration(props.sequencerSnapType, props.tpqn);
});

const getSnappedTickFromOffsetX = (offsetX: number) => {
  const baseX = (props.offset + offsetX) / props.sequencerZoomX;
  return snapTicksToGrid(baseXToTick(baseX, props.tpqn), snapTicks.value);
};

const onClick = (event: MouseEvent) => {
  emit("deselectAllNotes");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const ticks = getSnappedTickFromOffsetX(event.offsetX);
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

  const snappedTicks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = snappedTicks;
};

type ValueChange = {
  position: number;
  text: string;
  tempoChange: Tempo | undefined;
  timeSignatureChange: TimeSignature | undefined;
  x: number;
  displayText: string;
};

const onValueChangeClick = async (
  event: MouseEvent,
  valueChange: ValueChange,
) => {
  const ticks = valueChange.position;
  playheadTicks.value = ticks;
  contextMenu.value?.show(event);
};

const currentMeasure = computed(() =>
  tickToMeasureNumber(playheadTicks.value, props.timeSignatures, props.tpqn),
);

const valueChangeTextPadding = 4;

// NOTE: フォントの変更に対応していないが、基本的にフォントが変更されることは少ないので、
// 複雑性を下げるためにも対応しない
const valueChangeText = useTemplateRef<SVGTextElement[]>("valueChangeText");
const valueChangeTextStyle = computed<FontSpecification | null>(() => {
  if (!valueChangeText.value || valueChangeText.value.length === 0) {
    return null;
  }
  const style = window.getComputedStyle(valueChangeText.value[0]);
  return {
    fontFamily: style.fontFamily,
    fontSize: parseFloat(style.fontSize),
    fontWeight: style.fontWeight,
  };
});

const valueChanges = computed<ValueChange[]>(() => {
  const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => ({
    type: "timeSignature" as const,
    position: tsPosition,
    timeSignature: props.timeSignatures[i],
  }));
  const tempos = props.tempos.map((tempo) => {
    return {
      type: "tempo" as const,
      position: tempo.position,
      tempo,
    };
  });

  const valueChanges: ValueChange[] = [
    ...Map.groupBy(
      [...tempos, ...timeSignaturesWithTicks],
      (item) => item.position,
    ).entries(),
  ]
    .toSorted((a, b) => a[0] - b[0])
    .map(([tick, items]) => {
      const tempo = items.find((item) => item.type === "tempo")?.tempo;
      const timeSignature = items.find(
        (item) => item.type === "timeSignature",
      )?.timeSignature;

      const tempoText = tempo?.bpm ?? "";
      const timeSignatureText = timeSignature
        ? `${timeSignature.beats}/${timeSignature.beatType}`
        : "";

      const text = [tempoText, timeSignatureText].join(" ");

      return {
        position: tick,
        text,
        tempoChange: tempo,
        timeSignatureChange: timeSignature,
        x: tickToBaseX(tick, props.tpqn) * props.sequencerZoomX,
        displayText: text,
      };
    });

  if (valueChangeTextStyle.value != undefined) {
    // NOTE: テキストの幅を計算して、表示できるかどうかを判定する
    //   full: 通常表示（120 4/4）
    //   ellipsis: fullが入りきらないときに表示する（...）
    //   hidden: ellipsisも入りきらないときに表示する

    const collapsedTextWidth =
      predictTextWidth("...", valueChangeTextStyle.value) +
      valueChangeTextPadding * 2;
    for (const [i, valueChange] of valueChanges.entries()) {
      const next = valueChanges.at(i + 1);
      if (!next) {
        continue;
      }
      const requiredWidth =
        predictTextWidth(valueChange.text, valueChangeTextStyle.value) +
        valueChangeTextPadding;
      const width = next.x - valueChange.x;
      if (collapsedTextWidth > width) {
        valueChange.displayText = "";
      } else if (requiredWidth > width) {
        valueChange.displayText = "...";
      }
    }
  } else {
    log.warn("valueChangeTextElement is null. Cannot calculate text width.");
  }

  return valueChanges;
});

const currentTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!maybeTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }
  return maybeTempo;
});
const currentTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= currentMeasure.value;
  });
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: At least one time signature exists.");
  }
  return maybeTimeSignature;
});
const tempoChangeExists = computed(
  () => currentTempo.value.position === playheadTicks.value,
);
const timeSignatureChangeExists = computed(
  () => currentTimeSignature.value.measureNumber === currentMeasure.value,
);

const contextMenuHeader = computed(() => {
  const texts = [];
  if (tempoChangeExists.value) {
    texts.push(`テンポ：${currentTempo.value.bpm}`);
  }
  if (timeSignatureChangeExists.value) {
    texts.push(
      `拍子：${currentTimeSignature.value.beats}/${currentTimeSignature.value.beatType}`,
    );
  }
  return texts.join("、");
});
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  const menuData: ContextMenuItemData[] = [];
  menuData.push({
    type: "button",
    label: tempoChangeExists.value ? `テンポ変化を編集` : "テンポ変化を挿入",
    onClick: async () => {
      Dialog.create({
        component: TempoChangeDialog,
        componentProps: {
          tempoChange: currentTempo.value,
          mode: tempoChangeExists.value ? "edit" : "add",
        },
      }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
        emit("setTempo", {
          ...result.tempoChange,
          position: playheadTicks.value,
        });
      });
      contextMenu.value?.hide();
    },
    disableWhenUiLocked: true,
  });
  if (tempoChangeExists.value) {
    menuData.push({
      type: "button",
      label: "テンポ変化を削除",
      disabled: currentTempo.value.position === 0,
      onClick: () => {
        emit("removeTempo", playheadTicks.value);

        contextMenu.value?.hide();
      },
      disableWhenUiLocked: true,
    });
  }
  menuData.push({
    type: "separator",
  });
  menuData.push({
    type: "button",
    label: timeSignatureChangeExists.value
      ? `拍子変化を編集`
      : "拍子変化を挿入",
    onClick: async () => {
      Dialog.create({
        component: TimeSignatureChangeDialog,
        componentProps: {
          timeSignatureChange: currentTimeSignature.value,
          mode: timeSignatureChangeExists.value ? "edit" : "add",
        },
      }).onOk(
        (result: { timeSignatureChange: Omit<TimeSignature, "position"> }) => {
          emit("setTimeSignature", {
            ...result.timeSignatureChange,
            measureNumber: currentMeasure.value,
          });
        },
      );
      contextMenu.value?.hide();
    },
    disableWhenUiLocked: true,
  });
  if (timeSignatureChangeExists.value) {
    menuData.push({
      type: "button",
      label: "拍子変化を削除",
      disabled: currentMeasure.value === 1,
      onClick: () => {
        emit("removeTimeSignature", currentMeasure.value);

        contextMenu.value?.hide();
      },
      disableWhenUiLocked: true,
    });
  }
  return menuData;
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
.sequencer-ruler-value-change {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);

  &:hover {
    cursor: pointer;

    text-decoration: underline;
  }
}

.sequencer-ruler-value-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
}

.sequencer-ruler-value-change-hitbox {
  pointer-events: all;
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
