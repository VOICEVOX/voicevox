<template>
  <div
    class="sequencer-loop-control"
    :class="{
      'loop-enabled': isLoopEnabled,
      'loop-dragging': isDragging,
      'loop-no-length': loopStartTick === loopEndTick,
      [cursorClass]: true,
    }"
    :style="{ height: adjustedHeight + 'px' }"
    @click.stop
    @contextmenu.prevent="onContextMenu"
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
        rx="6"
        ry="6"
        class="loop-area"
        @mousedown.stop="onLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        :x="loopStartX - offset"
        y="0"
        :width="Math.max(loopEndX - loopStartX, 0)"
        height="8"
        class="loop-range-area"
        @click.stop="onLoopRangeClick"
      />
      <rect
        :x="loopStartX - offset + 8"
        y="5"
        :width="Math.max(loopEndX - loopStartX - 16, 0)"
        height="2"
        rx="1"
        ry="1"
        class="loop-range"
        @click.stop="onLoopRangeClick"
      />
      <!-- ループ開始ハンドル -->
      <path
        :d="`M${loopStartX - offset},${2} L${loopStartX - offset},${2 + 8} L${loopStartX - offset + 6},${2 + 4} Z`"
        class="loop-handle loop-start-handle"
        :class="{ 'loop-handle-no-length': loopStartTick === loopEndTick }"
        vector-effect="non-scaling-stroke"
        @mousedown.stop="onStartHandleMouseDown"
      />
      <!-- ループ終了ハンドル -->
      <path
        :d="`M${loopEndX - offset},${2} L${loopEndX - offset},${2 + 8} L${loopEndX - offset - 6},${2 + 4} Z`"
        class="loop-handle loop-end-handle"
        :class="{ 'loop-handle-no-length': loopStartTick === loopEndTick }"
        vector-effect="non-scaling-stroke"
        @mousedown.stop="onEndHandleMouseDown"
      />
      <!-- ループ開始ドラッグ領域 -->
      <rect
        :x="loopStartX - offset - 4"
        y="0"
        width="16"
        height="16"
        class="loop-drag-area"
        @mousedown.stop="onStartHandleMouseDown"
        @dblclick.stop="onHandleDoubleClick"
      />
      <!-- ループ終了ドラッグ領域 -->
      <rect
        :x="loopEndX - offset - 4"
        y="0"
        width="16"
        height="16"
        class="loop-drag-area"
        @mousedown.stop="onEndHandleMouseDown"
        @dblclick.stop="onHandleDoubleClick"
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
import { getNoteDuration } from "@/sing/domain";
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
// コンテキストメニューの表示位置
const contextMenuPosition = ref<number | null>(null);
// ドラッグエリアの高さ
// ドラッグ中の操作を容易にするためループ高さをルーラーと同一にする
const adjustedHeight = computed(() =>
  isDragging.value ? DRAGGING_HEIGHT : DEFAULT_HEIGHT,
);

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

const onHandleDoubleClick = () => {
  // ハンドルのダブルクリックでループを0地点に設定する
  void setLoopRange(0, 0);
};

// ドラッグ開始処理
const startDragging = (target: "start" | "end", event: MouseEvent) => {
  if (event.button !== 0) return;
  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;
  setCursorState(CursorState.EW_RESIZE);
  window.addEventListener("mousemove", onDrag, true);
  window.addEventListener("mouseup", stopDragging, true);
};

// ドラッグ中処理
const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !dragTarget.value) return;
  if (event.button !== 0) return;

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
  if (!isDragging.value) return;
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
  window.removeEventListener("mousemove", onDrag, true);
  window.removeEventListener("mouseup", stopDragging, true);
};

// コンテキストメニュー位置に1小節のループ範囲を作成する
const addOneMeasureLoop = (x: number) => {
  const timeSignature = store.state.timeSignatures[0];
  const oneMeasureTicks =
    getNoteDuration(timeSignature.beatType, tpqn.value) * timeSignature.beats;
  const baseX = (props.offset + x) / sequencerZoomX.value;
  const cursorTick = baseXToTick(baseX, tpqn.value);
  const startTick = snapToGrid(cursorTick);
  const endTick = snapToGrid(startTick + oneMeasureTicks);
  void setLoopRange(startTick, endTick);
};

const onContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextMenuPosition.value = event.clientX - rect.left;
};
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
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
        if (contextMenuPosition.value) {
          addOneMeasureLoop(contextMenuPosition.value);
        }
      },
      disabled: !contextMenuPosition.value,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "ループ範囲を削除",
      onClick: () => {
        contextMenu.value?.hide();
        void setLoopRange(0, 0);
      },
      disabled: loopStartTick.value === loopEndTick.value,
      disableWhenUiLocked: true,
    },
  ];
});

onUnmounted(() => {
  setCursorState(CursorState.UNSET);
  window.removeEventListener("mousemove", onDrag, true);
  window.removeEventListener("mouseup", stopDragging, true);
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

  &.cursor-ew-resize {
    cursor: ew-resize;
  }

  // ホバー時のループエリア
  &:hover .loop-area {
    fill: var(--scheme-color-sing-loop-area);
  }
}

// ループエリア
.loop-area {
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
  stroke: var(--scheme-color-outline);
  stroke-width: 2px;
  stroke-linejoin: round;
  stroke-linecap: round;

  &-no-length {
    fill: var(--scheme-color-outline);
    stroke: var(--scheme-color-outline);
  }
}

// ドラッグエリア
.loop-drag-area {
  fill: transparent;
  cursor: ew-resize;
  pointer-events: all;
}
// ループが有効な状態
.loop-enabled {
  .loop-range {
    fill: var(--scheme-color-primary-fixed-dim);
  }

  .loop-handle {
    fill: var(--scheme-color-primary-fixed-dim);
    stroke: var(--scheme-color-primary-fixed-dim);
  }
}

// ドラッグ中の状態
// TODO: 色や表示など仮
.loop-dragging {
  .loop-area {
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

// TODO: 仮: 削除の動作をシミュレート
.loop-no-length:not(.loop-dragging) {
  .loop-range {
    display: none;
  }

  .loop-handle {
    display: none;
  }

  .loop-drag-area {
    display: none;
  }
}

.loop-dragging.loop-no-length {
  .loop-handle {
    fill: var(--scheme-color-outline);
    stroke: var(--scheme-color-outline);
    opacity: 0.38;
  }
}
</style>
