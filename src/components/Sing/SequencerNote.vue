<template>
  <div
    class="note"
    :class="{
      selected: noteState === 'SELECTED',
      overlapping: noteState === 'OVERLAPPING',
    }"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <div class="note-lyric" @mousedown="onLyricMouseDown">
      {{ lyric }}
    </div>
    <div class="note-bar" @mousedown="onBarMouseDown">
      <div class="note-left-edge" @mousedown="onLeftEdgeMouseDown"></div>
      <div class="note-right-edge" @mousedown="onRightEdgeMouseDown"></div>
      <context-menu ref="contextMenu" :menudata="contextMenuData" />
    </div>
    <input
      v-if="showLyricInput"
      v-model.lazy.trim="lyric"
      v-focus
      class="note-lyric-input"
      @mousedown.stop
      @dblclick.stop
      @keydown.stop="onLyricInputKeyDown"
      @blur="onLyricInputBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { Note } from "@/store/type";
import {
  getKeyBaseHeight,
  tickToBaseX,
  noteNumberToBaseY,
} from "@/sing/viewHelper";
import ContextMenu from "@/components/ContextMenu.vue";
import { MenuItemButton } from "@/components/BaseMenuBar.vue";

type NoteState = "NORMAL" | "SELECTED" | "OVERLAPPING";

const vFocus = {
  mounted(el: HTMLElement) {
    el.focus();
  },
};

const props = withDefaults(
  defineProps<{
    note: Note;
    isSelected: boolean;
  }>(),
  {
    isSelected: false,
  }
);

const emit =
  defineEmits<{
    (name: "barMousedown", event: MouseEvent): void;
    (name: "rightEdgeMousedown", event: MouseEvent): void;
    (name: "leftEdgeMousedown", event: MouseEvent): void;
    (name: "lyricMouseDown", event: MouseEvent): void;
  }>();

const store = useStore();
const state = store.state;
const tpqn = computed(() => state.score.tpqn);
const zoomX = computed(() => state.sequencerZoomX);
const zoomY = computed(() => state.sequencerZoomY);
const positionX = computed(() => {
  const noteStartTicks = props.note.position;
  return tickToBaseX(noteStartTicks, tpqn.value) * zoomX.value;
});
const positionY = computed(() => {
  const noteNumber = props.note.noteNumber;
  return noteNumberToBaseY(noteNumber + 0.5) * zoomY.value;
});
const height = computed(() => getKeyBaseHeight() * zoomY.value);
const width = computed(() => {
  const noteStartTicks = props.note.position;
  const noteEndTicks = props.note.position + props.note.duration;
  const noteStartBaseX = tickToBaseX(noteStartTicks, tpqn.value);
  const noteEndBaseX = tickToBaseX(noteEndTicks, tpqn.value);
  return (noteEndBaseX - noteStartBaseX) * zoomX.value;
});
const noteState = computed((): NoteState => {
  if (props.isSelected) {
    return "SELECTED";
  }
  if (state.overlappingNoteIds.has(props.note.id)) {
    return "OVERLAPPING";
  }
  return "NORMAL";
});
const lyric = computed({
  get() {
    return props.note.lyric;
  },
  set(value) {
    if (!value) {
      return;
    }
    const note: Note = { ...props.note, lyric: value };
    store.dispatch("UPDATE_NOTES", { notes: [note] });
  },
});
const showLyricInput = computed(() => {
  return state.editingLyricNoteId === props.note.id;
});
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuData = ref<[MenuItemButton]>([
  {
    type: "button",
    label: "削除",
    onClick: async () => {
      contextMenu.value?.hide();
      store.dispatch("REMOVE_SELECTED_NOTES");
    },
    disableWhenUiLocked: true,
  },
]);

const onBarMouseDown = (event: MouseEvent) => {
  emit("barMousedown", event);
};

const onRightEdgeMouseDown = (event: MouseEvent) => {
  emit("rightEdgeMousedown", event);
};

const onLeftEdgeMouseDown = (event: MouseEvent) => {
  emit("leftEdgeMousedown", event);
};

const onLyricMouseDown = (event: MouseEvent) => {
  emit("lyricMouseDown", event);
};

const onLyricInputKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const noteId = props.note.id;
    const notes = state.score.notes;
    const index = notes.findIndex((value) => value.id === noteId);
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
    store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId: nextNoteId });
  }
  if (event.key === "Enter") {
    store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId: undefined });
  }
};

const onLyricInputBlur = () => {
  if (state.editingLyricNoteId === props.note.id) {
    store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId: undefined });
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.note {
  position: absolute;
  top: 0;
  left: 0;

  &.selected {
    // 色は仮
    .note-bar {
      background-color: hsl(33, 100%, 50%);
      border-color: hsl(33, 100%, 78%);
    }

    .note-lyric {
      border-color: hsl(33, 0%, 90%);
    }
  }

  &.overlapping {
    .note-bar {
      background-color: hsl(130, 35%, 85%);
      border-color: hsl(130, 35%, 90%);
    }
  }
}

.note-lyric {
  position: absolute;
  left: 0;
  bottom: calc(100% - 3px);
  min-width: 20px;
  padding: 0 1px 2px;
  background: white;
  color: colors.$display-on-primary;
  border: 1px solid hsl(130, 0%, 91%);
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  font-feature-settings: "palt" 1;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.note-bar {
  position: absolute;
  width: calc(100% + 1px);
  height: 100%;
  background-color: colors.$primary;
  border: 1px solid hsl(130, 35%, 86%);
  border-radius: 2px;
  cursor: move;
}

.note-left-edge {
  position: absolute;
  top: 0;
  left: -1px;
  width: 5px;
  height: 100%;
  cursor: ew-resize;
}

.note-right-edge {
  position: absolute;
  top: 0;
  right: -1px;
  width: 5px;
  height: 100%;
  cursor: ew-resize;
}

.note-lyric-input {
  position: absolute;
  top: 1px;
  width: 40px;
  border: 1px solid hsl(33, 100%, 73%);
  border-radius: 3px;
}
</style>
