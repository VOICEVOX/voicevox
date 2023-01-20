<template>
  <svg
    width="48"
    v-bind:height="`${sizeY * zoomY * 128}`"
    xmlns="http://www.w3.org/2000/svg"
    class="sequencer-keys"
  >
    <g v-for="(y, index) in gridY" :key="index">
      <rect
        x="0"
        v-bind:y="`${sizeY * zoomY * index}`"
        v-bind:width="`${y.color === 'black' ? 30 : 48}`"
        v-bind:height="`${sizeY * zoomY}`"
        v-bind:class="`sequencer-keys-item-${y.color}`"
        v-bind:title="y.name"
      />
      <line
        x1="0"
        x2="48"
        v-bind:y1="`${(index + 1) * sizeY * zoomY}`"
        v-bind:y2="`${(index + 1) * sizeY * zoomY}`"
        v-bind:class="`sequencer-keys-item-separator ${
          y.pitch === 'C' && 'sequencer-keys-item-separator-octave'
        } ${y.pitch === 'F' && 'sequencer-keys-item-separator-f'}`"
        v-if="y.pitch === 'C' || y.pitch === 'F'"
      />
      <text
        font-size="10"
        x="32"
        v-bind:y="`${sizeY * zoomY * (index + 1) - 4}`"
        v-if="y.pitch === 'C'"
        class="sequencer-keys-item-pitchname"
      >
        {{ y.name }}
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import {
  midiKeys,
  BASE_GRID_SIZE_X as sizeX,
  BASE_GRID_SIZE_Y as sizeY,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerKeys",
  setup() {
    const store = useStore();
    const gridY = midiKeys;
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    return {
      gridY,
      sizeX,
      sizeY,
      zoomX,
      zoomY,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sequencer-keys {
  backface-visibility: hidden;
  background: #fff;
  display: block;
  position: sticky;
  left: 0;
  z-index: 100;
}

.sequencer-keys-item-separator {
  stroke-width: 1;
}
.sequencer-keys-item-separator-octave {
  stroke: #bbb;
}

.sequencer-keys-item-separator-f {
  stroke: #ddd;
}

.sequencer-keys-item-white {
  fill: #fff;
}

.sequencer-keys-item-black {
  fill: #555;
}

.sequencer-keys-item-pitchname {
  fill: #555;
}
</style>
