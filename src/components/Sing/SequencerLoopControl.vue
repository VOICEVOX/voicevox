<template>
  <div class="sequencer-loop-control" :class="cursorClass">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="32"
      shape-rendering="crispEdges"
    >
      <!-- ループ範囲 -->
      <rect
        v-if="isLoopEnabled"
        :x="loopStartX - offset"
        y="0"
        :width="loopEndX - loopStartX"
        :height="4"
        class="loop-range"
      />
      <!-- ループ開始ハンドル -->
      <path
        v-if="isLoopEnabled"
        :d="`M${loopStartX - offset},0 L${loopStartX - offset},16 L${loopStartX - offset + 12},0 Z`"
        class="loop-handle loop-start-handle"
      />
      <!-- ループ終了ハンドル -->
      <path
        v-if="isLoopEnabled"
        :d="`M${loopEndX - offset},0 L${loopEndX - offset},16 L${loopEndX - offset - 12},0 Z`"
        class="loop-handle loop-end-handle"
      />
      <!-- ループ開始ドラッグ領域 -->
      <rect
        v-if="isLoopEnabled"
        :x="loopStartX - offset - 4"
        y="0"
        width="8"
        height="32"
        class="loop-drag-area"
        @mousedown.stop="startDragging('start', $event)"
      />
      <!-- ループ終了ドラッグ領域 -->
      <rect
        v-if="isLoopEnabled"
        :x="loopEndX - offset - 4"
        y="0"
        width="8"
        height="32"
        class="loop-drag-area"
        @mousedown.stop="startDragging('end', $event)"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { useCursorState, CursorState } from "@/composables/useCursorState";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import { getNoteDuration } from "@/sing/domain";

defineProps<{
  width: number;
  offset: number;
}>();

const store = useStore();
const { isLoopEnabled, loopStartTick, loopEndTick, setLoopRange } =
  useLoopControl();
const { setCursorState, cursorClass } = useCursorState();

const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);

const loopStartX = computed(
  () => tickToBaseX(loopStartTick.value, tpqn.value) * sequencerZoomX.value,
);
const loopEndX = computed(
  () => tickToBaseX(loopEndTick.value, tpqn.value) * sequencerZoomX.value,
);

const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);
const dragStartHandleX = ref(0); // ドラッグ開始時のハンドル位置

const snapToGrid = (tick: number): number => {
  const snapInterval = getNoteDuration(sequencerSnapType.value, tpqn.value);
  return Math.round(tick / snapInterval) * snapInterval;
};

const startDragging = (target: "start" | "end", event: MouseEvent) => {
  event.preventDefault();
  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;
  setCursorState(CursorState.EW_RESIZE);
};

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !dragTarget.value) return;

  const dx = event.clientX - dragStartX.value;
  const newX = dragStartHandleX.value + dx;
  let newTick = Math.max(
    0,
    baseXToTick(newX / sequencerZoomX.value, tpqn.value),
  );

  // スナップ処理
  newTick = snapToGrid(newTick);

  try {
    if (dragTarget.value === "start") {
      if (newTick <= loopEndTick.value) {
        setLoopRange(newTick, loopEndTick.value);
      } else {
        // 開始ハンドルが終了ハンドルを超えた場合、開始と終了を入れ替える
        setLoopRange(loopEndTick.value, newTick);

        // ドラッグ対象を終了ハンドルに切り替え
        dragTarget.value = "end";

        // ドラッグ開始点を現在のカーソル位置に再設定
        dragStartX.value = event.clientX;

        // 新しいドラッグ開始ハンドル位置を再計算
        dragStartHandleX.value =
          tickToBaseX(loopEndTick.value, tpqn.value) * sequencerZoomX.value;
      }
    } else {
      if (newTick >= loopStartTick.value) {
        setLoopRange(loopStartTick.value, newTick);
      } else {
        // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
        setLoopRange(newTick, loopStartTick.value);

        // ドラッグ対象を開始ハンドルに切り替え
        dragTarget.value = "start";

        // ドラッグ開始点を現在のカーソル位置に再設定
        dragStartX.value = event.clientX;

        // 新しいドラッグ開始ハンドル位置を再計算
        dragStartHandleX.value =
          tickToBaseX(loopStartTick.value, tpqn.value) * sequencerZoomX.value;
      }
    }
  } catch (error) {
    throw new Error("Error setting loop range");
  }
};

const stopDragging = () => {
  isDragging.value = false;
  dragTarget.value = null;
  setCursorState(CursorState.UNSET);
};

onMounted(() => {
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDragging);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDragging);
  setCursorState(CursorState.UNSET);
});
</script>

<style scoped lang="scss">
.sequencer-loop-control {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

.loop-range {
  fill: var(--scheme-color-primary);
}

.loop-handle {
  fill: var(--scheme-color-primary);
  pointer-events: none;
}

.loop-drag-area {
  fill: transparent;
  cursor: ew-resize;
  pointer-events: all;
}
</style>
