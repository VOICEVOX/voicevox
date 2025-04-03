<template>
  <div
    class="loop-lane"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-empty': isLoopEmpty,
      [cursorClass]: true,
    }"
    :style="{ width: `${width}px` }"
    @click.stop
    @mousedown.stop="handleLoopAreaMouseDown"
    @mouseup.stop
    @contextmenu.prevent="handleContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="16"
      shape-rendering="crispEdges"
    >
      <!-- ループ範囲 -->
      <rect
        v-if="!isLoopEmpty"
        :x="loopStartX - offset + 4"
        y="0"
        :width="Math.max(loopEndX - loopStartX - 8, 0)"
        height="4"
        rx="2"
        ry="2"
        class="loop-range"
        @click.stop="handleLoopRangeClick"
        @dblclick.stop="handleLoopRangeDoubleClick"
      />
      <!-- ループ開始ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopStartX - offset"
          y="0"
          width="2"
          height="16"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-start"
          :class="{ 'is-empty': isLoopEmpty }"
          @mousedown.stop="handleStartHandleMouseDown"
        />
        <!-- 開始ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
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
          height="16"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-end"
          :class="{ 'is-empty': isLoopEmpty }"
          @mousedown.stop="handleEndHandleMouseDown"
        />
        <!-- 終了ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
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
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";

defineOptions({
  name: "LoopLanePresentation",
});

defineProps<{
  width: number;
  offset: number;
  loopStartX: number;
  loopEndX: number;
  isLoopEnabled: boolean;
  isDragging: boolean;
  isLoopEmpty: boolean;
  cursorClass: string;
  contextMenuData: ContextMenuItemData[];
}>();

const emit = defineEmits<{
  (e: "loopAreaMouseDown", event: MouseEvent): void;
  (e: "loopRangeClick"): void;
  (e: "loopRangeDoubleClick"): void;
  (e: "startHandleMouseDown", event: MouseEvent): void;
  (e: "endHandleMouseDown", event: MouseEvent): void;
  (e: "contextMenu", event: MouseEvent): void;
}>();

const handleLoopAreaMouseDown = (event: MouseEvent) => {
  emit("loopAreaMouseDown", event);
};

const handleLoopRangeClick = () => {
  emit("loopRangeClick");
};

const handleLoopRangeDoubleClick = () => {
  emit("loopRangeDoubleClick");
};

const handleStartHandleMouseDown = (event: MouseEvent) => {
  emit("startHandleMouseDown", event);
};

const handleEndHandleMouseDown = (event: MouseEvent) => {
  emit("endHandleMouseDown", event);
};

const handleContextMenu = (event: MouseEvent) => {
  emit("contextMenu", event);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

// ループ背景
.loop-lane {
  border-radius: 6px;
  height: 16px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 0.2s ease-out;

  // カーソル状態
  &.cursor-ew-resize {
    cursor: ew-resize;
  }

  // ホバー状態
  &:hover {
    background: var(--scheme-color-sing-ruler-surface-hover);
  }
}

// ループ範囲(ループ上部の背景)
.loop-range {
  fill: var(--scheme-color-primary);

  &-area {
    fill: transparent;
  }
}

// ループハンドル
.loop-handle {
  fill: var(--scheme-color-primary);
  cursor: ew-resize;

  &-drag-area {
    fill: transparent;
    cursor: ew-resize;
  }

  &-group {
    &:hover {
      cursor: ew-resize;
    }
  }
}

// ホバー時のハンドル強調（ドラッグ中以外）
.loop-lane:not(.is-dragging) {
  .loop-handle-group:hover {
    .loop-handle {
      opacity: 1;
      stroke-width: 1.5px;
    }
  }
}

// ループ有効時
.loop-lane.is-enabled {
  .loop-range {
    fill: var(--scheme-color-primary);
    opacity: 0.5;
  }

  .loop-handle {
    fill: var(--scheme-color-primary);
    stroke: var(--scheme-color-primary);
    opacity: 1;

    &:hover {
      opacity: 1;
    }
  }
}

// ループ無効時
.loop-lane:not(.is-enabled):not(.is-dragging) {
  .loop-range {
    fill: var(--scheme-color-outline);
    opacity: 0.38;
  }

  .loop-handle {
    fill: var(--scheme-color-outline);
    stroke: var(--scheme-color-outline);
    opacity: 0.5;

    &:hover {
      fill: var(--scheme-color-secondary);
      stroke: var(--scheme-color-secondary);
    }
  }
}

// ドラッグ中
.loop-lane.is-dragging {
  background: var(--scheme-color-sing-ruler-surface-hover);

  // ドラッグ中かつ有効
  &.is-enabled {
    .loop-handle {
      fill: var(--scheme-color-primary-fixed-dim);
      stroke: var(--scheme-color-primary-fixed-dim);
      stroke-width: 1.5px;
    }
  }

  // ドラッグ中かつ無効
  &:not(.is-enabled) {
    .loop-range {
      fill: var(--scheme-color-outline);
    }

    .loop-handle {
      fill: var(--scheme-color-secondary);
      stroke: var(--scheme-color-secondary);
      stroke-width: 1.5px;
    }
  }
}

// 空の状態のスタイル
.loop-lane.is-empty {
  // 空かつドラッグ中でない
  &:not(.is-dragging) {
    .loop-range,
    .loop-handle,
    .loop-drag-area {
      display: none;
    }
  }

  // 空かつドラッグ中
  &.is-dragging {
    .loop-handle {
      fill: var(--scheme-color-outline);
      stroke: var(--scheme-color-outline);
      opacity: 0.5;
    }
  }

  // 空のハンドル
  .loop-handle.is-empty {
    fill: var(--scheme-color-outline);
    opacity: 0.5;
  }
}
</style>
