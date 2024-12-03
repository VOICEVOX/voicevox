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
      @input="onLyricInput"
      @mousedown.stop
      @dblclick.stop
      @keydown.stop="onLyricInputKeyDown"
      @blur="onLyricInputBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useStore } from "@/store";
import { tickToBaseX, noteNumberToBaseY } from "@/sing/viewHelper";
import { NoteId } from "@/type/preload";
import { Note } from "@/store/type";

const props = defineProps<{
  editingLyricNote: Note;
}>();

const emit = defineEmits<{
  (name: "lyricInput", text: string, note: Note): void;
  /** 歌詞が確定したときに呼ばれる。次に歌詞入力を開始すべきノートIDを返す。 */
  (name: "lyricConfirmed", nextNoteId: NoteId | undefined): void;
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

const onLyricInputKeyDown = (event: KeyboardEvent) => {
  // IME変換中のキー入力を無視する
  if (event.isComposing) {
    return;
  }
  // タブキーで次のノート入力に移動
  if (event.key === "Tab") {
    event.preventDefault();
    const editingLyricNoteId = props.editingLyricNote.id;
    const notes = store.getters.SELECTED_TRACK.notes;
    const index = notes.findIndex((value) => {
      return value.id === editingLyricNoteId;
    });
    if (index === -1) {
      return;
    }
    if (event.shiftKey && index - 1 < 0) {
      return;
    }
    if (!event.shiftKey && index + 1 >= notes.length) {
      return;
    }
    const nextNoteId = notes[index + (event.shiftKey ? -1 : 1)].id;
    emit("lyricConfirmed", nextNoteId);
  }
  // Enterキーで入力を確定
  if (event.key === "Enter") {
    emit("lyricConfirmed", undefined);
  }
};

const onLyricInputBlur = () => {
  emit("lyricConfirmed", undefined);
};

const onLyricInput = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Invalid event target");
  }
  const newValue = event.target.value;
  emit("lyricInput", newValue, props.editingLyricNote);
};

watch(
  () => props.editingLyricNote.id,
  () => {
    void nextTick(() => {
      lyricInput.value?.focus();
      lyricInput.value?.select();
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
