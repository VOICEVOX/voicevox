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
      resizing: isResizingNote,
      'resizing-right': isResizingRight,
      'resizing-left': isResizingLeft,
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
  /** ノートが右方向にリサイズ中か */
  isResizingRight: boolean;
  /** ノートが左方向にリサイズ中か */
  isResizingLeft: boolean;
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
  // ズームによる拡大率を調整(計算値に特に根拠はない/見た目あわせ)
  const zoomFactor = Math.max(0.5, Math.min(1.5, zoomX.value / 0.5));
  return Math.max(minSize, Math.min(maxSize, baseSize * zoomFactor));
});
// ノート左端の幅をズームにあわせて調整する
// 最小0px, 最大2px
const lyricLeftPosition = computed(() => {
  const minLeft = 0;
  const maxLeft = 2;
  // ズームによる拡大率を調整(計算値に特に根拠はない/見た目あわせ)
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

  .note-bar {
    box-sizing: border-box;
    position: absolute;
    width: calc(100% + 1px);
    height: 100%;
    background-color: var(--scheme-color-sing-note-bar-container);
    border: 1px solid var(--scheme-color-sing-note-bar-border);
    border-radius: 5px;
  }

  .note-left-edge,
  .note-right-edge {
    position: absolute;
    top: 0;
    width: 25%;
    min-width: 3px;
    max-width: 8px;
    height: 100%;
  }

  .note-left-edge {
    left: -2px;
    border-radius: 5px 0 0 5px;
  }

  .note-right-edge {
    right: -2px;
    border-radius: 0 5px 5px 0;
  }

  // リサイズ中
  &:not(.below-pitch) {
    .note-left-edge:hover,
    &.resizing-left .note-left-edge,
    .note-right-edge:hover,
    &.resizing-right .note-right-edge {
      background-color: var(--scheme-color-sing-note-bar-border);
    }

    &.selected {
      .note-left-edge:hover,
      &.resizing-left .note-left-edge,
      .note-right-edge:hover,
      &.resizing-right .note-right-edge {
        background-color: var(--scheme-color-sing-note-bar-selected-border);
      }
    }

    &.preview-lyric {
      .note-left-edge:hover,
      &.resizing-left .note-left-edge,
      .note-right-edge:hover,
      &.resizing-right .note-right-edge {
        background-color: var(--scheme-color-sing-note-bar-preview-border);
      }
    }

    &.overlapping,
    &.invalid-phrase {
      .note-left-edge:hover,
      &.resizing-left .note-left-edge,
      .note-right-edge:hover,
      &.resizing-right .note-right-edge {
        background-color: var(--scheme-color-error);
      }
    }
  }

  &.below-pitch {
    .note-left-edge,
    .note-right-edge {
      &:hover,
      .resizing-left &,
      .resizing-right & {
        background-color: transparent;
        cursor: inherit;
      }
    }
  }

  &.selected {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-selected-container);
      border-color: var(--scheme-color-sing-note-bar-selected-border);
      outline: 1px solid var(--scheme-color-sing-note-bar-selected-outline);
      outline-offset: 1px;
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
    --note-error-container: oklch(
      from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2) h
    );
    .note-bar {
      background-color: var(--note-error-container);
      border-color: var(--scheme-color-error);
      outline-color: var(--scheme-color-error-container);
    }

    &.selected,
    &:active {
      .note-bar {
        background-color: var(--scheme-color-error-container);
        border-color: var(--scheme-color-error);
        outline-color: var(--scheme-color-error);
      }
    }
  }

  &.below-pitch {
    .note-bar {
      background-color: var(--scheme-color-sing-note-bar-below-pitch-container);
      border-color: var(--scheme-color-sing-grid-cell-white);
      outline: 0;
      border-radius: 6px;

      // NOTE: ピッチの基準ライン(現状非表示)
      &:after {
        content: "";
        border-radius: 2px;
        display: none;
        position: absolute;
        left: 0;
        min-height: 6px;
        max-height: 20%;
        top: 50%;
        transform: translateY(-50%);
        width: 100%;
        background-color: transparent;
      }
    }

    &.overlapping,
    &.invalid-phrase {
      .note-bar {
        border-color: 0;
        background: var(--note-error-container);
        outline: none;

        &:after {
          display: none;
        }
      }
    }
  }

  &.resizing {
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
  bottom: 0;
  color: var(--scheme-color-sing-on-note-bar-container);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: -0.1em;
  white-space: nowrap;
  pointer-events: none;
  background: transparent;
  // NOTE: 以下の目的でtext-shadowを設定
  // - ノートバーの外側に歌詞が溢れた場合でも歌詞が見えるようにする
  // - エッジホバーとかぶっても歌詞が見えるようにする
  // - 今後ピッチラインや波形などその他と重なっても歌詞が見えるようにする
  @include text-outline(var(--scheme-color-sing-note-bar-container));
  // アンチエイリアス
  -webkit-font-smoothing: antialiased;
  bottom: 100%;
  // NOTE: 以下の目的でz-indexを使用
  // - 特にズーム倍率が高い場合に次のノートに被った場合に見えなくなるため可読性を確保
  // - ピッチラインを文字とノートバーの間に配置する
  // z-indexはあまり使用しない方がよさそうだが使用するのであれば
  // おそらくは抽象的な意味合いごとにz-indexを変数として定義するのがよさそう
  // eg: fixedアイテム: 1010, ポップオーバー: 1020, モーダル: 1050...など
  z-index: vars.$z-index-sing-note;

  // 選択中
  &.selected {
    color: var(--scheme-color-sing-on-note-bar-selected-container);
    @include text-outline(var(--scheme-color-sing-note-bar-selected-container));
  }

  // プレビュー中
  &.preview-lyric {
    color: oklch(
      from var(--scheme-color-sing-on-note-bar-container) l c h / 0.38
    );
    @include text-outline(var(--scheme-color-sing-note-bar-preview-container));
  }

  // エラー
  &.invalid-phrase,
  &.overlapping {
    --note-error-container: oklch(
      from var(--scheme-color-error-container) l calc(var(--secondary-c) / 2) h
    );
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

  // ピッチ編集モード
  &.below-pitch {
    color: oklch(from var(--scheme-color-on-surface-variant) l c h / 0.8);
    z-index: vars.$z-index-sing-note-lyric;
    @include text-outline(var(--scheme-color-surface-variant));

    &.invalid-phrase,
    &.overlapping {
      color: oklch(
        from var(--scheme-color-error) l calc(var(--secondary-c) / 2) h / 0.38
      );
      text-shadow: none;
    }
  }
}
</style>
