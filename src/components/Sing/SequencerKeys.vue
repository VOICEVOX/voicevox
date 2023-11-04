<template>
  <div class="sequencer-keys">
    <svg xmlns="http://www.w3.org/2000/svg" :width="width" :height="height">
      <defs>
        <symbol id="white-keys">
          <g v-for="(whiteKeyInfo, index) in whiteKeyInfos" :key="index">
            <rect
              :x="whiteKeyRects[index].x - 0.5"
              :y="whiteKeyRects[index].y + 0.5"
              :width="whiteKeyRects[index].width"
              :height="whiteKeyRects[index].height"
              class="sequencer-keys-item-white"
              :title="whiteKeyInfo.name"
            />
            <text
              v-if="whiteKeyInfo.pitch === 'C'"
              font-size="10"
              :x="blackKeyWidth + 2"
              :y="whiteKeyRects[index].y + whiteKeyRects[index].height - 4"
              class="sequencer-keys-item-pitchname"
            >
              {{ whiteKeyInfo.name }}
            </text>
          </g>
        </symbol>
        <symbol id="black-keys">
          <rect
            v-for="(blackKeyInfo, index) in blackKeyInfos"
            :key="index"
            :x="blackKeyRects[index].x - 0.5"
            :y="blackKeyRects[index].y + 0.5"
            :width="blackKeyRects[index].width"
            :height="blackKeyRects[index].height"
            rx="2"
            ry="2"
            class="sequencer-keys-item-black"
            :title="blackKeyInfo.name"
          />
        </symbol>
      </defs>
      <use href="#white-keys" :y="-offset" />
      <use href="#black-keys" :y="-offset" />
    </svg>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { keyInfos, getKeyBaseHeight } from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerKeys",
  props: {
    offset: { type: Number, default: 0 },
    width: { type: Number, default: 48 },
    blackKeyWidth: { type: Number, default: 30 },
  },
  setup(props) {
    const store = useStore();
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    const keyBaseHeight = getKeyBaseHeight();
    const whiteKeyInfos = keyInfos.filter((value) => value.color === "white");
    const blackKeyInfos = keyInfos.filter((value) => value.color === "black");
    const whiteKeyBasePositions = whiteKeyInfos.map((value) => {
      const noteNumber = value.noteNumber;
      const n = noteNumber % 12;
      const o = Math.floor(noteNumber / 12);
      if (n < 5) {
        return keyBaseHeight * (128 - 12 * o - (5 / 3) * (n / 2 + 1));
      } else {
        return keyBaseHeight * (128 - 12 * o - 5 - (7 / 4) * ((n - 5) / 2 + 1));
      }
    });
    const blackKeyBasePositions = blackKeyInfos.map((value) => {
      return keyBaseHeight * (127 - value.noteNumber);
    });
    const height = computed(() => {
      return keyBaseHeight * 128 * zoomY.value + 1;
    });
    const whiteKeyRects = computed(() => {
      return whiteKeyBasePositions.map((value, index, array) => {
        const isLast = index === array.length - 1;
        const nextValue = isLast ? keyBaseHeight * 128 : array[index + 1];
        return {
          x: -2,
          y: Math.floor(value * zoomY.value),
          width: props.width + 2,
          height:
            Math.floor(nextValue * zoomY.value) -
            Math.floor(value * zoomY.value),
        };
      });
    });
    const blackKeyRects = computed(() => {
      return blackKeyBasePositions.map((value) => {
        return {
          x: -2,
          y: Math.floor(value * zoomY.value),
          width: props.blackKeyWidth + 2,
          height: Math.floor(keyBaseHeight * zoomY.value),
        };
      });
    });

    return {
      keyInfos,
      zoomX,
      zoomY,
      height,
      whiteKeyInfos,
      blackKeyInfos,
      whiteKeyRects,
      blackKeyRects,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sequencer-keys {
  backface-visibility: hidden;
  background: #ccc;
  overflow: hidden;
}

.sequencer-keys-item-white {
  fill: #fff;
  stroke: #ccc;
}

.sequencer-keys-item-black {
  fill: #5a5a5a;
}

.sequencer-keys-item-pitchname {
  fill: #555;
}
</style>
