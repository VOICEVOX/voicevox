<template>
  <div class="sequencer-loop-control">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="props.width"
      :height="32"
      shape-rendering="crispEdges"
    >
      <!-- ループ範囲 -->
      <rect
        v-if="isLoopEnabled"
        :x="loopStartX - props.offset"
        y="0"
        :width="loopEndX - loopStartX"
        :height="8"
        class="loop-range"
      />
      <!-- ループ開始 -->
      <line
        v-if="isLoopEnabled"
        :x1="loopStartX - props.offset"
        :x2="loopStartX - props.offset"
        y1="0"
        :y2="16"
        class="loop-marker loop-start-marker"
      />
      <!-- ループ終了 -->
      <line
        v-if="isLoopEnabled"
        :x1="loopEndX - props.offset"
        :x2="loopEndX - props.offset"
        y1="0"
        :y2="16"
        class="loop-marker loop-end-marker"
      />
    </svg>
    <!-- ループ開始ハンドル -->
    <div
      v-if="isLoopEnabled"
      class="loop-handle loop-start-handle"
      :style="{ left: `${loopStartX - props.offset}px` }"
      @mousedown="startDragging('start', $event)"
    ></div>
    <!-- ループ終了ハンドル -->
    <div
      v-if="isLoopEnabled"
      class="loop-handle loop-end-handle"
      :style="{ left: `${loopEndX - props.offset}px` }"
      @mousedown="startDragging('end', $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";

const props = defineProps<{
  width: number;
  offset: number;
}>();

const store = useStore();
const { isLoopEnabled, loopStartTick, loopEndTick, setLoopRange } =
  useLoopControl();

const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);

const loopStartX = computed(
  () => tickToBaseX(loopStartTick.value, tpqn.value) * sequencerZoomX.value,
);
const loopEndX = computed(
  () => tickToBaseX(loopEndTick.value, tpqn.value) * sequencerZoomX.value,
);

// ドラッグ状態の管理
const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);

const startDragging = (target: "start" | "end", event: MouseEvent) => {
  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  // FIXME: 仮でdocumentにaddEventListener
  // documentに指定しないとドラッグ中に他の要素に被ってドラッグができなくなる
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDragging);
};

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !dragTarget.value) return;

  const startX = event.clientX - dragStartX.value;
  const newX =
    (dragTarget.value === "start" ? loopStartX.value : loopEndX.value) + startX;
  const newTick = Math.max(
    0,
    baseXToTick(newX / sequencerZoomX.value, tpqn.value),
  );

  if (dragTarget.value === "start") {
    if (newTick < loopEndTick.value) {
      setLoopRange(newTick, loopEndTick.value);
    }
  } else {
    if (newTick > loopStartTick.value) {
      setLoopRange(loopStartTick.value, newTick);
    }
  }

  dragStartX.value = event.clientX;
};

const stopDragging = () => {
  isDragging.value = false;
  dragTarget.value = null;
  // FIXME: 仮
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDragging);
};

// FIXME: 仮でアンマウント時にremoveEventListener
onUnmounted(() => {
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDragging);
});
</script>

<style scoped lang="scss">
// FIXME:スタイルは別途調整
.sequencer-loop-control {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.loop-range {
  fill: var(--scheme-color-secondary); // FIXME: 仮
  opacity: 0.25;
}

.loop-marker {
  stroke: var(--scheme-color-secondary); // FIXME: 仮
  stroke-width: 4px;
}

.loop-handle {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  background-color: var(--scheme-color-secondary-surface); // FIXME: 仮
  pointer-events: auto;

  &.loop-start-handle,
  &.loop-end-handle {
    transform: translateX(-50%);
  }
}
</style>
