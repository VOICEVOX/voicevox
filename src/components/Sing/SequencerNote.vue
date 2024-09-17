<template>
  <div class="note" :class="noteClasses" :style="noteStyle">
    <div
      class="note-bar"
      @mousedown="onBarMouseDown"
      @dblclick="onBarDoubleClick"
    >
      <ContextMenu
        v-if="editTargetIsNote"
        ref="contextMenu"
        :menudata="contextMenuData"
      />
    </div>
    <div class="note-edge left" @mousedown="onLeftEdgeMouseDown"></div>
    <div class="note-edge right" @mousedown="onRightEdgeMouseDown"></div>
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
    <div class="note-lyric" data-testid="note-lyric" :style="lyricStyle">
      {{ lyricToDisplay }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { Note } from "@/store/type";
import { PreviewMode } from "@/type/preload";
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
  /** プレビューモード */
  previewMode: PreviewMode;
  /** このノートが選択中か */
  isSelected: boolean;
  /** このノートがプレビュー中か */
  isPreview: boolean;
  /** ノートが重なっているか */
  isOverlapping: boolean;
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
// 歌詞のフォントサイズをズームにあわせて調整する
// 最小12px, 最大16px, ノートの高さは越えない
const lyricFontSize = computed(() => {
  const minSize = 12;
  const maxSize = 16;
  // ノートの高さを見た目で越えない範囲で最大値を設定
  const baseSize = Math.min(height.value - 6, maxSize);
  // ズームによる拡大率を調整(計算値に特に根拠はない。見た目あわせ。)
  const zoomFactor = Math.max(0.5, Math.min(1.5, zoomX.value / 0.5));
  return Math.max(minSize, Math.min(maxSize, baseSize * zoomFactor));
});
// ノート左端の幅をズームにあわせて調整する
// 最小0px, 最大2px
const lyricLeftPosition = computed(() => {
  const minLeft = 0;
  const maxLeft = 2;
  // ズームによる拡大率を調整(計算値に特に根拠はない。見た目あわせ。)
  const paddingFactor = Math.min(1, zoomX.value / 0.5);
  return minLeft + (maxLeft - minLeft) * paddingFactor;
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

// ノートの状態に応じたCSSクラス
const noteClasses = computed(() => ({
  edit: editTargetIsNote.value,
  "below-pitch": editTargetIsPitch.value,
  selected: props.isSelected,
  preview: props.isPreview,
  "preview-lyric": props.previewLyric != null,
  error: hasOverlappingError.value || hasPhraseError.value,
  overlapping: hasOverlappingError.value,
  "invalid-phrase": hasPhraseError.value,
  "resize-note-right":
    props.previewMode === "RESIZE_NOTE_RIGHT" && props.isPreview,
  "resize-note-left":
    props.previewMode === "RESIZE_NOTE_LEFT" && props.isPreview,
  "move-note": props.previewMode === "MOVE_NOTE" && props.isPreview,
}));

// ノートのスタイル
const noteStyle = computed(() => ({
  width: `${width.value}px`,
  height: `${height.value}px`,
  transform: `translate3d(${positionX.value}px,${positionY.value}px,0)`, // ノートの位置
}));

// ノートの歌詞のスタイル。位置およびサイズを調整
const lyricStyle = computed(() => ({
  fontSize: `${lyricFontSize.value}px`,
  left: `${lyricLeftPosition.value}px`,
  lineHeight: `${height.value}px`,
  transform: `translate3d(0,${height.value}px,0)`, // ノートに対して歌詞を縦中央に配置
}));
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

@mixin text-outline($color, $size: 1px) {
  text-shadow:
    #{-$size} #{-$size} 0 $color,
    #{$size} #{-$size} 0 $color,
    #{-$size} #{$size} 0 $color,
    #{$size} #{$size} 0 $color,
    0 #{-$size} 0 $color,
    0 #{$size} 0 $color,
    #{-$size} 0 0 $color,
    #{$size} 0 0 $color;
}

.note {
  position: absolute;
  top: 0;
  left: 0;

  // ノートバー
  .note-bar {
    box-sizing: border-box;
    position: absolute;
    width: calc(100% + 1px);
    height: 100%;
    background-color: var(--scheme-color-sing-note-bar-container);
    border: 1px solid var(--scheme-color-sing-note-bar-border);
    border-radius: 5px;
  }

  // ノートの左右の端
  .note-edge {
    position: absolute;
    top: 0;
    width: 25%;
    min-width: 3px;
    max-width: 8px;
    height: 100%;

    &.left {
      left: -2px; // FIXME: 右端のノートの当たり判定に食い込んでしまう
      border-radius: 5px 0 0 5px;
    }
    &.right {
      right: -2px; // FIXME: 左端のノートの当たり判定に食い込んでしまう
      border-radius: 0 5px 5px 0;
    }
  }

  // ノートの歌詞
  .note-lyric {
    position: absolute;
    bottom: 100%;
    color: var(--scheme-color-sing-on-note-bar-container);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: -0.1em;
    white-space: nowrap;
    pointer-events: none;
    @include text-outline(var(--scheme-color-sing-note-bar-container));
    z-index: vars.$z-index-sing-note;
    -webkit-font-smoothing: antialiased;
  }
}

// ノート編集モード
.note.edit {
  .note-bar {
    cursor: move;
  }
  .note-edge {
    cursor: ew-resize;
    &:hover {
      background-color: var(--scheme-color-sing-note-bar-border);
    }
  }

  // 選択中
  &.selected {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-selected-container);
      border-color: var(--scheme-color-sing-note-bar-selected-border);
      outline: 1px solid var(--scheme-color-sing-note-bar-selected-outline);
      outline-offset: 1px;
    }
    .note-edge:hover {
      background-color: var(--scheme-color-sing-note-bar-selected-border);
    }
    .note-lyric {
      color: var(--scheme-color-sing-on-note-bar-selected-container);
      @include text-outline(
        var(--scheme-color-sing-note-bar-selected-container)
      );
    }
  }

  // 右リサイズ中
  &.resize-note-right {
    .note-bar {
      cursor: ew-resize;
    }
    .note-edge:hover {
      cursor: ew-resize;
    }

    .note-edge.right {
      background-color: var(--scheme-color-sing-note-bar-selected-border);
    }

    &.error {
      .note-edge.right {
        background-color: var(--scheme-color-error);
      }
    }
  }

  // 左リサイズ中
  &.resize-note-left {
    .note-bar {
      cursor: ew-resize;
    }
    .note-edge:hover {
      cursor: ew-resize;
    }

    .note-edge.left {
      background-color: var(--scheme-color-sing-note-bar-selected-border);
    }

    &.error {
      .note-edge.left {
        background-color: var(--scheme-color-error);
      }
    }
  }

  // 歌詞プレビュー中
  &.preview-lyric {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-preview-container);
      border-color: var(--scheme-color-sing-note-bar-preview-border);
    }
    .note-edge:hover {
      background-color: var(--scheme-color-sing-note-bar-preview-border);
    }
    .note-lyric {
      color: oklch(
        from var(--scheme-color-sing-on-note-bar-container) l c h / 0.38
      );
      @include text-outline(
        var(--scheme-color-sing-note-bar-preview-container)
      );
    }
  }

  // エラー
  &.error {
    --note-error-container: oklch(
      from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2) h
    );
    .note-bar {
      background-color: var(--note-error-container);
      border-color: var(--scheme-color-error);
    }
    .note-edge:hover {
      background-color: var(--scheme-color-error);
    }
    .note-lyric {
      color: oklch(from var(--scheme-color-on-error-container) l c h / 0.5);
      @include text-outline(var(--note-error-container));
    }

    // 選択中
    &.selected {
      .note-bar {
        background-color: var(--scheme-color-error-container);
        border-color: var(--scheme-color-error);
        outline: 1px solid var(--scheme-color-error);
      }

      .note-lyric {
        color: oklch(from var(--scheme-color-on-error-container) l c h / 0.5);
        @include text-outline(var(--scheme-color-error-container));
      }
    }
  }

  // ドラッグ移動中
  &.move-note {
    cursor: move;
  }
}

// ピッチ編集モード
.note.below-pitch {
  .note-bar {
    background-color: var(--scheme-color-sing-note-bar-below-pitch-container);
    border-color: var(--scheme-color-sing-grid-cell-white);
    border-radius: 6px;
  }
  .note-lyric {
    color: oklch(from var(--scheme-color-on-surface-variant) l c h / 0.8);
    @include text-outline(var(--scheme-color-surface-variant));
    z-index: vars.$z-index-sing-note-lyric;
  }

  .note-edge:hover {
    background-color: inherit;
  }

  // エラー
  &.error {
    --note-error-container: oklch(
      from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2) h
    );
    .note-bar {
      background: var(--note-error-container);
    }
    .note-lyric {
      color: oklch(
        from var(--scheme-color-error) l calc(var(--secondary-c) / 2) h / 0.38
      );
      text-shadow: none;
    }
  }
}
</style>
