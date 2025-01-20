<template>
  <div
    class="sequencer-ruler-loop-lane"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-empty': isEmpty,
      [cursorClass]: true,
    }"
    @click.stop
    @contextmenu.prevent="handleContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="24"
      shape-rendering="crispEdges"
    >
      <!-- ループエリア -->
      <rect
        x="0"
        y="0"
        :width
        height="24"
        rx="6"
        ry="6"
        class="loop-background"
        @mousedown.stop="handleLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        v-if="!isEmpty"
        :x="loopStartX - offset + 4"
        y="4"
        :width="Math.max(loopEndX - loopStartX - 8, 0)"
        height="8"
        rx="2"
        ry="2"
        class="loop-range"
        @click.stop="handleLoopRangeClick"
      />
      <!-- ループ開始ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopStartX - offset"
          y="0"
          width="2"
          height="24"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-start"
          :class="{ 'is-empty': isEmpty }"
          @mousedown.stop="handleStartHandleMouseDown"
        />
        <rect
          :x="loopStartX - offset - 2"
          y="0"
          width="8"
          height="24"
          class="loop-handle-drag-area"
          @mousedown.stop="handleStartHandleMouseDown"
        />
      </g>
      <!-- ループ終了ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopEndX - offset - 2"
          y="0"
          width="2"
          height="24"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-end"
          :class="{ 'is-empty': isEmpty }"
          @mousedown.stop="handleEndHandleMouseDown"
        />
        <rect
          :x="loopEndX - offset - 6"
          y="0"
          width="8"
          height="24"
          class="loop-handle-drag-area"
          @mousedown.stop="handleEndHandleMouseDown"
        />
      </g>
    </svg>
    <ContextMenu :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import { UnreachableError } from "@/type/utility";

// カーソル状態の管理
type CursorState = "default" | "ew-resize";
const cursorState = ref<CursorState>("default");
const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "ew-resize":
      return "cursor-ew-resize";
    default:
      return "";
  }
});

const props = defineProps<{
  width: number;
  offset: number;
}>();

// TODO: Containerに責務を移動
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

// 基本パラメータ
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

// ループのX座標を計算
const loopStartX = computed(() =>
  Math.round(
    tickToBaseX(currentLoopStartTick.value, tpqn.value) * sequencerZoomX.value,
  ),
);
const loopEndX = computed(() =>
  Math.round(
    tickToBaseX(currentLoopEndTick.value, tpqn.value) * sequencerZoomX.value,
  ),
);

// ドラッグ関連の状態
const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);
const dragStartHandleX = ref(0);
let lastMouseEvent: MouseEvent | null = null;

// ループが空かどうか
const isEmpty = computed(
  () => currentLoopStartTick.value === currentLoopEndTick.value,
);

// プレビュー関連
const executePreviewProcess = ref(false);
let previewRequestId: number | null = null;

// イベントハンドラ
const handleLoopAreaMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;

  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const x = clickX + props.offset;
  const tick = snapToGrid(baseXToTick(x / sequencerZoomX.value, tpqn.value));

  previewLoopStartTick.value = tick;
  previewLoopEndTick.value = tick;
  void setLoopRange(tick, tick);
  startDragging("end", event);
};

const handleLoopRangeClick = async () => {
  await setLoopEnabled(!isLoopEnabled.value);
};

// ドラッグ開始処理
const startDragging = (target: "start" | "end", event: MouseEvent) => {
  if (event.button !== 0) return;

  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;

  previewLoopStartTick.value = loopStartTick.value;
  previewLoopEndTick.value = loopEndTick.value;

  cursorState.value = "ew-resize";
  lastMouseEvent = event;
  executePreviewProcess.value = true;
  if (previewRequestId == null) {
    previewRequestId = requestAnimationFrame(preview);
  }
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

// マウス移動処理
const handleMouseMove = (event: MouseEvent) => {
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
          dragStartHandleX.value = newX;
        }
      }
      // 終了ハンドルのドラッグ
      if (dragTarget.value === "end") {
        if (newTick >= previewLoopStartTick.value) {
          previewLoopEndTick.value = newTick;
        } else {
          // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
          previewLoopEndTick.value = previewLoopStartTick.value;
          previewLoopStartTick.value = newTick;
          dragTarget.value = "start";
          dragStartX.value = event.clientX;
          dragStartHandleX.value = newX;
        }
      }
    } catch (error) {
      throw new Error("Failed to update loop range", { cause: error });
    }
  }

  if (isDragging.value) {
    previewRequestId = requestAnimationFrame(preview);
  } else {
    previewRequestId = null;
  }
};

// ドラッグ終了処理
const stopDragging = () => {
  if (!isDragging.value) return;

  isDragging.value = false;
  dragTarget.value = null;
  executePreviewProcess.value = false;
  cursorState.value = "default";
  window.removeEventListener("mousemove", handleMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);

  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  try {
    // ループ範囲を設定
    void setLoopRange(previewLoopStartTick.value, previewLoopEndTick.value);
    // 再生ヘッドがループ開始位置にあるか
    // FIXME: usePlayheadPosition実装が完了したら移動
    const isPlayheadToLoopStart =
      previewLoopStartTick.value !== previewLoopEndTick.value;
    if (isPlayheadToLoopStart) {
      try {
        void store.dispatch("SET_PLAYHEAD_POSITION", {
          position: previewLoopStartTick.value,
        });
      } catch (error) {
        throw new Error("Failed to move playhead", { cause: error });
      }
    }
  } catch (error) {
    throw new UnreachableError("Failed to set loop range");
  }
};

const handleStartHandleMouseDown = (event: MouseEvent) => {
  startDragging("start", event);
};

const handleEndHandleMouseDown = (event: MouseEvent) => {
  startDragging("end", event);
};

const handleAddOneMeasureLoop = (x: number) => {
  addOneMeasureLoop(x, props.offset, tpqn.value, sequencerZoomX.value);
};

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextMenuPosition.value = event.clientX - rect.left;
};

const contextMenuPosition = ref(0);

// コンテキストメニューのデータ
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  const contextMenu = ref<InstanceType<typeof ContextMenu>>();
  return [
    {
      type: "button",
      label: isLoopEnabled.value ? "ループ無効" : "ループ有効",
      onClick: () => {
        contextMenu.value?.hide();
        void setLoopEnabled(!isLoopEnabled.value);
      },
      disabled: contextMenuPosition.value == null,
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
  cursorState.value = "default";
  window.removeEventListener("mousemove", handleMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
  }
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler-loop-lane {
  height: 24px;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
  width: 100%;
  top: -24px;
  isolation: isolate;

  &.cursor-ew-resize {
    cursor: ew-resize;
  }

  &:hover .loop-background {
    fill: var(--scheme-color-sing-loop-area);
  }

  &.is-enabled {
    .loop-range {
      fill: color-mix(
        in oklch,
        var(--scheme-color-primary-fixed-dim) 40%,
        var(--scheme-color-sing-loop-area)
      );
    }

    .loop-handle {
      fill: var(--scheme-color-primary-fixed-dim);
      stroke: var(--scheme-color-primary-fixed-dim);
    }
  }

  &:not(.is-enabled):not(.is-dragging) {
    .loop-range {
      opacity: 0.6;
    }

    .loop-handle {
      opacity: 0.6;
    }
  }

  &.is-dragging {
    .loop-background {
      background: var(--scheme-color-secondary-container);
      opacity: 0.4;
    }

    .loop-range {
      opacity: 0.6;
    }

    .loop-handle {
      fill: var(--scheme-color-primary-fixed);
      stroke: var(--scheme-color-primary-fixed);
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

.loop-background {
  fill: transparent;
  transition: fill 0.1s ease-out;
}

.loop-range {
  fill: var(--scheme-color-outline);

  &-area {
    fill: transparent;
  }
}

.loop-handle {
  fill: var(--scheme-color-outline);
  cursor: ew-resize;

  &.is-empty {
    fill: var(--scheme-color-outline);
  }
}

.loop-handle-group:hover {
  .loop-handle {
    fill: var(--scheme-color-primary-fixed);
  }
}

.loop-handle-drag-area {
  fill: transparent;
  cursor: ew-resize;
}
</style>
