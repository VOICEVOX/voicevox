<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <slot />
    <div
      class="sequencer-ruler-playhead"
      :style="{
        transform: `translateX(${playheadX - offset}px)`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { snapTicksToGrid } from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { Tempo, TimeSignature } from "@/store/type";

defineOptions({
  name: "RulerPresentation",
});

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

const sequencerRuler = ref<HTMLDivElement | null>(null);

const playheadX = computed(() => {
  return Math.floor(
    tickToBaseX(playheadTicks.value, props.tpqn) * props.sequencerZoomX,
  );
});

const getSnappedTickFromOffsetX = (offsetX: number) => {
  const baseX = (props.offset + offsetX) / props.sequencerZoomX;
  return snapTicksToGrid(
    baseXToTick(baseX, props.tpqn),
    props.timeSignatures,
    props.tpqn,
  );
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

const onContextMenu = async (event: MouseEvent) => {
  emit("deselectAllNotes");

  const snappedTicks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = snappedTicks;
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler {
  background: var(--scheme-color-sing-ruler-surface);
  height: 40px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
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
</style>
