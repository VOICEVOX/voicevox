<template>
  <div
    v-bind="$attrs"
    class="note"
    :class="{
      selected: isSelected,
      preview: isPreview,
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
        'cursor-move': editTargetIsNote && !isResizingNote,
        'cursor-ew-resize': isResizingNote,
      }"
      @mousedown="onBarMouseDown"
      @dblclick="onBarDoubleClick"
    >
      <ContextMenu
        v-if="editTargetIsNote"
        ref="contextMenu"
        :menudata="contextMenuData"
      />
    </div>
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
  <div
    class="note-lyric"
    data-testid="note-lyric"
    :class="{
      selected: isSelected,
      preview: isPreview,
      'preview-lyric': previewLyric != undefined,
      overlapping: hasOverlappingError,
      'invalid-phrase': hasPhraseError,
      'below-pitch': editTargetIsPitch,
    }"
    :style="{
      fontSize: `${height > 16 ? 16 : height - 2}px`,
      lineHeight: `${height}px`,
      transform: `translate3d(${positionX}px,${positionY + height}px,0)`,
    }"
  >
    {{ lyricToDisplay }}
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
  /** ノートが重なっているか */
  isOverlapping: boolean;
  previewLyric: string | null;
  /** ノートがリサイズ中か */
  isResizingNote: boolean;
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
const hasOverlappingError = computed(() => {
  return props.isOverlapping && !props.isPreview;
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

  .note-bar {
    box-sizing: border-box;
    position: absolute;
    width: calc(100% + 1px);
    height: 100%;
    background-color: var(--scheme-color-sing-note-bar-container);
    border: 1px solid var(--scheme-color-sing-note-bar-border);
    border-radius: 4px;
  }

  .note-left-edge {
    position: absolute;
    top: 0;
    left: -2px;
    border-radius: 4px 0 0 4px;
    width: 25%;
    min-width: 4px;
    max-width: 8px;
    height: 100%;

    &:not(:active):hover::before {
      content: "";
      position: absolute;
      top: 0;
      border-radius: 4px 0 0 4px;
      left: 2px;
      width: 100%;
      height: 100%;
      background-color: transparent;
    }

    &:hover {
      cursor: ew-resize;
    }
  }

  .note-right-edge {
    position: absolute;
    top: 0;
    right: -2px;
    border-radius: 0 4px 4px 0;
    width: 25%;
    min-width: 4px;
    max-width: 8px;
    height: 100%;

    &:not(:active):hover::before {
      content: "";
      position: absolute;
      top: 0;
      border-radius: 0 4px 4px 0;
      right: 2px;
      width: 100%;
      height: 100%;
      background-color: transparent;
    }

    &:hover {
      cursor: ew-resize;
    }
  }

  &.selected {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-selected-container);
      border-color: var(--scheme-color-sing-note-bar-selected-border);
      outline: 1px solid var(--scheme-color-sing-note-bar-selected-outline);
      outline-offset: 1px;
    }

    .note-right-edge:not(:active):hover::before,
    .note-left-edge:not(:active):hover::before {
      background-color: transparent;
    }
  }

  &.preview-lyric {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-preview-container);
      border-color: var(--scheme-color-sing-note-bar-preview-border);
      outline-color: var(--scheme-color-sing-note-bar-preview-outline);
    }
  }

  &.overlapping,
  &.invalid-phrase {
    .note-bar {
      background-color: var(--scheme-color-surface-variant);
      border-color: var(--scheme-color-error);
      outline-color: var(--scheme-color-error-container);
    }

    .note-right-edge:not(:active):hover::before,
    .note-left-edge:not(:active):hover::before {
      background-color: transparent;
    }

    &.selected,
    &:active,
    &:focus {
      .note-bar {
        background-color: var(--scheme-color-error-container) !important;
        border-color: var(--scheme-color-error) !important;
        outline-color: var(--scheme-color-error) !important;
      }
    }
  }

  &.below-pitch {
    .note-bar {
      background-color: var(--scheme-color-surface-variant);
      border-color: var(--scheme-color-outline-variant);
      outline: none;
      opacity: 0.8;
    }

    .note-right-edge:hover::before,
    .note-left-edge:hover::before {
      background-color: transparent;
    }

    &.overlapping,
    &.invalid-phrase {
      .note-bar {
        background: var(--scheme-color-surface-variant);
        border-color: var(--scheme-color-error);
        outline: none;
      }
    }
  }

  &.resizing-note {
    cursor: ew-resize;
  }
}

.cursor-move {
  cursor: move;
}

.cursor-ew-resize {
  cursor: ew-resize;
}

.note-lyric {
  backface-visibility: hidden;
  position: absolute;
  left: 1px;
  bottom: 0;
  color: var(--scheme-color-sing-on-note-bar-container);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: -0.1em;
  white-space: nowrap;
  pointer-events: none;
  background: transparent;
  text-shadow:
    // NOTE: 以下の目的でtext-shadowを設定
    // - ノートバーの外側に歌詞が溢れた場合でも歌詞が見えるようにする
    // - エッジホバーとかぶっても歌詞が見えるようにする
    // - 今後ピッチラインや波形などその他と重なっても歌詞が見えるようにする
    -1px -1px 0 var(--scheme-color-sing-note-bar-container),
    1px -1px 0 var(--scheme-color-sing-note-bar-container),
    -1px 1px 0 var(--scheme-color-sing-note-bar-container),
    1px 1px 0 var(--scheme-color-sing-note-bar-container),
    0 -1px 0 var(--scheme-color-sing-note-bar-container),
    0 1px 0 var(--scheme-color-sing-note-bar-container),
    -1px 0 0 var(--scheme-color-sing-note-bar-container),
    1px 0 0 var(--scheme-color-sing-note-bar-container);
  // アンチエイリアス
  -webkit-font-smoothing: antialiased;
  bottom: 100%;
  z-index: 1;
  // NOTE: 以下の目的でz-indexを使用
  // - 特にズーム倍率が高い場合に次のノートに被った場合に見えなくなるため可読性を確保
  // - ピッチラインを文字とノートバーの間に配置する
  // z-indexはあまり使用しない方がよさそうだが使用するのであれば
  // おそらくは抽象的な意味合いごとにz-indexを変数として定義するのがよさそう
  // eg: fixedアイテム: 1010, ポップオーバー: 1020, モーダル: 1050...など

  // 選択中
  &.selected {
    color: var(--scheme-color-sing-on-note-bar-selected-container);
    text-shadow:
      -1px -1px 0 var(--scheme-color-sing-note-bar-selected-container),
      1px -1px 0 var(--scheme-color-sing-note-bar-selected-container),
      -1px 1px 0 var(--scheme-color-sing-note-bar-selected-container),
      1px 1px 0 var(--scheme-color-sing-note-bar-selected-container),
      0 -1px 0 var(--scheme-color-sing-note-bar-selected-container),
      0 1px 0 var(--scheme-color-sing-note-bar-selected-container),
      -1px 0 0 var(--scheme-color-sing-note-bar-selected-container),
      1px 0 0 var(--scheme-color-sing-note-bar-selected-container);
  }

  // プレビュー中
  &.preview-lyric {
    color: var(--scheme-color-sing-on-note-bar-preview-container);
    text-shadow:
      -1px -1px 0 var(--scheme-color-sing-note-bar-preview-container),
      1px -1px 0 var(--scheme-color-sing-note-bar-preview-container),
      -1px 1px 0 var(--scheme-color-sing-note-bar-preview-container),
      1px 1px 0 var(--scheme-color-sing-note-bar-preview-container),
      0 -1px 0 var(--scheme-color-sing-note-bar-preview-container),
      0 1px 0 var(--scheme-color-sing-note-bar-preview-container),
      -1px 0 0 var(--scheme-color-sing-note-bar-preview-container),
      1px 0 0 var(--scheme-color-sing-note-bar-preview-container);
    opacity: 0.38;
  }

  // エラー
  &.invalid-phrase,
  &.overlapping {
    color: var(--scheme-color-on-error-container);
    text-shadow: none;
    opacity: 0.38;
  }

  // ピッチ編集モード
  &.below-pitch {
    color: var(--scheme-color-on-surface-variant);
    text-shadow:
      -1px -1px 0 var(--scheme-color-surface-variant),
      1px -1px 0 var(--scheme-color-surface-variant),
      -1px 1px 0 var(--scheme-color-surface-variant),
      1px 1px 0 var(--scheme-color-surface-variant),
      0 -1px 0 var(--scheme-color-surface-variant),
      0 1px 0 var(--scheme-color-surface-variant),
      -1px 0 0 var(--scheme-color-surface-variant),
      1px 0 0 var(--scheme-color-surface-variant);
  }
}
</style>
