<template>
  <Presentation
    :width="rulerWidth"
    :offset="injectedOffset"
    :loopStartX
    :loopEndX
    :isLoopEnabled
    :isDragging
    :cursorClass
    :contextMenuData
    :tpqn
    :timeSignatures
    :sequencerZoomX
    :snapTicks
    @loopAreaMouseDown="handleLoopAreaMouseDown"
    @loopRangeClick="handleLoopRangeClick"
    @loopStartMouseDown="handleLoopStartMouseDown"
    @loopEndMouseDown="handleLoopEndMouseDown"
    @laneMouseMove="handleLaneMouseMove"
    @laneMouseEnter="handleLaneMouseEnter"
    @laneMouseLeave="handleLaneMouseLeave"
    @loopRangeMouseEnter="handleLoopRangeMouseEnter"
    @loopRangeMouseLeave="handleLoopRangeMouseLeave"
    @contextMenu="handleContextMenu"
  />
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, inject } from "vue";
import { offsetInjectionKey } from "../Container.vue";
import { numMeasuresInjectionKey } from "../../ScoreSequencer.vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import { baseXToTick } from "@/sing/viewHelper";
import { getMeasureDuration, getNoteDuration } from "@/sing/music";
import type { ContextMenuItemData } from "@/components/Menu/ContextMenu/Presentation.vue";

defineOptions({
  name: "LoopLaneContainer",
});

// ドラッグ状態の型定義
// NOTE: ループ作成時はレーンのマウスダウンから閾値を超えたらループ作成を開始するようにする
// 即時ループ作成すると、レーンクリックで削除のような挙動に見えてしまうため
// なお、リサイズの場合は即時でないと反応が遅れる・おかしく見えるため、即時リサイズする
type LoopLaneDragState =
  | "idle" // 何も操作していない
  | "pending-create" // マウスダウンしたが閾値未満
  | "creating" // 新規ループ作成中
  | "resizing-start" // 開始ハンドルをリサイズ中
  | "resizing-end"; // 終了ハンドルをリサイズ中

// ドラッグ開始の閾値（ピクセル）
const DRAG_THRESHOLD_PX = 4;

// 依存注入
const store = useStore();

const injectedOffset = inject(offsetInjectionKey);
if (injectedOffset == undefined) {
  throw new Error("injectedOffset is undefined.");
}

const injectedNumMeasures = inject(numMeasuresInjectionKey);
if (injectedNumMeasures == undefined) {
  throw new Error("injectedNumMeasures is undefined.");
}

// ストアからの値
const numMeasures = computed(() => injectedNumMeasures.numMeasures);
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);
const loopStartTick = computed(() => store.state.loopStartTick);
const loopEndTick = computed(() => store.state.loopEndTick);
const isLoopEnabled = computed(() => store.state.isLoopEnabled);
const snapTicks = computed(() => {
  return getNoteDuration(store.state.sequencerSnapType, tpqn.value);
});

// レイアウト計算
const { rulerWidth, tsPositions, totalTicks } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: injectedOffset,
  numMeasures: numMeasures.value,
});

// マウス位置
const clickX = ref(0); // 右クリック時の位置（コンテキストメニュー用）

// ホバー状態
const isHoveringLane = ref(false);
const isHoveringLoopRange = ref(false);

// ドラッグ状態
const dragState = ref<LoopLaneDragState>("idle");
const dragStartX = ref(0);
const dragStartHandleX = ref(0);
const cursorState = ref<"default" | "ew-resize">("default");
const lastMouseEvent = ref<MouseEvent | null>(null);
const pendingCreateStartX = ref(0);

// ドラッグプレビュー用
const previewLoopStartTick = ref(loopStartTick.value);
const previewLoopEndTick = ref(loopEndTick.value);
const executePreviewProcess = ref(false);
let previewRequestId: number | null = null;

// 表示用の計算値

// ドラッグ中かどうか
const isDragging = computed(
  () => dragState.value !== "idle" && dragState.value !== "pending-create",
);

// 現在のループ範囲（ドラッグ中はプレビュー値を使用）
const currentLoopStartTick = computed(() =>
  isDragging.value ? previewLoopStartTick.value : loopStartTick.value,
);

const currentLoopEndTick = computed(() =>
  isDragging.value ? previewLoopEndTick.value : loopEndTick.value,
);

// ループハンドルのピクセル位置
const loopStartX = computed(() => {
  if (rulerWidth.value === 0 || totalTicks.value === 0) return 0;
  return Math.round(
    (rulerWidth.value / totalTicks.value) * currentLoopStartTick.value,
  );
});

const loopEndX = computed(() => {
  if (rulerWidth.value === 0 || totalTicks.value === 0) return 0;
  return Math.round(
    (rulerWidth.value / totalTicks.value) * currentLoopEndTick.value,
  );
});

// カーソルのCSSクラス
const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "ew-resize":
      return "cursor-ew-resize";
    default:
      return "";
  }
});

// ストアアクション

const setLoopRange = (start: number, end: number) => {
  void store.actions.SET_LOOP_RANGE({ loopStartTick: start, loopEndTick: end });
};

const clearLoopRange = () => {
  void store.actions.CLEAR_LOOP_RANGE();
};

const setLoopEnabled = (enabled: boolean) => {
  void store.actions.SET_LOOP_ENABLED({ isLoopEnabled: enabled });
};

const setPlayheadPosition = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

// ハンドラ

// レーン上でのマウス移動
const handleLaneMouseMove = () => {
  // ドラッグ中は処理しない
  if (isDragging.value) return;
};

const handleLaneMouseEnter = () => {
  isHoveringLane.value = true;
};

const handleLaneMouseLeave = () => {
  isHoveringLane.value = false;
};

// ループ範囲のホバー
const handleLoopRangeMouseEnter = () => {
  isHoveringLoopRange.value = true;
};

const handleLoopRangeMouseLeave = () => {
  isHoveringLoopRange.value = false;
};

// ループ範囲のクリック操作
const handleLoopRangeClick = () => {
  setLoopEnabled(!isLoopEnabled.value);
};

// 新規ループ作成（レーンのマウスダウン時）
const handleLoopAreaMouseDown = (event: MouseEvent) => {
  // 修飾なしの左クリックのみ有効
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;

  // クリック位置を計算
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickXInLane = event.clientX - rect.left;

  // クリック位置からtickを計算して、ピクセル位置に変換（スナップ後の位置）
  const baseX = (injectedOffset.value + clickXInLane) / sequencerZoomX.value;
  const baseTick = baseXToTick(baseX, tpqn.value);
  const tick = Math.round(baseTick / snapTicks.value) * snapTicks.value;
  const snapPixelX = Math.round((rulerWidth.value / totalTicks.value) * tick);

  // pending-create状態へ遷移
  dragState.value = "pending-create";
  pendingCreateStartX.value = event.clientX;
  dragStartHandleX.value = snapPixelX;
  lastMouseEvent.value = event;

  // マウスイベントリスナーを設定
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

// ハンドルのドラッグ開始
const handleLoopStartMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return;
  startResizing("resizing-start", event);
};

const handleLoopEndMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return;
  startResizing("resizing-end", event);
};

// ハンドルのリサイズ開始
const startResizing = (
  state: "resizing-start" | "resizing-end",
  event: MouseEvent,
) => {
  previewLoopStartTick.value = loopStartTick.value;
  previewLoopEndTick.value = loopEndTick.value;

  dragState.value = state;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    state === "resizing-start" ? loopStartX.value : loopEndX.value;

  cursorState.value = "ew-resize";
  lastMouseEvent.value = event;
  executePreviewProcess.value = true;
  if (previewRequestId == null) {
    previewRequestId = requestAnimationFrame(preview);
  }
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

const handleMouseMove = (event: MouseEvent) => {
  lastMouseEvent.value = event;

  // ループ作成判定待ち(pending-create)状態の場合、閾値を超えていたらループ作成を開始
  if (dragState.value === "pending-create") {
    const dragDistance = Math.abs(event.clientX - pendingCreateStartX.value);
    if (dragDistance >= DRAG_THRESHOLD_PX) {
      // 閾値を超えたらループ作成を開始
      executePreviewProcess.value = false;
      if (previewRequestId != null) {
        cancelAnimationFrame(previewRequestId);
        previewRequestId = null;
      }

      // dragStartHandleXから開始tickを計算
      const baseTick = Math.round(
        (totalTicks.value * dragStartHandleX.value) / rulerWidth.value,
      );
      const tick = Math.round(baseTick / snapTicks.value) * snapTicks.value;

      // ループ範囲を設定
      previewLoopStartTick.value = tick;
      previewLoopEndTick.value = tick;
      setLoopRange(tick, tick);

      // 作成中(creating)状態へ遷移
      dragState.value = "creating";
      dragStartX.value = pendingCreateStartX.value;
      dragStartHandleX.value = loopEndX.value;
      cursorState.value = "ew-resize";
      executePreviewProcess.value = true;
      if (previewRequestId == null) {
        previewRequestId = requestAnimationFrame(preview);
      }
    }
  } else if (isDragging.value) {
    executePreviewProcess.value = true;
  }
};

// ドラッグでのプレビュー
const preview = () => {
  if (executePreviewProcess.value && lastMouseEvent.value) {
    executePreviewProcess.value = false;
    const event = lastMouseEvent.value;

    // ドラッグ中のX座標
    const dx = event.clientX - dragStartX.value;
    // ドラッグ中のハンドル位置
    const newX = dragStartHandleX.value + dx;
    // ドラッグ中の新しいtick
    const baseTick = Math.round((totalTicks.value * newX) / rulerWidth.value);
    const newTick = Math.max(
      0,
      Math.round(baseTick / snapTicks.value) * snapTicks.value,
    );

    // ドラッグ状態に応じて処理を分ける
    if (dragState.value === "resizing-start") {
      if (newTick <= previewLoopEndTick.value) {
        previewLoopStartTick.value = newTick;
      } else {
        // 開始ハンドルが終了ハンドルを超えた場合、開始と終了を入れ替える
        previewLoopStartTick.value = previewLoopEndTick.value;
        previewLoopEndTick.value = newTick;
        dragState.value = "resizing-end";
        dragStartX.value = event.clientX;
        dragStartHandleX.value = newX;
      }
    } else if (
      dragState.value === "resizing-end" ||
      dragState.value === "creating"
    ) {
      if (newTick >= previewLoopStartTick.value) {
        previewLoopEndTick.value = newTick;
      } else {
        // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
        previewLoopEndTick.value = previewLoopStartTick.value;
        previewLoopStartTick.value = newTick;
        dragState.value = "resizing-start";
        dragStartX.value = event.clientX;
        dragStartHandleX.value = newX;
      }
    }
  }

  if (isDragging.value) {
    previewRequestId = requestAnimationFrame(preview);
  }
};

// ドラッグ終了時にドラッグプレビュー関連の状態とリソースをリセット
const cleanUpDragPreview = () => {
  dragState.value = "idle";
  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }
  cursorState.value = "default";
  window.removeEventListener("mousemove", handleMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
};

// ドラッグ終了
const stopDragging = () => {
  // pending-create状態のまま終了した場合は何もしない
  if (dragState.value === "pending-create") {
    cleanUpDragPreview();
    return;
  }

  if (!isDragging.value) return;

  // ドラッグプレビュー関連の状態とリソースをリセット
  cleanUpDragPreview();

  // ループ範囲の確定
  if (previewLoopStartTick.value === previewLoopEndTick.value) {
    // ループ範囲 0 の場合はクリア
    clearLoopRange();
    return;
  }

  // ループ設定
  setLoopRange(previewLoopStartTick.value, previewLoopEndTick.value);
  // 有効なら再生ヘッドをスタートへ
  setPlayheadPosition(previewLoopStartTick.value);
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
    disabled: false,
    disableWhenUiLocked: true,
  },
]);

// クリック位置から1小節ぶんのループ範囲を作成
const addOneMeasureLoop = (localX: number) => {
  const baseX = (injectedOffset.value + localX) / sequencerZoomX.value;
  const baseTickForLoop = baseXToTick(baseX, tpqn.value);
  const startTick =
    Math.round(baseTickForLoop / snapTicks.value) * snapTicks.value;

  // そのTick時点にある拍子情報を取得
  const currentTs = timeSignatures.value.findLast((_, idx) => {
    return tsPositions.value[idx] <= startTick;
  });
  if (!currentTs) return;

  const oneMeasureTicks = getMeasureDuration(
    currentTs.beats,
    currentTs.beatType,
    tpqn.value,
  );

  const endTick = Math.min(
    Math.round((startTick + oneMeasureTicks) / snapTicks.value) *
      snapTicks.value,
    totalTicks.value,
  );

  setLoopRange(startTick, endTick);
  setPlayheadPosition(startTick);
};

// アンマウント時に必ずドラッグ関連の状態とリソースをリセット
onUnmounted(() => {
  cleanUpDragPreview();
});
</script>
