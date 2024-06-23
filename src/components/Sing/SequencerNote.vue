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

    &.selected-or-preview {
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

    &.selected-or-preview {
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

.cursor-move {
  cursor: move;
}

.cursor-ew-resize {
  cursor: ew-resize;
}
</style>
