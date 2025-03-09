<template>
  <div
    class="lyric-input-container"
    :style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <input
      ref="lyricInput"
      :value="editingLyricNote.lyric"
      class="lyric-input"
      @input="onInput"
      @mousedown.stop
      @dblclick.stop
      @keydown.stop="onKeyDown"
      @blur="onBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useStore } from "@/store";
import { tickToBaseX, noteNumberToBaseY } from "@/sing/viewHelper";
import { Note } from "@/store/type";

const props = defineProps<{
  editingLyricNote: Note;
}>();

const emit = defineEmits<{
  (name: "input", event: Event): void;
  (name: "keydown", event: KeyboardEvent): void;
  (name: "blur"): void;
}>();

const store = useStore();
const state = store.state;

const zoomX = computed(() => state.sequencerZoomX);
const zoomY = computed(() => state.sequencerZoomY);
const positionX = computed(() => {
  const noteStartTicks = props.editingLyricNote.position;
  return tickToBaseX(noteStartTicks, state.tpqn) * zoomX.value;
});
const positionY = computed(() => {
  const noteNumber = props.editingLyricNote.noteNumber;
  return noteNumberToBaseY(noteNumber + 0.5) * zoomY.value;
});
const lyricInput = ref<HTMLInputElement | null>(null);

const onKeyDown = (event: KeyboardEvent) => {
  emit("keydown", event);
};

const onBlur = () => {
  emit("blur");
};

const onInput = (event: Event) => {
  emit("input", event);
};

watch(
  () => props.editingLyricNote.id,
  () => {
    void nextTick(() => {
      lyricInput.value?.focus();
      lyricInput.value?.select();
      lyricInput.value?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.lyric-input-container {
  position: absolute;
  top: -2px;
  left: -2px;
  z-index: vars.$z-index-sing-lyric-input;
}

.lyric-input {
  display: inline-block;
  font-weight: 400;
  font-size: 16px;
  box-sizing: border-box;
  background-color: oklch(from var(--scheme-color-background) l c h / 0.8);
  backdrop-filter: blur(1px);
  color: var(--scheme-color-on-surface);
  outline-offset: 1px;
  border: 1px solid var(--scheme-color-inverse-surface);
  box-shadow:
    oklch(from var(--scheme-color-shadow) l c h / 0.19) 0px 8px 20px,
    oklch(from var(--scheme-color-shadow) l c h / 0.23) 0px 6px 6px;
  outline: 0;
  border-radius: 4px;
  padding: 0 4px;
  width: 10ch;
}
</style>
