<template>
  <div
    class="loop-lane"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-empty': isEmpty,
      [cursorClass]: true,
    }"
    :style="{ width: `${width}px` }"
    @click.stop
    @contextmenu.prevent="handleContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="16"
      shape-rendering="crispEdges"
    >
      <!-- ループエリア -->
      <rect
        x="0"
        y="0"
        :width
        height="16"
        class="loop-background"
        @mousedown.stop="handleLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        v-if="!isEmpty"
        :x="loopStartX - offset + 4"
        y="0"
        :width="Math.max(loopEndX - loopStartX - 8, 0)"
        height="5"
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
          :class="{ 'is-empty': isEmpty }"
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
          :class="{ 'is-empty': isEmpty }"
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
  isEmpty: boolean;
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

// レーン背景
.loop-lane {
  height: 16px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
  z-index: vars.$z-index-sing-loop-background;

  // TODO: ドラッグで追加できることがわかりづらい場合、hoverで変更可能を示す
  /*
  &:hover {
    fill: var(--scheme-color-outline);
  }
  */

  &.cursor-ew-resize {
    cursor: ew-resize;
  }
}

// ループ背景
.loop-background {
  fill: transparent;
  z-index: vars.$z-index-sing-loop-background;
}

// ループ範囲
.loop-range {
  fill: var(--scheme-color-primary);
  z-index: vars.$z-index-sing-loop-range;

  &-area {
    fill: transparent;
  }
}

// ハンドル
.loop-handle {
  fill: var(--scheme-color-primary);
  cursor: ew-resize;
  z-index: vars.$z-index-sing-loop-handle;
  opacity: 0.8;

  &.is-empty {
    fill: var(--scheme-color-outline);
    opacity: 0.5;
  }

  &-drag-area {
    fill: transparent;
    cursor: ew-resize;
  }
}

.loop-handle-group {
  &:hover {
    cursor: ew-resize;
  }
}

.loop-lane {
  // 有効時
  &.is-enabled {
    .loop-range {
      fill: var(--scheme-color-primary);
      opacity: 0.3;
      z-index: vars.$z-index-sing-loop-range;
    }

    .loop-handle {
      fill: var(--scheme-color-primary);
      z-index: vars.$z-index-sing-loop-handle;
    }
  }

  // 無効時
  &:not(.is-enabled):not(.is-dragging) {
    .loop-range {
      fill: var(--scheme-color-outline);
      opacity: 0.3;
    }

    .loop-handle {
      fill: var(--scheme-color-outline);
      stroke: var(--scheme-color-outline-variant);
      opacity: 0.5;
    }
  }

  // ドラッグ中
  &.is-dragging {
    .loop-background {
      fill: var(--scheme-color-surface-variant);
      opacity: 0.1;
    }

    // ドラッグ中（有効時）
    &.is-enabled {
      .loop-range {
        opacity: 0.4;
      }

      .loop-handle {
        fill: var(--scheme-color-primary-fixed-dim);
        stroke: var(--scheme-color-primary-fixed-dim);
        stroke-width: 1.5px;
      }
    }

    // ドラッグ中（無効時）
    &:not(.is-enabled) {
      .loop-range {
        fill: var(--scheme-color-outline);
        opacity: 0.4;
      }

      .loop-handle {
        fill: var(--scheme-color-outline);
        stroke: var(--scheme-color-outline);
        stroke-width: 1.5px;
      }
    }
  }

  // 空の状態
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
      opacity: 0.5;
    }
  }

  // ホバー時（ドラッグ中以外）
  &:not(.is-dragging) {
    .loop-handle-group:hover {
      .loop-handle {
        opacity: 1;
        stroke-width: 1.5px;
      }
    }
  }
}
</style>
