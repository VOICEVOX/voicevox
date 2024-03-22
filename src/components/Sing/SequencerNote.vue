<template>
  <div
    class="note"
    :class="{
      selected: noteState === 'SELECTED',
      overlapping: hasOverlappingError,
      'invalid-phrase': hasPhraseError,
      'below-pitch': showPitch,
    }"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <div class="note-bar" @mousedown="onBarMouseDown">
      <div class="note-left-edge" @mousedown="onLeftEdgeMouseDown"></div>
      <div class="note-right-edge" @mousedown="onRightEdgeMouseDown"></div>
      <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
    </div>
    <!-- TODO: ピッチの上に歌詞入力のinputが表示されるようにする -->
    <div
      class="note-lyric"
      data-testid="note-lyric"
      @mousedown="onLyricMouseDown"
    >
      {{ lyric }}
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
    <template v-else>
      <!-- エラー内容を表示 -->
      <QTooltip
        v-if="hasOverlappingError"
        anchor="bottom left"
        self="top left"
        :offset="[0, 8]"
        transition-show=""
        transition-hide=""
      >
        ノートが重なっています
      </QTooltip>
      <QTooltip
        v-if="hasPhraseError"
        anchor="bottom left"
        self="top left"
        :offset="[0, 8]"
        transition-show=""
        transition-hide=""
      >
        フレーズが生成できません。歌詞は日本語1文字までです。
      </QTooltip>
    </template>
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
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";

type NoteState = "NORMAL" | "SELECTED";

const vFocus = {
  mounted(el: HTMLInputElement) {
    el.focus();
    el.select();
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
const tpqn = computed(() => state.tpqn);
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
  return "NORMAL";
});

// ノートの重なりエラー
const hasOverlappingError = computed(() => {
  return state.overlappingNoteIds.has(props.note.id);
});

// フレーズ生成エラー
const hasPhraseError = computed(() => {
  // エラーがあるフレーズに自身が含まれているか
  return Array.from(state.phrases.values()).some(
    (phrase) =>
      phrase.state === "COULD_NOT_RENDER" &&
      phrase.notes.some((note) => note.id === props.note.id)
  );
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
    store.dispatch("COMMAND_UPDATE_NOTES", { notes: [note] });
  },
});
const showLyricInput = computed(() => {
  return state.editingLyricNoteId === props.note.id;
});
const showPitch = computed(() => {
  return state.experimentalSetting.showPitchInSongEditor;
});
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuData = ref<ContextMenuItemData[]>([
  {
    type: "button",
    label: "コピー",
    onClick: async () => {
      contextMenu.value?.hide();
      await store.dispatch("COPY_NOTES_TO_CLIPBOARD");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "切り取り",
    onClick: async () => {
      contextMenu.value?.hide();
      await store.dispatch("COMMAND_CUT_NOTES_TO_CLIPBOARD");
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "クオンタイズ",
    disabled: !props.isSelected,
    onClick: async () => {
      contextMenu.value?.hide();
      await store.dispatch("COMMAND_QUANTIZE_SELECTED_NOTES");
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "削除",
    onClick: async () => {
      contextMenu.value?.hide();
      await store.dispatch("COMMAND_REMOVE_SELECTED_NOTES");
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
  // タブキーで次のノート入力に移動
  if (event.key === "Tab") {
    event.preventDefault();
    const noteId = props.note.id;
    const notes = store.getters.SELECTED_TRACK.notes;
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
  // IME変換確定時のEnterを無視する
  if (event.key === "Enter" && event.isComposing) {
    return;
  }
  // IME変換でなければ入力モードを終了
  if (event.key === "Enter" && !event.isComposing) {
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

  &.below-pitch {
    .note-bar {
      background-color: rgba(colors.$primary-rgb, 0.18);
      border-color: hsl(130, 35%, 78%);
    }
  }

  &.selected {
    // 色は仮
    .note-bar {
      background-color: hsl(33, 100%, 50%);
    }

    &.below-pitch {
      .note-bar {
        background-color: rgba(hsl(33, 100%, 50%), 0.18);
      }
    }
  }

  &.overlapping,
  &.invalid-phrase {
    .note-bar {
      background-color: rgba(colors.$warning-rgb, 0.5);
    }

    .note-lyric {
      opacity: 0.6;
    }

    &.selected {
      .note-bar {
        background-color: rgba(colors.$warning-rgb, 0.5);
        border-color: colors.$warning;
      }
    }
  }
}

.note-lyric {
  position: absolute;
  left: 0.125rem;
  bottom: 0;
  min-width: 2rem;
  padding: 0;
  background: transparent;
  color: #121212;
  font-size: 1rem;
  font-weight: 700;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff,
    1px 1px 0 #fff;
  white-space: nowrap;
  pointer-events: none;
}

.note-bar {
  position: absolute;
  width: calc(100% + 1px);
  height: 100%;
  background-color: colors.$primary;
  border: 1px solid rgba(colors.$background-rgb, 0.5);
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
  bottom: 0;
  font-weight: 700;
  min-width: 3rem;
  max-width: 6rem;
  border: 0;
  outline: 2px solid colors.$primary;
  border-radius: 0.25rem;
}
</style>
