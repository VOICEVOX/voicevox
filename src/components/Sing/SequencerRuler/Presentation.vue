<template>
  <div ref="sequencerRuler" class="sequencer-ruler" @click="onClick">
    <div class="sequencer-ruler-content" :style="{ width: `${width}px` }">
      <div class="sequencer-ruler-grid">
        <!-- NOTE: slotを使う(Copilotくんが提案してくれた) -->
        <slot name="grid" />
      </div>
      <div class="sequencer-ruler-changes">
        <slot name="changes" />
      </div>
      <div class="sequencer-ruler-loop">
        <slot name="loop" />
      </div>
      <div
        class="sequencer-ruler-playhead"
        :style="{
          transform: `translateX(${playheadX - offset}px)`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Tempo, TimeSignature } from "@/store/type";
defineOptions({
  name: "RulerPresentation",
});

const props = defineProps<{
  width: number;
  numMeasures: number;
  playheadX: number;
  offset: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  tpqn: number;
  sequencerZoomX: number;
  sequencerSnapType: number;
  uiLocked: boolean;
  getSnappedTickFromOffsetX: (offsetX: number) => number;
}>();

const playheadTicks = defineModel<number>("playheadTicks", {
  required: true,
});

const emit = defineEmits<{
  deselectAllNotes: [];
}>();

const sequencerRuler = ref<HTMLDivElement | null>(null);

const onClick = (event: MouseEvent) => {
  emit("deselectAllNotes");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const ticks = props.getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = ticks;
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

.sequencer-ruler-content {
  position: relative;
  width: 100%;
  height: 100%;
}

.sequencer-ruler-grid,
.sequencer-ruler-changess,
.sequencer-ruler-loop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.sequencer-ruler-loop {
  height: 20px;
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
