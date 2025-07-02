<template>
  <div
    class="loop-lane"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-range-zero': isLoopRangeZero,
      [cursorClass]: true,
    }"
    :style="{ width: `${width}px` }"
    @click.stop
    @mousedown.stop="handleLoopAreaMouseDown"
    @mouseup.stop
    @mousemove="handleLaneMouseMove"
    @mouseenter="handleLaneMouseEnter"
    @mouseleave="handleLaneMouseLeave"
    @contextmenu.prevent="handleContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="16"
      shape-rendering="crispEdges"
    >
      <!-- ループ範囲 -->
      <g v-if="!isLoopRangeZero" class="loop-range-group">
        <rect
          :x="loopStartX - offset + 4"
          y="0"
          :width="Math.max(loopEndX - loopStartX - 8, 0)"
          height="4"
          rx="2"
          ry="2"
          class="loop-range"
        />
        <!-- ループ範囲のドラッグエリア(クリックしやすくするためループ範囲よりも大きい) -->
        <rect
          :x="loopStartX - offset + 4"
          y="0"
          :width="Math.max(loopEndX - loopStartX - 8, 0)"
          height="8"
          class="loop-range-drag-area"
          @click.stop="handleLoopRangeClick"
          @dblclick.stop="handleLoopRangeDoubleClick"
          @mousedown.stop
          @mouseenter="handleLoopRangeMouseEnter"
          @mouseleave="handleLoopRangeMouseLeave"
        />
      </g>
      <!-- ループ開始ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopStartX - offset - 2"
          y="0"
          width="2"
          height="16"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-start"
          :class="{ 'is-range-zero': isLoopRangeZero }"
          @mousedown.stop="handleLoopStartMouseDown"
        />
        <!-- 開始ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
        <rect
          :x="loopStartX - offset - 5"
          y="0"
          width="12"
          height="24"
          class="loop-handle-drag-area"
          @mousedown.stop="handleLoopStartMouseDown"
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
          :class="{ 'is-range-zero': isLoopRangeZero }"
          @mousedown.stop="handleLoopEndMouseDown"
        />
        <!-- 終了ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
        <rect
          :x="loopEndX - offset - 5"
          y="0"
          width="12"
          height="24"
          class="loop-handle-drag-area"
          @mousedown.stop="handleLoopEndMouseDown"
        />
      </g>
    </svg>
    <ContextMenu :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import type { TimeSignature } from "@/domain/project/type";

defineOptions({
  name: "LoopLanePresentation",
});

const props = defineProps<{
  width: number;
  offset: number;
  loopStartX: number;
  loopEndX: number;
  isLoopEnabled: boolean;
  isDragging: boolean;
  cursorClass: string;
  contextMenuData: ContextMenuItemData[];
  tpqn: number;
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  snapTicks: number;
}>();

const emit = defineEmits<{
  (e: "loopAreaMouseDown", event: MouseEvent): void;
  (e: "loopRangeClick"): void;
  (e: "loopRangeDoubleClick"): void;
  (e: "loopStartMouseDown", event: MouseEvent): void;
  (e: "loopEndMouseDown", event: MouseEvent): void;
  (e: "contextMenu", event: MouseEvent): void;
  (e: "laneMouseMove", event: MouseEvent): void;
  (e: "laneMouseEnter"): void;
  (e: "laneMouseLeave"): void;
  (e: "loopRangeMouseEnter"): void;
  (e: "loopRangeMouseLeave"): void;
}>();

// 範囲ゼロにするとそのあと消えるよ、という表現のためのもの
const isLoopRangeZero = computed(() => props.loopStartX === props.loopEndX);

const handleLoopAreaMouseDown = (event: MouseEvent) => {
  emit("loopAreaMouseDown", event);
};

const handleLaneMouseMove = (event: MouseEvent) => {
  emit("laneMouseMove", event);
};

const handleLaneMouseEnter = () => {
  emit("laneMouseEnter");
};

const handleLaneMouseLeave = () => {
  emit("laneMouseLeave");
};

const handleLoopRangeClick = () => {
  emit("loopRangeClick");
};

const handleLoopRangeDoubleClick = () => {
  emit("loopRangeDoubleClick");
};

const handleLoopStartMouseDown = (event: MouseEvent) => {
  emit("loopStartMouseDown", event);
};

const handleLoopEndMouseDown = (event: MouseEvent) => {
  emit("loopEndMouseDown", event);
};

const handleContextMenu = (event: MouseEvent) => {
  emit("contextMenu", event);
};

const handleLoopRangeMouseEnter = () => {
  emit("loopRangeMouseEnter");
};

const handleLoopRangeMouseLeave = () => {
  emit("loopRangeMouseLeave");
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
  background-color: transparent;
  transition: all 0.15s ease-out;
  border: 1px solid transparent;
  box-shadow: inset 0 0 0 0 transparent;

  // ホバー時は半透明のオーバーレイでループエリアを示す
  &:hover {
    background-color: color-mix(
      in oklch,
      var(--scheme-color-primary) 8%,
      transparent
    );
  }

  // カーソル状態
  &.cursor-ew-resize {
    cursor: ew-resize;
  }
}

// ループ範囲(ループ上部の背景)
.loop-range {
  fill: var(--scheme-color-primary);

  &-drag-area {
    fill: transparent;
    cursor: pointer;
    pointer-events: auto;
  }

  &-group {
    &:hover {
      .loop-range {
        opacity: 0.8;
      }
    }
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
    opacity: 0.5; // TODO: 透明度はSASSまたはCSS変数で一括管理する
  }

  .loop-range-group:hover {
    .loop-range {
      opacity: 0.7;
    }
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

  .loop-range-group:hover {
    .loop-range {
      fill: var(--scheme-color-secondary);
      opacity: 0.5;
    }
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
.loop-lane.is-range-zero {
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
  .loop-handle.is-range-zero {
    fill: var(--scheme-color-outline);
    opacity: 0.5;
  }
}
</style>
