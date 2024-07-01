<template>
  <!-- TODO: ピッチの上に歌詞入力のinputが表示されるようにする -->
  <input
    ref="lyricInput"
    :value="editingLyricNote.lyric"
    class="lyric-input"
    :style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
    @input="onLyricInput"
    @mousedown.stop
    @dblclick.stop
    @keydown.stop="onLyricInputKeyDown"
    @blur="onLyricInputBlur"
  />
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
  emit("lyricInput", event.target.value, props.editingLyricNote);
};

watch(
  () => props.editingLyricNote,
  () => {
    nextTick(() => {
      lyricInput.value?.focus();
      lyricInput.value?.select();
    });
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.lyric-input {
  position: absolute;
  top: 0;
  left: 0;
  font-weight: 700;
  min-width: 3rem;
  max-width: 6rem;
  border: 0;
  outline: 2px solid lab(80, -22.953, 14.365);
  border-radius: 4px;
}
</style>
