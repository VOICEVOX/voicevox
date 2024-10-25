<template>
  <div
    class="sequencer-loop-control"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-empty': isEmpty,
      [cursorClass]: true,
    }"
    :style="{ height: adjustedHeight + 'px' }"
    @click.stop
    @contextmenu.prevent="onContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="props.width"
      :height="16"
      shape-rendering="crispEdges"
    >
      <!-- 背景エリア -->
      <rect
        x="0"
        y="0"
        :width="props.width"
        height="16"
        rx="6"
        ry="6"
        class="loop-background"
        @mousedown.stop="onLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        :x="loopStartX - offset + 8"
        y="7"
        :width="Math.max(loopEndX - loopStartX - 16, 0)"
        height="2"
        rx="1"
        ry="1"
        class="loop-range"
        @click.stop="onLoopRangeClick"
      />
      <!-- ループ開始ハンドル -->
      <rect
        :x="loopStartX - offset"
        y="0"
        width="6"
        height="16"
        class="loop-handle loop-handle-start"
        :class="{ 'is-empty': isEmpty }"
        @mousedown.stop="onStartHandleMouseDown"
      />
      <!-- ループ終了ハンドル -->
      <rect
        :x="loopEndX - offset - 6"
        y="0"
        width="6"
        height="16"
        class="loop-handle loop-handle-end"
        :class="{ 'is-empty': isEmpty }"
        @mousedown.stop="onEndHandleMouseDown"
      />
    </svg>
    <ContextMenu :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { useCursorState, CursorState } from "@/composables/useCursorState";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";

const props = defineProps<{
  width: number;
  height: number;
  offset: number;
}>();

const store = useStore();
const {
  isLoopEnabled,
  loopStartTick,
  loopEndTick,
  setLoopEnabled,
  setLoopRange,
  clearLoopRange,
  snapToGrid,
  addOneMeasureLoop,
} = useLoopControl();
const { setCursorState, cursorClass } = useCursorState();

// ドラッグ中のループ高さ
const DRAGGING_HEIGHT = props.height;
// ドラッグ中でないループ高さ
const DEFAULT_HEIGHT = 16;

// FIXME: 計算値をcomposableに移動し、コンポーネントから分離したい
// 以下のような要素は広使われると思われるためループ実装においてはcomposableに移動しない
const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);

// ドラッグ中のループ範囲を保持
const previewLoopStartTick = ref(loopStartTick.value);
const previewLoopEndTick = ref(loopEndTick.value);

// 現在のループ範囲
const currentLoopStartTick = computed(() =>
  isDragging.value ? previewLoopStartTick.value : loopStartTick.value,
);
const currentLoopEndTick = computed(() =>
  isDragging.value ? previewLoopEndTick.value : loopEndTick.value,
);

// ループ開始X座標
const loopStartX = computed(
  () =>
    tickToBaseX(currentLoopStartTick.value, tpqn.value) * sequencerZoomX.value,
);
// ループ終了X座標
const loopEndX = computed(
  () =>
    tickToBaseX(currentLoopEndTick.value, tpqn.value) * sequencerZoomX.value,
);

const offset = computed(() => props.offset);

// ドラッグ関連の状態と処理
// FIXME: ドラッグ関連の状態と処理をcomposableに移動したい
const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);
const dragStartHandleX = ref(0);
let lastMouseEvent: MouseEvent | null = null;

// ドラッグエリアの高さ
const adjustedHeight = computed(() =>
  isDragging.value ? DRAGGING_HEIGHT : DEFAULT_HEIGHT,
);

// ループが空かどうか
const isEmpty = computed(
  () => currentLoopStartTick.value === currentLoopEndTick.value,
);

// プレビュー中かどうか
const executePreviewProcess = ref(false);
// RequestAnimationFrameのID
let previewRequestId: number | null = null;

// イベントハンドラ
const onLoopAreaMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;
  if (isDragging.value) {
    void stopDragging();
  }
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left + props.offset;
  const tick = snapToGrid(baseXToTick(x / sequencerZoomX.value, tpqn.value));
  void setLoopRange(tick, tick);
  previewLoopStartTick.value = tick;
  previewLoopEndTick.value = tick;
  startDragging("end", event);
};

// ループエリアのクリック(ループの有無を切り替える)
const onLoopRangeClick = async () => {
  await setLoopEnabled(!isLoopEnabled.value);
};

const onStartHandleMouseDown = (event: MouseEvent) => {
  startDragging("start", event);
};

const onEndHandleMouseDown = (event: MouseEvent) => {
  startDragging("end", event);
};

// ドラッグ開始処理
const startDragging = (target: "start" | "end", event: MouseEvent) => {
  if (event.button !== 0) return;
  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;

  // ドラッグ開始時に現行のループ範囲をプレビュー用にコピー
  previewLoopStartTick.value = loopStartTick.value;
  previewLoopEndTick.value = loopEndTick.value;

  setCursorState(CursorState.EW_RESIZE);
  executePreviewProcess.value = true;
  if (previewRequestId == null) {
    previewRequestId = requestAnimationFrame(preview);
  }
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

// マウス移動処理
const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return;
  lastMouseEvent = event;
  executePreviewProcess.value = true;
};

// プレビュー処理
const preview = () => {
  if (executePreviewProcess.value && lastMouseEvent) {
    executePreviewProcess.value = false;
    const event = lastMouseEvent;

    // ドラッグ中のX座標
    const dx = event.clientX - dragStartX.value;
    // ドラッグ中のハンドル位置
    const newX = dragStartHandleX.value + dx;
    // ドラッグ中の基準tick
    const baseTick = baseXToTick(newX / sequencerZoomX.value, tpqn.value);
    // ドラッグ中の新しいtick（スナップされたtick）
    const newTick = Math.max(0, snapToGrid(baseTick));

    try {
      // 開始ハンドルのドラッグ
      if (dragTarget.value === "start") {
        if (newTick <= previewLoopEndTick.value) {
          previewLoopStartTick.value = newTick;
        } else {
          // 開始ハンドルが終了ハンドルを超えた場合、開始と終了を入れ替える
          previewLoopStartTick.value = previewLoopEndTick.value;
          previewLoopEndTick.value = newTick;
          dragTarget.value = "end";
          dragStartX.value = event.clientX;
          dragStartHandleX.value =
            tickToBaseX(previewLoopEndTick.value, tpqn.value) *
            sequencerZoomX.value;
        }
      }
      // 終了ハンドルのドラッグ
      else if (dragTarget.value === "end") {
        if (newTick >= previewLoopStartTick.value) {
          previewLoopEndTick.value = newTick;
        } else {
          // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
          previewLoopEndTick.value = previewLoopStartTick.value;
          previewLoopStartTick.value = newTick;
          dragTarget.value = "start";
          dragStartX.value = event.clientX;
          dragStartHandleX.value =
            tickToBaseX(previewLoopStartTick.value, tpqn.value) *
            sequencerZoomX.value;
        }
      }
    } catch (error) {
      console.error("Failed to update loop range", error);
    }
  }

  if (isDragging.value) {
    previewRequestId = requestAnimationFrame(preview);
  } else {
    previewRequestId = null;
  }
};

// ドラッグ終了処理
const stopDragging = async () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  dragTarget.value = null;
  executePreviewProcess.value = false;
  setCursorState(CursorState.UNSET);
  window.removeEventListener("mousemove", onMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);

  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  try {
    await setLoopRange(previewLoopStartTick.value, previewLoopEndTick.value);
    const isPlayheadToLoopStart =
      previewLoopStartTick.value !== previewLoopEndTick.value;
    if (isPlayheadToLoopStart) {
      try {
        await store.dispatch("SET_PLAYHEAD_POSITION", {
          position: previewLoopStartTick.value,
        });
      } catch (error) {
        console.error("Failed to move playhead", error);
      }
    }
  } catch (error) {
    console.error("Failed to set loop range", error);
  }
};

// コンキストメニュー位置に1小節のループ範囲を作成する
const handleAddOneMeasureLoop = (x: number) => {
  addOneMeasureLoop(x, props.offset, tpqn.value, sequencerZoomX.value);
};

const onContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextMenuPosition.value = event.clientX - rect.left;
};
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuPosition = ref<number | null>(null);
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  return [
    {
      type: "button",
      label: isLoopEnabled.value ? "ループ無効" : "ループ有効",
      onClick: () => {
        contextMenu.value?.hide();
        void setLoopEnabled(!isLoopEnabled.value);
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "ループ範囲を作成",
      onClick: () => {
        contextMenu.value?.hide();
        if (contextMenuPosition.value != null) {
          handleAddOneMeasureLoop(contextMenuPosition.value);
        }
      },
      disabled: contextMenuPosition.value == null,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "ループ範囲を削除",
      onClick: () => {
        contextMenu.value?.hide();
        void clearLoopRange();
      },
      disabled: isEmpty.value,
      disableWhenUiLocked: true,
    },
  ];
});

onUnmounted(() => {
  setCursorState(CursorState.UNSET);
  window.removeEventListener("mousemove", onMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
  }
});
</script>

<style scoped lang="scss">
.sequencer-loop-control {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: auto;
  cursor: pointer;
  z-index: 100;

  &.cursor-ew-resize {
    cursor: ew-resize;
  }

  // ホバー時のループエリア
  &:hover .loop-background {
    fill: var(--scheme-color-sing-loop-area);
  }

  &.is-enabled {
    .loop-range {
      fill: var(--scheme-color-primary-fixed-dim);
    }

    .loop-handle {
      fill: var(--scheme-color-primary-fixed-dim);
      stroke: var(--scheme-color-primary-fixed-dim);
    }
  }

  &.is-dragging {
    .loop-background {
      background: var(--scheme-color-secondary-container);
      opacity: 0.6;
    }

    .loop-range {
      fill: var(--scheme-color-outline);
      opacity: 0.38;
    }

    .loop-handle {
      fill: var(--scheme-color-tertiary-fixed);
      stroke: var(--scheme-color-tertiary-fixed);
    }
  }

  &.is-empty:not(.is-dragging) {
    .loop-range,
    .loop-handle,
    .loop-drag-area {
      display: none;
    }
  }

  &.is-dragging.is-empty {
    .loop-handle {
      fill: var(--scheme-color-outline);
      stroke: var(--scheme-color-outline);
      opacity: 0.38;
    }
  }

  &:not(.is-dragging) {
    .loop-handle {
      &:hover,
      &-start:hover,
      &-end:hover {
        fill: var(--scheme-color-primary-fixed);
        outline: 2px solid
          oklch(from var(--scheme-color-primary-fixed) l c h / 0.5);
        outline-offset: 1px;
      }
    }
  }
}

// ループエリア
.loop-background {
  fill: transparent;
  transition: fill 0.1s ease-out;
}

// ループ範囲
.loop-range {
  fill: var(--scheme-color-outline);
  opacity: 1;

  &-area {
    fill: transparent;
  }
}

// ループハンドル
.loop-handle {
  fill: var(--scheme-color-outline);
  cursor: ew-resize;
  border-radius: 1px 1px 3px 3px;

  &.is-empty {
    fill: var(--scheme-color-outline);
  }
}

.loop-drag-area {
  fill: transparent;
  cursor: ew-resize;
}
</style>
