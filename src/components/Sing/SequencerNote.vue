<template>
  <div
    class="note"
    :class="{
      'selected-or-preview': isSelected || isPreview,
      'preview-lyric': previewLyric != undefined,
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
      @dblclick="onBarDoubleClick"
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
    <div class="note-lyric" data-testid="note-lyric">
      {{ lyricToDisplay }}
    </div>
    <!-- エラー内容を表示 -->
    <QTooltip
      v-if="hasOverlappingError"
      anchor="bottom left"
      self="top left"
      :offset="[0, 8]"
      transitionShow=""
      transitionHide=""
    >
      ノートが重なっています
    </QTooltip>
    <QTooltip
      v-if="hasPhraseError"
      anchor="bottom left"
      self="top left"
      :offset="[0, 8]"
      transitionShow=""
      transitionHide=""
    >
      フレーズが生成できません。歌詞は日本語1文字までです。
    </QTooltip>
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

const props = defineProps<{
  note: Note;
  /** どれかのノートがプレビュー中 */
  nowPreviewing: boolean;
  /** このノートが選択中か */
  isSelected: boolean;
  /** このノートがプレビュー中か */
  isPreview: boolean;
  previewLyric: string | null;
}>();

const emit = defineEmits<{
  (name: "barMousedown", event: MouseEvent): void;
  (name: "barDoubleClick", event: MouseEvent): void;
  (name: "rightEdgeMousedown", event: MouseEvent): void;
  (name: "leftEdgeMousedown", event: MouseEvent): void;
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
// 優先度：入力中の歌詞 > 渡された（=Storeの）歌詞
const lyricToDisplay = computed(() => {
  return props.previewLyric ?? props.note.lyric;
});

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  return [
    {
      type: "button",
      label: "コピー",
      disabled: props.nowPreviewing,
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COPY_NOTES_TO_CLIPBOARD");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "切り取り",
      disabled: props.nowPreviewing,
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
      disabled: props.nowPreviewing || !props.isSelected,
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
      disabled: props.nowPreviewing,
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COMMAND_REMOVE_SELECTED_NOTES");
      },
      disableWhenUiLocked: true,
    },
  ];
});

const onBarMouseDown = (event: MouseEvent) => {
  emit("barMousedown", event);
};

const onBarDoubleClick = (event: MouseEvent) => {
  emit("barDoubleClick", event);
};

const onRightEdgeMouseDown = (event: MouseEvent) => {
  emit("rightEdgeMousedown", event);
};

const onLeftEdgeMouseDown = (event: MouseEvent) => {
  emit("leftEdgeMousedown", event);
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.note {
  position: absolute;
  top: 0;
  left: 0;

  .note-lyric {
    position: absolute;
    left: 4px;
    bottom: 0;
    min-width: 2em;
    padding: 0;
    color: var(--md-sys-color-on-primary-fixed);
    font-size: 16px;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    text-shadow:
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95),
      0 0 1px var(--md-ref-palette-neutral-variant-95);
  }

  .note-bar {
    box-sizing: border-box;
    position: absolute;
    width: calc(100% + 1px);
    height: 100%;
    background-color: var(--md-custom-color-sing-note-bar-background);
    border: 1px solid var(--md-sys-color-secondary-fixed-dim);
    border-radius: 4px;
  }

  .note-left-edge {
    position: absolute;
    top: 0;
    left: 0;
    width: 6px;
    height: 100%;

    &:hover {
      // FIXME: hoverだとカーソル位置によって適用されないので、プレビュー中に明示的にクラス指定する
      background-color: var(--md-sys-color-secondary-fixed-dim);
    }
  }

  .note-right-edge {
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;

    &:hover {
      // FIXME: hoverだとカーソル位置によって適用されないので、プレビュー中に明示的にクラス指定する
      background-color: var(--md-sys-color-secondary-fixed-dim);
    }
  }

  &.selected-or-preview {
    .note-bar {
      background-color: var(--md-sys-color-primary-fixed);
      border-color: var(--md-sys-color-primary-fixed-dim);
    }

    .note-right-edge:hover,
    .note-left-edge:hover {
      background-color: var(--md-sys-color-primary-fixed-dim);
    }
  }

  &.below-pitch {
    opacity: 0.38;

    .note-bar {
      background-color: var(--md-sys-color-surface-variant);
      border-color: var(--md-sys-color-outline-variant);
    }

    .note-lyric {
      color: var(--md-sys-color-on-surface);
      text-shadow: none;
    }

    .note-right-edge:hover,
    .note-left-edge:hover {
      background-color: transparent;
    }
  }

  &.preview-lyric {
    .note-bar {
      background-color: var(--md-sys-color-primary-fixed-dim);
      border-color: var(--md-sys-color-primary-fixed);
    }

    .note-lyric {
      opacity: 0.38;
    }
  }

  &.overlapping,
  &.invalid-phrase {
    .note-bar {
      background-color: var(--md-sys-color-surface-variant);
      border-color: var(--md-sys-color-error);
    }

    .note-right-edge:hover,
    .note-left-edge:hover {
      background-color: var(--md-sys-color-error);
    }

    .note-lyric {
      color: var(--md-sys-color-on-surface-variant);
      opacity: 0.38;
      text-shadow: none;
    }

    &.selected-or-preview {
      .note-bar {
        background-color: var(--md-sys-color-error-container);
        border-color: var(--md-sys-color-error);
      }
    }
  }
}

.note-lyric-input {
  position: absolute;
  top: 0;
  font-weight: 500;
  font-size: 16px;
  max-width: 4rem;
  width: fit-content;
  background-color: var(--md-ref-palette-neutral-99);
  color: var(--md-sys-color-on-primary-fixed);
  outline: 2px solid var(--md-sys-color-primary);
  border-radius: 4px;
  border: 0;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.08);
}

.cursor-move {
  cursor: move;
}

.cursor-ew-resize {
  cursor: ew-resize;
}
</style>
