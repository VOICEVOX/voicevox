<template>
  <Presentation
    v-bind="{
      width,
      offset,
      loopStartX,
      loopEndX,
      isLoopEnabled,
      isDragging,
      isEmpty,
      cursorClass,
      contextMenuData,
    }"
    @loopAreaMouseDown="handleLoopAreaMouseDown"
    @loopRangeClick="handleLoopRangeClick"
    @loopRangeDoubleClick="handleLoopRangeDoubleClick"
    @startHandleMouseDown="handleStartHandleMouseDown"
    @endHandleMouseDown="handleEndHandleMouseDown"
    @contextMenu="handleContextMenu"
  />
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import {
  snapTicksToGrid,
  getTimeSignaturePositions,
  getMeasureDuration,
} from "@/sing/domain";
import { ContextMenuItemData } from "@/components/Menu/ContextMenu/Presentation.vue";
import { UnreachableError } from "@/type/utility";

const store = useStore();

// offsetやwidthはルーラー側から受け取る
// TODO: 依存をなくす
const props = defineProps<{
  offset: number;
  width: number;
}>();

// クリック位置
const clickX = ref(0);

// store状態
const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const timeSignatures = computed(() => store.state.timeSignatures);
const isLoopEnabled = computed(() => store.state.isLoopEnabled);
const loopStartTick = computed(() => store.state.loopStartTick);
const loopEndTick = computed(() => store.state.loopEndTick);

// ドラッグ関連の状態
const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);
const dragStartHandleX = ref(0);
const cursorState = ref<"default" | "ew-resize">("default");
const lastMouseEvent = ref<MouseEvent | null>(null);

// プレビュー関連
const previewLoopStartTick = ref(loopStartTick.value);
const previewLoopEndTick = ref(loopEndTick.value);
const executePreviewProcess = ref(false);
let previewRequestId: number | null = null;

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

// ループが空かどうか
const isEmpty = computed(
  () => currentLoopStartTick.value === currentLoopEndTick.value,
);

// カーソルのCSSクラス
const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "ew-resize":
      return "cursor-ew-resize";
    default:
      return "";
  }
});

// ループ範囲部をクリックで有効/無効をトグル
const handleLoopRangeClick = () => {
  void store.actions.COMMAND_SET_LOOP_ENABLED({
    isLoopEnabled: !isLoopEnabled.value,
  });
};

// ループ範囲部をダブルクリックでループ範囲を削除
const handleLoopRangeDoubleClick = () => {
  void store.actions.COMMAND_CLEAR_LOOP_RANGE();
};

// ループのクリックで前処理後にドラッグ開始
const handleLoopAreaMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;

  // プレビューを停止
  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  // クリック位置を計算
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const x = clickX + props.offset;
  const tick = snapTicksToGrid(
    baseXToTick(x / sequencerZoomX.value, tpqn.value),
    timeSignatures.value,
    tpqn.value,
  );

  // クリック位置をループ範囲の開始/終了に設定
  previewLoopStartTick.value = tick;
  previewLoopEndTick.value = tick;

  // ループ範囲を設定
  void store.actions.COMMAND_SET_LOOP_RANGE({
    loopStartTick: tick,
    loopEndTick: tick,
  });

  // ドラッグ開始
  startDragging("end", event);
};

// ドラッグ開始
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
  lastMouseEvent.value = event;
  executePreviewProcess.value = true;
  if (previewRequestId == null) {
    previewRequestId = requestAnimationFrame(preview);
  }
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

// ドラッグ中
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return;
  lastMouseEvent.value = event;
  executePreviewProcess.value = true;
};

// 開始ハンドルドラッグ開始
const handleStartHandleMouseDown = (event: MouseEvent) => {
  startDragging("start", event);
};

// 終了ハンドルドラッグ開始
const handleEndHandleMouseDown = (event: MouseEvent) => {
  startDragging("end", event);
};

// プレビュー処理
const preview = () => {
  if (executePreviewProcess.value && lastMouseEvent.value) {
    executePreviewProcess.value = false;
    const event = lastMouseEvent.value;

    // ドラッグ中のX座標
    const dx = event.clientX - dragStartX.value;
    // ドラッグ中のハンドル位置
    const newX = dragStartHandleX.value + dx;
    // ドラッグ中の基準tick
    const baseTick = baseXToTick(newX / sequencerZoomX.value, tpqn.value);
    // ドラッグ中の新しいtick
    const newTick = Math.max(
      0,
      snapTicksToGrid(baseTick, timeSignatures.value, tpqn.value),
    );

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
    // ループ範囲が0の場合はクリア
    if (previewLoopStartTick.value === previewLoopEndTick.value) {
      void store.actions.COMMAND_CLEAR_LOOP_RANGE();
      return;
    }

    // ループ範囲を設定
    void store.actions.COMMAND_SET_LOOP_RANGE({
      loopStartTick: previewLoopStartTick.value,
      loopEndTick: previewLoopEndTick.value,
    });

    // ループ範囲が有効な場合は再生ヘッドをループ開始位置に移動
    void store.actions.SET_PLAYHEAD_POSITION({
      position: previewLoopStartTick.value,
    });
  } catch (error) {
    throw new UnreachableError("Failed to set loop range");
  }
};

// コンテキストメニューをクリック位置に表示
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  clickX.value = event.clientX - rect.left;
};

// コンテキストメニューのデータ
const contextMenuData = computed<ContextMenuItemData[]>(() => [
  {
    type: "button",
    label: isLoopEnabled.value ? "ループ無効" : "ループ有効",
    onClick: () => {
      void store.actions.COMMAND_SET_LOOP_ENABLED({
        isLoopEnabled: !isLoopEnabled.value,
      });
    },
    disabled: false,
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "ループ範囲を作成",
    onClick: () => {
      addOneMeasureLoop(clickX.value);
    },
    disabled: false,
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "ループ範囲を削除",
    onClick: () => {
      void store.actions.COMMAND_CLEAR_LOOP_RANGE();
    },
    disabled: isEmpty.value,
    disableWhenUiLocked: true,
  },
]);

// クリック位置から1小節分のループ範囲を作成
// メニューのループ範囲の作成時用
const addOneMeasureLoop = (clickX: number) => {
  const baseX = (props.offset + clickX) / sequencerZoomX.value;
  const cursorTick = baseXToTick(baseX, tpqn.value);
  const tsPositions = getTimeSignaturePositions(
    timeSignatures.value,
    tpqn.value,
  );
  const currentTs = timeSignatures.value.findLast((_, index) => {
    return tsPositions[index] <= cursorTick;
  });

  if (!currentTs) {
    throw new Error("assert: At least one time signature exists.");
  }

  // 1小節分のtick数を計算
  const oneMeasureTicks = getMeasureDuration(
    currentTs.beats,
    currentTs.beatType,
    tpqn.value,
  );

  // 拍子情報を考慮してスナップ
  const startTick = snapTicksToGrid(
    cursorTick,
    timeSignatures.value,
    tpqn.value,
  );
  const endTick = snapTicksToGrid(
    startTick + oneMeasureTicks,
    timeSignatures.value,
    tpqn.value,
  );

  void store.actions.COMMAND_SET_LOOP_RANGE({
    loopStartTick: startTick,
    loopEndTick: endTick,
  });

  // ループ範囲設定後は再生ヘッドをループ開始位置に移動
  void store.actions.SET_PLAYHEAD_POSITION({
    position: startTick,
  });
};

onUnmounted(() => {
  cursorState.value = "default";
  window.removeEventListener("mousemove", handleMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
  }
});
</script>
