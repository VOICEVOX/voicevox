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
    @mouseup.stop
    @mousemove="handleLaneMouseMove"
    @mouseenter="handleLaneMouseEnter"
    @mouseleave="handleLaneMouseLeave"
    @contextmenu.prevent="handleContextMenu"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="24"
      shape-rendering="crispEdges"
      style="pointer-events: none"
    >
      <!-- 背景クリックエリア（12px高） -->
      <rect
        x="0"
        y="0"
        :width
        height="12"
        fill="transparent"
        style="pointer-events: auto"
        @mousedown.stop="handleLoopAreaMouseDown"
      />
      <!-- ループ範囲 -->
      <g v-if="!isLoopRangeZero" class="loop-range-group">
        <rect
          :x="loopStartX - offset + 2"
          y="0"
          :width="Math.max(loopEndX - loopStartX - 6, 0)"
          height="5"
          rx="2"
          ry="2"
          class="loop-range"
        />
        <!-- ループ範囲のドラッグエリア(クリックしやすくするためループ範囲よりも大きい) -->
        <rect
          :x="loopStartX - offset + 4"
          y="0"
          :width="Math.max(loopEndX - loopStartX - 8, 0)"
          height="12"
          class="loop-range-drag-area"
          style="pointer-events: auto"
          @click.stop="handleLoopRangeClick"
          @mousedown.stop
          @mouseenter="handleLoopRangeMouseEnter"
          @mouseleave="handleLoopRangeMouseLeave"
        />
      </g>
      <!-- ループ開始ハンドル -->
      <g class="loop-handle-group">
        <path
          :d="handlePath(loopStartX - offset - 2)"
          class="loop-handle loop-handle-start"
          :class="{ 'is-range-zero': isLoopRangeZero }"
          style="pointer-events: auto"
          @mousedown.stop="handleLoopStartMouseDown"
        />
        <!-- 開始ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
        <rect
          :x="loopStartX - offset - 5"
          y="0"
          width="12"
          height="24"
          class="loop-handle-drag-area"
          style="pointer-events: auto"
          @mousedown.stop="handleLoopStartMouseDown"
        />
      </g>
      <!-- ループ終了ハンドル -->
      <g class="loop-handle-group">
        <path
          :d="handlePath(loopEndX - offset - 2)"
          class="loop-handle loop-handle-end"
          :class="{ 'is-range-zero': isLoopRangeZero }"
          style="pointer-events: auto"
          @mousedown.stop="handleLoopEndMouseDown"
        />
        <!-- 終了ハンドルのドラッグエリア(ドラッグしやすくするためハンドルよりも大きい) -->
        <rect
          :x="loopEndX - offset - 5"
          y="0"
          width="12"
          height="24"
          class="loop-handle-drag-area"
          style="pointer-events: auto"
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
  type ContextMenuItemData,
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

// ドラッグハンドル（2px幅・20px高）の下部のみ角丸にするためのパス
// 形状を変えたい場合もあるので、SVGで形状を定義しておく
const HANDLE_W = 2;
const HANDLE_H = 20;
const HANDLE_R = 1; // 下部角丸の半径
const handlePath = (x: number) => {
  const w = HANDLE_W;
  const h = HANDLE_H;
  const r = Math.min(HANDLE_R, w / 2, h / 2);
  const x0 = x;
  const y0 = 0;
  const x1 = x0 + w;
  const y1 = y0 + h;
  // 上辺は直角、下辺左右のみ角丸
  return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${x0 + r} ${y1} A ${r} ${r} 0 0 1 ${x0} ${y1 - r} L ${x0} ${y0} Z`;
};

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
  border-radius: 0;
  height: 6px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: auto;
  cursor: pointer;
  background-color: color-mix(
    in oklch,
    var(--scheme-color-neutral) 10%,
    transparent
  );
  transition: all 0.15s ease-out;
  border: 1px solid transparent;
  box-shadow: inset 0 0 0 0 transparent;

  // ホバーおよびドラッグ時は半透明のオーバーレイでループエリアを示す
  &:hover,
  &.is-dragging {
    background-color: color-mix(
      in oklch,
      var(--scheme-color-primary) 20%,
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
  stroke: none;

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
  stroke: none;
  cursor: ew-resize;

  &-drag-area {
    fill: transparent;
    stroke: none;
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
