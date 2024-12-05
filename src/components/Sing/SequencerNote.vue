<template>
  <!-- 
   FIXME: z-indexの問題で複数ノート間が重なった際に歌詞が
   かぶって見えない問題があるためノートと歌詞を別々のdivにしている
  -->
  <div
    v-bind="$attrs"
    class="note"
    :class="[classes, cursorClass]"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
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
  </div>
  <div
    class="note-lyric"
    data-testid="note-lyric"
    :class="[classes, cursorClass]"
    :style="{
      fontSize: `${lyricFontSize}px`,
      left: `${lyricLeftPosition}px`,
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
  PreviewMode,
} from "@/sing/viewHelper";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Container.vue";

const props = defineProps<{
  note: Note;
  /** このノートが選択中か */
  isSelected: boolean;
  /** このノートがプレビュー中か */
  isPreview: boolean;
  /** ノートが重なっているか */
  isOverlapping: boolean;
  /** プレビュー中の歌詞 */
  previewLyric: string | null;
  /** プレビュー中か */
  nowPreviewing: boolean;
  /** プレビューモード */
  previewMode: PreviewMode;
  /** カーソルクラス */
  cursorClass: string;
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
// ノート左端から歌詞の左端までの距離をズームにあわせて調整する
// 最小0px, 最大2px
const lyricLeftPosition = computed(() => {
  const minLeft = 0;
  const maxLeft = 2;
  // ズームによるleft位置を調整(計算値に特に根拠はない。見た目あわせ。)
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

// 状態に応じたCSSクラス
const classes = computed(() => {
  return {
    "edit-note": editTargetIsNote.value, // ノート編集モード
    "edit-pitch": editTargetIsPitch.value, // ピッチ編集モード
    selected: props.isSelected, // このノートが選択中
    preview: props.isPreview, // なんらかのプレビュー中
    "preview-lyric": props.previewLyric != undefined, // 歌詞プレビュー中
    overlapping: hasOverlappingError.value, // ノートが重なっている
    "invalid-phrase": hasPhraseError.value, // フレーズ生成エラー
    "below-pitch": editTargetIsPitch.value, // ピッチ編集中
    adding: props.isPreview && props.previewMode === "ADD_NOTE", // ノート追加中
    "resizing-right":
      props.isPreview && props.previewMode === "RESIZE_NOTE_RIGHT", // 右リサイズ中
    "resizing-left":
      props.isPreview && props.previewMode === "RESIZE_NOTE_LEFT", // 左リサイズ中
    idle: props.previewMode === "IDLE", // プレビュー中でない
  };
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
        await store.actions.COPY_NOTES_TO_CLIPBOARD();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "切り取り",
      disabled: props.nowPreviewing,
      onClick: async () => {
        contextMenu.value?.hide();
        await store.actions.COMMAND_CUT_NOTES_TO_CLIPBOARD();
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
        await store.actions.COMMAND_QUANTIZE_SELECTED_NOTES();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "削除",
      disabled: props.nowPreviewing || !props.isSelected,
      onClick: async () => {
        contextMenu.value?.hide();
        await store.actions.COMMAND_REMOVE_SELECTED_NOTES();
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
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

// テキストアウトライン
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

  --note-error-container: oklch(
    from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2) h
  );

  .note-bar {
    box-sizing: border-box;
    position: absolute;
    width: calc(100% + 1px);
    height: 100%;
    background-color: var(--scheme-color-sing-note-bar-container);
    border: 1px solid var(--scheme-color-sing-note-bar-border);
    border-radius: 5px;
  }

  .note-edge {
    position: absolute;
    top: 0;
    width: 25%;
    min-width: 3px;
    max-width: 8px;
    height: 100%;
    background-color: transparent;
    cursor: ew-resize;

    &.left {
      left: -2px; // FIXME: 左隣のノートの右端の当たり判定に食い込んでしまう
      border-radius: 5px 0 0 5px;
    }

    &.right {
      right: -2px; // FIXME: 右隣のノートの左端の当たり判定に食い込んでしまう
      border-radius: 0 5px 5px 0;
    }

    &:hover {
      background-color: var(--scheme-color-sing-note-bar-border);
    }
  }
}

// ノート編集モード
.note.edit-note {
  .note-bar {
    cursor: move;
  }

  .note-edge {
    cursor: ew-resize;

    &:hover {
      background-color: var(--scheme-color-sing-note-bar-border);
    }
  }

  // 選択中のスタイル
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
  }

  // ノート追加中
  &.adding {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-selected-container);
      border-color: var(--scheme-color-sing-note-bar-selected-border);
      outline: 1px solid var(--scheme-color-sing-note-bar-selected-outline);
    }

    .note-edge {
      &:hover {
        background-color: transparent;
      }
    }
  }

  // 右リサイズ中
  &.resizing-right {
    .note-edge.right {
      background-color: var(--scheme-color-sing-note-bar-selected-border);
    }
  }

  // 左リサイズ中
  &.resizing-left {
    .note-edge.left {
      background-color: var(--scheme-color-sing-note-bar-selected-border);
    }
  }

  // 歌詞プレビュー中
  &.preview-lyric {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-preview-container);
      border-color: var(--scheme-color-sing-note-bar-preview-border);
      outline-color: var(--scheme-color-sing-note-bar-preview-outline);
    }
  }

  // エラー状態
  &.overlapping,
  &.invalid-phrase {
    .note-bar {
      background-color: var(--note-error-container);
      border-color: var(--scheme-color-error);
      outline-color: var(--scheme-color-error-container);
    }

    .note-edge:hover {
      background-color: var(--scheme-color-error);
    }

    // 選択中かつエラー状態
    &.selected {
      .note-bar {
        background-color: var(--scheme-color-error-container);
        border-color: var(--scheme-color-error);
        outline-color: var(--scheme-color-error-container);
      }

      .note-edge:hover {
        background-color: var(--scheme-color-error);
      }
    }

    // リサイズ中かつエラー状態
    &.resizing-right {
      .note-edge.right {
        background-color: var(--scheme-color-error);
      }
    }

    &.resizing-left {
      .note-edge.left {
        background-color: var(--scheme-color-error);
      }
    }
  }
}

/* ピッチ編集モード */
.note.edit-pitch {
  // ノートバー
  .note-bar {
    background-color: var(--scheme-color-sing-note-bar-below-pitch-container);
    border-color: var(--scheme-color-sing-grid-cell-white);
    outline: 0;
  }

  .note-edge {
    display: none;
  }

  // エラー状態
  &.overlapping,
  &.invalid-phrase {
    .note-bar {
      background-color: var(--note-error-container);
      border-color: 0;
      outline: none;
    }
  }
}

// 歌詞表示
.note-lyric {
  position: absolute;
  bottom: 100%;
  left: 0;
  transform: translate3d(var(--positionX), var(--positionY + height), 0);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: -0.1em;
  white-space: nowrap;
  pointer-events: none;
  background: transparent;
  color: var(--scheme-color-sing-on-note-bar-container);
  @include text-outline(var(--scheme-color-sing-note-bar-container));
  -webkit-font-smoothing: antialiased;
  z-index: vars.$z-index-sing-note;
}

// ノート編集モード
.note-lyric.edit-note {
  // 選択中
  &.selected,
  // 追加中
  &.adding {
    color: var(--scheme-color-sing-on-note-bar-selected-container);
    @include text-outline(var(--scheme-color-sing-note-bar-selected-container));
  }

  // 歌詞プレビュー中
  &.preview-lyric {
    color: oklch(
      from var(--scheme-color-sing-on-note-bar-container) l c h / 0.38
    );
    @include text-outline(var(--scheme-color-sing-note-bar-preview-container));
  }

  // エラー状態
  &.invalid-phrase,
  &.overlapping {
    color: oklch(from var(--scheme-color-on-error-container) l c h / 0.5);
    @include text-outline(
      oklch(
        from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2)
          h
      )
    );

    &.selected {
      @include text-outline(var(--scheme-color-error-container));
    }
  }
}

// ピッチ編集モード
.note-lyric.edit-pitch {
  color: oklch(from var(--scheme-color-on-surface-variant) l c h / 0.8);
  z-index: vars.$z-index-sing-note-lyric;
  @include text-outline(var(--scheme-color-surface-variant));

  // エラー状態
  &.invalid-phrase,
  &.overlapping {
    color: oklch(
      from var(--scheme-color-error) l calc(var(--secondary-c) / 2) h / 0.38
    );
    text-shadow: none;
  }
}

// カーソルの状態
.note {
  &.cursor-default,
  &.cursor-draw,
  &.cursor-ew-resize,
  &.cursor-crosshair,
  &.cursor-move,
  &.cursor-erase {
    .note-bar,
    .note-edge {
      cursor: inherit;
    }
  }

  // ノートの編集の場合でプレビュー中ではない場合はノートバーをドラッグできる
  &.idle.edit-note {
    .note-bar {
      cursor: move;
    }

    .note-edge {
      cursor: ew-resize;
    }
  }
}
</style>
