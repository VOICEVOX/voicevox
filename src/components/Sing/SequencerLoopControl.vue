<template>
  <div
    class="sequencer-loop-control"
    :class="{
      'loop-disabled': !isLoopEnabled,
      'loop-dragging': isDragging,
      [cursorClass]: true,
    }"
    :style="{ height: adjustedHeight + 'px' }"
    @click.stop
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="16"
      shape-rendering="crispEdges"
    >
      <!-- 背景エリア -->
      <rect
        x="0"
        y="0"
        :width="props.width"
        height="12"
        class="loop-area"
        @mousedown.stop="onLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        :x="loopStartX - offset"
        y="0"
        :width="loopEndX - loopStartX"
        :height="8"
        class="loop-range"
        @click.stop="onLoopRangeClick"
      />
      <rect
        :x="loopStartX - offset"
        y="0"
        :width="loopEndX - loopStartX"
        :height="4"
        class="loop-range-visible"
        @click.stop="onLoopRangeClick"
      />
      <!-- ループ開始ハンドル -->
      <path
        :d="`M${loopStartX - offset},0 L${loopStartX - offset},12 L${loopStartX - offset + 10},0 Z`"
        class="loop-handle loop-start-handle"
        :class="{ 'loop-handle-disabled': loopStartTick === loopEndTick }"
      />
      <!-- ループ終了ハンドル -->
      <path
        :d="`M${loopEndX - offset},0 L${loopEndX - offset},12 L${loopEndX - offset - 10},0 Z`"
        class="loop-handle loop-end-handle"
        :class="{ 'loop-handle-disabled': loopStartTick === loopEndTick }"
      />
      <!-- ループ開始ドラッグ領域 -->
      <rect
        :x="loopStartX - offset - 4"
        y="0"
        width="16"
        height="16"
        class="loop-drag-area"
        @mousedown.stop="onStartHandleMouseDown"
      />
      <!-- ループ終了ドラッグ領域 -->
      <rect
        :x="loopEndX - offset - 4"
        y="0"
        width="16"
        height="16"
        class="loop-drag-area"
        @mousedown.stop="onEndHandleMouseDown"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { useCursorState, CursorState } from "@/composables/useCursorState";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import { getNoteDuration } from "@/sing/domain";

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
} = useLoopControl();
const { setCursorState, cursorClass } = useCursorState();

// ドラッグ中のループ高さ
const DRAGGING_HEIGHT = props.height;
// ドラッグ中でないループ高さ
const DEFAULT_HEIGHT = 16;

const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);

// ループ開始X座標
const loopStartX = computed(
  () => tickToBaseX(loopStartTick.value, tpqn.value) * sequencerZoomX.value,
);
// ループ終了X座標
const loopEndX = computed(
  () => tickToBaseX(loopEndTick.value, tpqn.value) * sequencerZoomX.value,
);

// ドラッグ中かどうか
const isDragging = ref(false);
// ドラッグ中のハンドル
const dragTarget = ref<"start" | "end" | null>(null);
// ドラッグ開始時のX座標
const dragStartX = ref(0);
// ドラッグ開始時のハンドル位置
const dragStartHandleX = ref(0);
// ドラッグエリアの高さ
// ドラッグ中の操作を容易にするためループ高さをルーラーと同一にする
const adjustedHeight = computed(() =>
  isDragging.value ? DRAGGING_HEIGHT : DEFAULT_HEIGHT,
);

const onLoopAreaMouseDown = (event: MouseEvent) => {
  if (isDragging.value) {
    void stopDragging();
  }
  if (event.button !== 0) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left + props.offset;
  const tick = snapToGrid(baseXToTick(x / sequencerZoomX.value, tpqn.value));
  void setLoopRange(tick, tick);
  startDragging("end", event);
};

// ループエリアのクリック(ループの有無を切り替える)
const onLoopRangeClick = () => {
  void setLoopEnabled(!isLoopEnabled.value);
};

const snapToGrid = (tick: number): number => {
  const snapInterval = getNoteDuration(sequencerSnapType.value, tpqn.value);
  return Math.round(tick / snapInterval) * snapInterval;
};

const onStartHandleMouseDown = (event: MouseEvent) => {
  startDragging("start", event);
};

const onEndHandleMouseDown = (event: MouseEvent) => {
  startDragging("end", event);
};

// ドラッグ開始処理
const startDragging = (target: "start" | "end", event: MouseEvent) => {
  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;
  setCursorState(CursorState.EW_RESIZE);
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDragging);
};

// ドラッグ中処理
const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !dragTarget.value) return;

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
      if (newTick <= loopEndTick.value) {
        void setLoopRange(newTick, loopEndTick.value);
      } else {
        // 開始ハンドルが終了ハンドルを超えた場合、開始と終了を入れ替える
        void setLoopRange(loopEndTick.value, newTick);
        dragTarget.value = "end";
        dragStartX.value = event.clientX;
        dragStartHandleX.value =
          tickToBaseX(loopEndTick.value, tpqn.value) * sequencerZoomX.value;
      }
    }
    // 終了ハンドルのドラッグ
    if (dragTarget.value === "end") {
      if (newTick >= loopStartTick.value) {
        // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
        void setLoopRange(loopStartTick.value, newTick);
      } else {
        void setLoopRange(newTick, loopStartTick.value);
        dragTarget.value = "start";
        dragStartX.value = event.clientX;
        dragStartHandleX.value =
          tickToBaseX(loopStartTick.value, tpqn.value) * sequencerZoomX.value;
      }
    }
  } catch (error) {
    throw new Error("Failed to set loop range");
  }
};

// ドラッグ終了処理
const stopDragging = async () => {
  // ドラッグでループ範囲を設定していた場合にplayheadをループの開始位置に移動する
  const isPlayheadToLoopStart =
    isDragging.value && loopStartTick.value !== loopEndTick.value;
  if (isPlayheadToLoopStart) {
    try {
      await store.dispatch("SET_PLAYHEAD_POSITION", {
        position: loopStartTick.value,
      });
    } catch (error) {
      throw new Error("Failed to move playhead");
    }
  }
  isDragging.value = false;
  dragTarget.value = null;
  setCursorState(CursorState.UNSET);
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDragging);
};

onUnmounted(() => {
  setCursorState(CursorState.UNSET);
});
</script>

<style scoped lang="scss">
.sequencer-loop-control {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: auto;

  &:not(.cursor-ew-resize) {
    cursor: pointer;
  }

  &.loop-dragging .loop-range-visible {
    fill: var(--scheme-color-outline-variant);
  }
}

.loop-area {
  fill: transparent;
}

.loop-range {
  fill: transparent;
}

.loop-range-visible {
  fill: var(--scheme-color-primary-fixed-dim);
}

.loop-disabled .loop-range-visible {
  fill: var(--scheme-color-outline);
}

.loop-handle {
  fill: var(--scheme-color-primary-fixed-dim);
  stroke: var(--scheme-color-primary-fixed-dim);
  stroke-width: 2;
  stroke-linejoin: round;

  &.loop-handle-disabled {
    fill: var(--scheme-color-secondary);
    stroke: var(--scheme-color-secondary);
  }
}

.loop-disabled .loop-handle {
  fill: var(--scheme-color-outline);
  stroke: var(--scheme-color-outline);
}

.loop-drag-area {
  fill: transparent;
  cursor: ew-resize;
  pointer-events: all;
}
</style>
