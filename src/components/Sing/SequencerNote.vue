<template>
  <div
    class="note"
    :class="{
      selected: noteState === 'SELECTED',
      'preview-lyric': props.previewLyric != undefined,
      overlapping: hasOverlappingError,
      'invalid-phrase': hasPhraseError,
      'below-pitch': editTargetIsPitch,
    }"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <div
      class="note-bar"
      :class="{
        'cursor-move': editTargetIsNote,
      }"
      @mousedown="onBarMouseDown"
    >
      <div
        class="note-left-edge"
        :class="{
          'cursor-ew-resize': editTargetIsNote,
        }"
        @mousedown="onLeftEdgeMouseDown"
      ></div>
      <div
        class="note-right-edge"
        :class="{
          'cursor-ew-resize': editTargetIsNote,
        }"
        @mousedown="onRightEdgeMouseDown"
      ></div>
      <ContextMenu
        v-if="editTargetIsNote"
        ref="contextMenu"
        :menudata="contextMenuData"
      />
    </div>
    <!-- TODO: ピッチの上に歌詞入力のinputが表示されるようにする -->
    <input
      v-if="showLyricInput"
      v-focus
      :value="lyricToDisplay"
      class="note-lyric-input"
      @input="onLyricInput"
      @mousedown.stop
      @dblclick.stop
      @keydown.stop="onLyricInputKeyDown"
      @blur="onLyricInputBlur"
    />
    <template v-else>
      <div
        class="note-lyric"
        data-testid="note-lyric"
        @mousedown="onLyricMouseDown"
      >
        {{ lyricToDisplay }}
      </div>
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
    previewLyric: string | null;
  }>(),
  {
    isSelected: false,
  },
);

const emit = defineEmits<{
  (name: "barMousedown", event: MouseEvent): void;
  (name: "rightEdgeMousedown", event: MouseEvent): void;
  (name: "leftEdgeMousedown", event: MouseEvent): void;
  (name: "lyricMouseDown", event: MouseEvent): void;
  (name: "lyricInput", text: string): void;
  (name: "lyricBlur"): void;
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
const editTargetIsNote = computed(() => {
  return state.sequencerEditTarget === "NOTE";
});
const editTargetIsPitch = computed(() => {
  return state.sequencerEditTarget === "PITCH";
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
      phrase.notes.some((note) => note.id === props.note.id),
  );
});

// 表示する歌詞。
// 優先度：入力中の歌詞 > 他ノートの入力中の歌詞 > 渡された（=Storeの）歌詞
const lyricToDisplay = computed(
  () => temporaryLyric.value ?? props.previewLyric ?? props.note.lyric,
);
// 歌詞入力中の一時的な歌詞
const temporaryLyric = ref<string | undefined>(undefined);
const showLyricInput = computed(() => {
  return state.editingLyricNoteId === props.note.id;
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
  temporaryLyric.value = undefined;
  emit("lyricBlur");
};
const onLyricInput = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Invalid event target");
  }
  temporaryLyric.value = event.target.value;
  emit("lyricInput", temporaryLyric.value);
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

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

  &:not(.below-pitch) {
    .note-left-edge:hover {
      // FIXME: hoverだとカーソル位置によって適用されないので、プレビュー中に明示的にクラス指定する
      background-color: lab(80, -22.953, 14.365);
    }

    .note-right-edge:hover {
      // FIXME: hoverだとカーソル位置によって適用されないので、プレビュー中に明示的にクラス指定する
      background-color: lab(80, -22.953, 14.365);
    }

    &.selected {
      // 色は仮
      .note-bar {
        background-color: lab(95, -22.953, 14.365);
        border-color: lab(65, -22.953, 14.365);
        outline: solid 2px lab(70, -22.953, 14.365);
      }
    }
  }
  // TODO：もっといい見た目を考える
  &.preview-lyric {
    .note-bar {
      background-color: lab(90, -22.953, 14.365);
      border-color: lab(75, -22.953, 14.365);
      outline: solid 2px lab(80, -22.953, 14.365);
    }

    .note-lyric {
      opacity: 0.38;
    }

    &.below-pitch {
      .note-bar {
        background-color: rgba(hsl(130, 100%, 50%), 0.18);
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
        outline: 2px solid rgba(colors.$warning-rgb, 0.3);
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
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
  white-space: nowrap;
  pointer-events: none;
}

.note-bar {
  box-sizing: border-box;
  position: absolute;
  width: calc(100% + 1px);
  height: 100%;
  background-color: colors.$primary;
  border: 1px solid rgba(colors.$background-rgb, 0.5);
  border-radius: 4px;
}

.note-left-edge {
  position: absolute;
  top: 0;
  left: -1px;
  width: 5px;
  height: 100%;
}

.note-right-edge {
  position: absolute;
  top: 0;
  right: -1px;
  width: 5px;
  height: 100%;
}

.note-lyric-input {
  position: absolute;
  bottom: 0;
  font-weight: 700;
  min-width: 3rem;
  max-width: 6rem;
  border: 0;
  outline: 2px solid lab(80, -22.953, 14.365);
  border-radius: 4px;
}

.cursor-move {
  cursor: move;
}

.cursor-ew-resize {
  cursor: ew-resize;
}
</style>
