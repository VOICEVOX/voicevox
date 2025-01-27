<template>
  <div class="value-marker-lane">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height
      shape-rendering="crispEdges"
    >
      <!-- テンポ・拍子表示 -->
      <template v-for="valueChange in valueChanges" :key="valueChange.position">
        <text
          ref="valueChangeText"
          font-size="12"
          :x="valueChange.x - offset + valueChangeTextPadding"
          y="32"
          class="value-marker-lane-value-change"
          @click.stop="$emit('valueChangeClick')"
        >
          {{ valueChange.displayText }}
        </text>
        <line
          :x1="valueChange.x - offset"
          :x2="valueChange.x - offset"
          y1="0"
          :y2="height"
          class="value-marker-lane-value-change-line"
        />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { Tempo, TimeSignature } from "@/store/type";
import { getTimeSignaturePositions } from "@/sing/domain";
import { tickToBaseX } from "@/sing/viewHelper";
import { createLogger } from "@/helpers/log";
import { FontSpecification, predictTextWidth } from "@/helpers/textWidth";

defineOptions({
  name: "ValueMarkerLanePresentation",
});

const props = defineProps<{
  tpqn: number;
  sequencerZoomX: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  offset: number;
}>();

defineEmits<{
  valueChangeClick: [];
}>();

const height = ref(40);
const valueChangeTextPadding = 4;

const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});

const log = createLogger("ValueMarkerLane");

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

type ValueChange = {
  position: number;
  text: string;
  tempoChange: Tempo | undefined;
  timeSignatureChange: TimeSignature | undefined;
  x: number;
  displayText: string;
};

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

const width = computed(() => {
  if (valueChanges.value.length === 0) return 0;
  const lastChange = valueChanges.value[valueChanges.value.length - 1];
  return lastChange.x;
});
</script>

<style scoped lang="scss">
.value-marker-lane {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.value-marker-lane-value-change {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);
  pointer-events: all;

  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.value-marker-lane-value-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
}
</style>
