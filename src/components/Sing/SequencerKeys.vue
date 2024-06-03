<template>
  <div ref="sequencerKeys" class="sequencer-keys">
    <svg xmlns="http://www.w3.org/2000/svg" :width :height>
      <g
        v-for="(whiteKeyInfo, index) in whiteKeyInfos"
        :key="index"
        @mousedown="onMouseDown(whiteKeyInfo.noteNumber)"
        @mouseenter="onMouseEnter(whiteKeyInfo.noteNumber)"
      >
        <rect
          :x="whiteKeyRects[index].x - 0.5"
          :y="whiteKeyRects[index].y + 0.5 - offset"
          :width="whiteKeyRects[index].width"
          :height="whiteKeyRects[index].height"
          :title="whiteKeyInfo.name"
          :class="
            noteNumberOfKeyBeingPressed === whiteKeyInfo.noteNumber
              ? 'white-key-being-pressed'
              : 'white-key'
          "
        />
        <text
          v-if="whiteKeyInfo.pitch === 'C'"
          font-size="10"
          :x="whiteKeyRects[index].x + whiteKeyRects[index].width - 18"
          :y="whiteKeyRects[index].y + whiteKeyRects[index].height - 4 - offset"
          class="pitchname"
        >
          {{ whiteKeyInfo.name }}
        </text>
      </g>
      <rect
        v-for="(blackKeyInfo, index) in blackKeyInfos"
        :key="index"
        :x="blackKeyRects[index].x - 0.5"
        :y="blackKeyRects[index].y + 0.5 - offset"
        :width="blackKeyRects[index].width"
        :height="blackKeyRects[index].height"
        rx="2"
        ry="2"
        :title="blackKeyInfo.name"
        :class="
          noteNumberOfKeyBeingPressed === blackKeyInfo.noteNumber
            ? 'black-key-being-pressed'
            : 'black-key'
        "
        @mousedown="onMouseDown(blackKeyInfo.noteNumber)"
        @mouseenter="onMouseEnter(blackKeyInfo.noteNumber)"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { keyInfos, getKeyBaseHeight } from "@/sing/viewHelper";

const props = withDefaults(
  defineProps<{
    offset: number;
    blackKeyWidth: number;
  }>(),
  {
    offset: 0,
    blackKeyWidth: 30,
  },
);
const store = useStore();
const width = ref(48);
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
      width: width.value + 2,
      height:
        Math.floor(nextValue * zoomY.value) - Math.floor(value * zoomY.value),
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
const noteNumberOfKeyBeingPressed = ref<number | undefined>();

const sequencerKeys = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;

const onMouseDown = (noteNumber: number) => {
  noteNumberOfKeyBeingPressed.value = noteNumber;
  store.dispatch("PLAY_PREVIEW_SOUND", { noteNumber });
};

const onMouseUp = () => {
  if (noteNumberOfKeyBeingPressed.value != undefined) {
    const noteNumber = noteNumberOfKeyBeingPressed.value;
    noteNumberOfKeyBeingPressed.value = undefined;
    store.dispatch("STOP_PREVIEW_SOUND", { noteNumber });
  }
};

const onMouseEnter = (noteNumber: number) => {
  if (
    noteNumberOfKeyBeingPressed.value != undefined &&
    noteNumberOfKeyBeingPressed.value !== noteNumber
  ) {
    store.dispatch("STOP_PREVIEW_SOUND", {
      noteNumber: noteNumberOfKeyBeingPressed.value,
    });
    noteNumberOfKeyBeingPressed.value = noteNumber;
    store.dispatch("PLAY_PREVIEW_SOUND", { noteNumber });
  }
};

onMounted(() => {
  const sequencerKeysElement = sequencerKeys.value;
  if (!sequencerKeysElement) {
    throw new Error("sequencerKeysElement is null.");
  }
  resizeObserver = new ResizeObserver((entries) => {
    let inlineSize = 0;
    for (const entry of entries) {
      for (const borderBoxSize of entry.borderBoxSize) {
        inlineSize = borderBoxSize.inlineSize;
      }
    }
    if (inlineSize > 0 && inlineSize !== width.value) {
      width.value = inlineSize;
    }
  });
  resizeObserver.observe(sequencerKeysElement);

  document.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  document.removeEventListener("mouseup", onMouseUp);
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.sequencer-keys {
  backface-visibility: hidden;
  background: colors.$background;
  overflow: hidden;
}

.white-key {
  fill: colors.$sequencer-white-key;
  stroke: colors.$sequencer-main-divider;
}

.white-key-being-pressed {
  fill: colors.$primary;
  stroke: colors.$primary;
}

.black-key {
  fill: colors.$sequencer-black-key;
}

.black-key-being-pressed {
  fill: colors.$primary;
}

.pitchname {
  fill: colors.$sequencer-black-key;
}
</style>
