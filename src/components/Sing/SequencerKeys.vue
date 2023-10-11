<template>
  <svg
    width="48"
    :height="`${keyHeight * keyInfos.length}`"
    xmlns="http://www.w3.org/2000/svg"
    class="sequencer-keys"
  >
    <g v-for="(keyInfo, index) in keyInfos" :key="index">
      <rect
        x="0"
        :y="`${keyHeight * index}`"
        :width="`${keyInfo.color === 'black' ? 30 : 48}`"
        :height="`${keyHeight}`"
        :class="`sequencer-keys-item-${keyInfo.color}`"
        :title="keyInfo.name"
      />
      <line
        v-if="keyInfo.pitch === 'C' || keyInfo.pitch === 'F'"
        x1="0"
        x2="48"
        :y1="`${(index + 1) * keyHeight}`"
        :y2="`${(index + 1) * keyHeight}`"
        :class="`sequencer-keys-item-separator ${
          keyInfo.pitch === 'C' && 'sequencer-keys-item-separator-octave'
        } ${keyInfo.pitch === 'F' && 'sequencer-keys-item-separator-f'}`"
      />
      <text
        v-if="keyInfo.pitch === 'C'"
        font-size="10"
        x="32"
        :y="`${keyHeight * (index + 1) - 4}`"
        class="sequencer-keys-item-pitchname"
      >
        {{ keyInfo.name }}
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { keyInfos, getKeyBaseHeight } from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerKeys",
  setup() {
    const store = useStore();
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    const keyBaseHeight = getKeyBaseHeight();
    const keyHeight = computed(() => keyBaseHeight * zoomY.value);
    return {
      keyInfos,
      zoomX,
      zoomY,
      keyHeight,
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
