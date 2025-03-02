<template>
  <Presentation
    :width
    :offset
    :loopStartX
    :loopEndX
    :isLoopEnabled
    :isDragging
    :isEmpty
    :cursorClass
    :contextMenuData
    @loopAreaMouseDown="handleLoopAreaMouseDown"
    @loopRangeClick="handleLoopRangeClick"
    @loopRangeDoubleClick="handleLoopRangeDoubleClick"
    @startHandleMouseDown="handleStartHandleMouseDown"
    @endHandleMouseDown="handleEndHandleMouseDown"
    @contextMenu="handleContextMenu"
  />
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, inject } from "vue";
import { sequencerRulerInjectionKey } from "../Container.vue";
import Presentation from "./Presentation.vue";
import { getMeasureDuration } from "@/sing/domain";
import { ContextMenuItemData } from "@/components/Menu/ContextMenu/Presentation.vue";
import { UnreachableError } from "@/type/utility";
const injectedValue = inject(sequencerRulerInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const {
  offset,
  width,
  endTicks,
  tsPositions,
  loopStartTick,
  loopEndTick,
  isLoopEnabled,
  tpqn,
  timeSignatures,
  offsetXToSnappedTick,
  ticksToSnappedBeat,
  setLoopRange,
  clearLoopRange,
  setLoopEnabled,
  setPlayheadPosition,
} = injectedValue;

// クリック位置
const clickX = ref(0);

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
  Math.round((width.value / endTicks.value) * currentLoopStartTick.value),
);

const loopEndX = computed(() =>
  Math.round((width.value / endTicks.value) * currentLoopEndTick.value),
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
  setLoopEnabled(!isLoopEnabled.value);
};

// ループ範囲部をダブルクリックでループ範囲を削除
const handleLoopRangeDoubleClick = () => {
  clearLoopRange();
};

// ループのクリックで前処理後にドラッグ開始
const handleLoopAreaMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;

  // クリック位置を計算
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;

  // 既存のループ範囲内でのクリックかどうかを確認
  const isWithinLoop =
    clickX >= loopStartX.value && clickX <= loopEndX.value && !isEmpty.value;

  // 既存のループ範囲内でのクリックの場合は、ループのオン/オフを切り替える
  if (isWithinLoop) return;

  // プレビューを停止
  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  const tick = offsetXToSnappedTick(clickX);

  // クリック位置をループ範囲の開始/終了に設定
  previewLoopStartTick.value = tick;
  previewLoopEndTick.value = tick;

  // ループ範囲を設定
  setLoopRange(tick, tick);

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
    // ドラッグ中の新しいtick
    const baseTick = Math.round((endTicks.value * newX) / width.value);
    const newTick = Math.max(
      0,
      ticksToSnappedBeat(baseTick, timeSignatures.value, tpqn.value),
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
    if (previewLoopStartTick.value === previewLoopEndTick.value) {
      // ループ範囲 0 の場合はクリア
      clearLoopRange();
      return;
    }
    // ループ設定
    setLoopRange(previewLoopStartTick.value, previewLoopEndTick.value);
    // 有効なら再生ヘッドをスタートへ
    setPlayheadPosition(previewLoopStartTick.value);
  } catch (error) {
    throw new UnreachableError("Failed to set loop range");
  }
};

// 右クリックメニュー
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
      setLoopEnabled(!isLoopEnabled.value);
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
      clearLoopRange();
    },
    disabled: isEmpty.value,
    disableWhenUiLocked: true,
  },
]);

// クリック位置から1小節ぶんのループ範囲を作成
const addOneMeasureLoop = (localX: number) => {
  const snappedTick = offsetXToSnappedTick(localX);
  // そのTick時点にある拍子情報を取得
  const currentTs = timeSignatures.value.findLast((_, idx) => {
    return tsPositions.value[idx] <= snappedTick;
  });
  if (!currentTs) return;

  const oneMeasureTicks = getMeasureDuration(
    currentTs.beats,
    currentTs.beatType,
    tpqn.value,
  );

  const startTick = offsetXToSnappedTick(localX);
  const endTick = Math.min(
    offsetXToSnappedTick(localX + oneMeasureTicks),
    endTicks.value,
  );

  setLoopRange(startTick, endTick);
  setPlayheadPosition(startTick);
};

// アンマウント時に必ずドラッグを停止
onUnmounted(() => {
  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }
  cursorState.value = "default";
  window.removeEventListener("mousemove", handleMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
});
</script>
