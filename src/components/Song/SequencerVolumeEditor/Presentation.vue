<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @wheel="onWheel"
  >
    <div class="volume-time-grid" aria-hidden="true">
      <slot name="grid" />
      <div class="volume-lane-notes">
        <div
          v-for="note in laneNotes"
          :key="note.id"
          class="volume-lane-note-tick"
          :class="{ active: note.active }"
          :style="{ left: `${Math.round(note.x) - 1}px` }"
        />
        <div
          v-for="note in laneNotes"
          :key="note.id"
          class="volume-lane-note"
          :class="{ active: note.active }"
          :style="{ left: `${note.x}px`, width: `${note.width}px` }"
        >
          <span v-if="note.width >= VOLUME_EDITOR_LAYOUT.lyricMinWidthPx">{{
            note.lyric
          }}</span>
        </div>
      </div>
    </div>
    <canvas ref="canvas" class="volume-editor-canvas" />
    <div
      class="volume-editor-area"
      @pointerdown="onSurfacePointerDown"
      @pointerup="onSurfacePointerUp"
      @pointermove="onSurfacePointerMove"
      @pointerleave="onSurfacePointerLeave"
    ></div>
    <Tooltip :state="tooltipState" :viewportWidth :viewportHeight />
    <div class="volume-grid-labels" aria-hidden="true">
      <div class="volume-grid-label" :style="{ top: zeroLinePosition }">0</div>
    </div>
    <SequencerVolumeToolPalette
      class="volume-tool-palette"
      :sequencerVolumeTool="props.tool"
      @update:sequencerVolumeTool="emit('update:tool', $event)"
    />
    <ContextMenu
      ref="contextMenu"
      :menudata="contextMenuData"
      :uiLocked="props.uiLocked"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  toRaw,
  toRef,
  watch,
} from "vue";
import Tooltip from "./Tooltip.vue";
import {
  useVolumeEditorPointerInput,
  type VolumeEditorPointerEvent,
} from "./useVolumeEditorPointerInput";
import {
  buildVolumeSegments,
  createVolumeEditorPixiRenderer,
  VolumeEditorRenderer,
  type VolumeEditorBaseXRange,
  type VolumeEditPosition,
} from "./renderer";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import ContextMenu, {
  type ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import SequencerVolumeToolPalette from "@/components/Song/SequencerVolumeToolPalette.vue";
import type { Note, Tempo, VolumeEditValue } from "@/domain/project/type";
import { secondToTick } from "@/song/music";
import {
  getXInBorderBox,
  tickToBaseX,
  type CursorState,
  type ViewportInfo,
} from "@/song/viewHelper";
import { createThemeColorResolver } from "@/song/graphics/cssColor";
import type { VolumeEditMode } from "@/song/volumeEditMode";
import {
  findVolumeEditableFrameRange,
  type VolumeEditableFrameRange,
  type VolumeEditFrameRange,
} from "@/song/volumeEditRanges";
import type { VolumeEditorPreviewMode } from "@/song/volumeEditorStateMachine/common";
import type { VolumeEditTool } from "@/store/type";
import { assertNonNullable, ExhaustiveError } from "@/type/utility";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

defineOptions({
  name: "SequencerVolumeEditorPresentation",
});

const props = defineProps<{
  viewportInfo: ViewportInfo;
  effectiveFramewise: readonly VolumeEditValue[];
  notes: readonly Note[];
  previewEraseRanges: readonly VolumeEditFrameRange[];
  tempos: Tempo[];
  tpqn: number;
  editorFrameRate: number;
  previewMode: VolumeEditorPreviewMode;
  editableFrameRanges: readonly VolumeEditableFrameRange[];
  tool: VolumeEditTool;
  isDark: boolean;
  uiLocked: boolean;
  volumeEditMode: VolumeEditMode;
}>();

const emit = defineEmits<{
  pointerEvent: [event: VolumeEditorPointerEvent];
  "update:tool": [tool: VolumeEditTool];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const volumeEditMode = toRef(() => props.volumeEditMode);
const volumeValueScale = computed(() => volumeEditMode.value.valueScale);

// 0dBの高さ
const baselineNormalizedY = computed(() =>
  volumeValueScale.value.dbToNormalizedY(0),
);

const zeroLinePosition = computed(
  () => `${(1 - baselineNormalizedY.value) * 100}%`,
);

const resolveVolumeEditorColors = createThemeColorResolver({
  line: "--scheme-color-song-volume-line",
  hovered: "--scheme-color-song-volume-line-hover",
  editing: "--scheme-color-song-volume-line-editing",
  areaContainer: "--scheme-color-song-volume-area-container",
  erasePreviewOverlay: "--scheme-color-song-volume-erase-preview",
  zeroLine: "--scheme-color-song-volume-zero-line",
  hoverPoint: "--scheme-color-song-volume-indicator",
  guide: "--scheme-color-song-volume-value-guide-line",
});

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref<number>();
const viewportHeight = ref<number>();
const contextMenu = ref<InstanceType<typeof ContextMenu>>();

let renderer: VolumeEditorRenderer | undefined;
let resizeObserver: ResizeObserver | undefined;
let rendererAbortController: AbortController | undefined;

const frameToBaseX = (frame: number) => {
  const seconds = frame / props.editorFrameRate;
  const ticks = secondToTick(seconds, toRaw(props.tempos), props.tpqn);
  return tickToBaseX(ticks, props.tpqn);
};

const {
  pointerState,
  updateViewportRectCache,
  onSurfacePointerDown,
  onSurfacePointerUp,
  onSurfacePointerMove,
  onSurfacePointerLeave,
} = useVolumeEditorPointerInput({
  canvasContainer,
  previewMode: toRef(() => props.previewMode),
  viewportInfo: toRef(() => props.viewportInfo),
  tempos: toRef(() => props.tempos),
  tpqn: toRef(() => props.tpqn),
  frameRate: toRef(() => props.editorFrameRate),
  valueScale: volumeValueScale,
  onPointerEvent: (event) => emit("pointerEvent", event),
});

// ポインタのフレームを含む編集可能区間
const pointedEditableRange = computed(() => {
  switch (props.previewMode) {
    case "IDLE":
      if (pointerState.value.type !== "INSIDE") {
        return undefined;
      }
      return findVolumeEditableFrameRange(
        pointerState.value.pointerInfo.frame,
        props.editableFrameRanges,
      );
    case "VOLUME_DRAW":
    case "VOLUME_ERASE":
      // ドラッグはボリュームエディターの上のpointerdownで始まり、そのときに位置を記録するので、
      // 位置が分からないままドラッグ中になることは無い
      if (pointerState.value.type === "UNKNOWN") {
        throw new Error("pointer position is unknown while dragging.");
      }
      return findVolumeEditableFrameRange(
        pointerState.value.pointerInfo.frame,
        props.editableFrameRanges,
      );
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

// ツールチップには、0dBラインからの変更量のみを表示する。
// 原音との実効値やその差分は、原音がフレームごとに揺れて
// 値が読み取れないため表示しない(例: +1.0 → +3.0 → -1.5...)
const tooltipState = computed(() => {
  if (props.uiLocked) {
    return undefined;
  }
  switch (props.previewMode) {
    case "IDLE": {
      if (
        pointerState.value.type !== "INSIDE" ||
        pointedEditableRange.value == undefined
      ) {
        return undefined;
      }
      // ホバー中は、そのフレームの今のカーブの値を示す
      const value =
        props.effectiveFramewise[pointerState.value.pointerInfo.frame];
      if (value == null) {
        return undefined;
      }
      return {
        value: `${volumeValueScale.value.formatDbLabel(value)} dB`,
        pointerX: pointerState.value.pointerInfo.x,
        pointerY: pointerState.value.pointerInfo.y,
      };
    }
    case "VOLUME_DRAW": {
      if (pointerState.value.type === "UNKNOWN") {
        throw new Error("pointer position is unknown while dragging.");
      }
      if (pointedEditableRange.value == undefined) {
        return undefined;
      }
      // 描画中は、書き込む値を示す
      const value = pointerState.value.pointerInfo.db;
      return {
        value: `${volumeValueScale.value.formatDbLabel(value)} dB`,
        pointerX: pointerState.value.pointerInfo.x,
        pointerY: pointerState.value.pointerInfo.y,
      };
    }
    case "VOLUME_ERASE":
      return undefined;
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

const volumeSegments = computed(() =>
  buildVolumeSegments(props.effectiveFramewise, {
    frameToBaseX,
    valueToNormalizedY: (value) =>
      volumeValueScale.value.dbToNormalizedY(value),
  }),
);

// 描画ツールのとき、ポインタのある編集可能区間を強調する
const feedbackBaseXRange = computed<VolumeEditorBaseXRange | undefined>(() => {
  const range = pointedEditableRange.value;
  if (props.uiLocked || range == undefined) {
    return undefined;
  }
  const baseXRange = {
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  };
  switch (props.previewMode) {
    case "IDLE":
      switch (props.tool) {
        case "DRAW":
          return baseXRange;
        case "ERASE":
          return undefined;
        default:
          throw new ExhaustiveError(props.tool);
      }
    case "VOLUME_DRAW":
      return baseXRange;
    case "VOLUME_ERASE":
      return undefined;
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

// ポインタ位置ではなく編集するフレームと値に合わせ、ガイドと編集結果がずれないようにする
const editPosition = computed<VolumeEditPosition | undefined>(() => {
  if (props.uiLocked) {
    return undefined;
  }
  switch (props.previewMode) {
    case "IDLE": {
      switch (props.tool) {
        case "DRAW":
          break;
        case "ERASE":
          return undefined;
        default:
          throw new ExhaustiveError(props.tool);
      }
      if (
        pointerState.value.type !== "INSIDE" ||
        pointedEditableRange.value == undefined
      ) {
        return undefined;
      }
      const pointerInfo = pointerState.value.pointerInfo;
      const value = props.effectiveFramewise[pointerInfo.frame];
      if (value == null) {
        return undefined;
      }
      // ホバー中は、そのフレームの今の値をカーブ上に示す
      return {
        baseX: frameToBaseX(pointerInfo.frame),
        normalizedY: volumeValueScale.value.dbToNormalizedY(value),
        showPoint: true,
        showGuides: false,
      };
    }
    case "VOLUME_DRAW": {
      if (pointerState.value.type === "UNKNOWN") {
        throw new Error("pointer position is unknown while dragging.");
      }
      if (pointedEditableRange.value == undefined) {
        return undefined;
      }
      const pointerInfo = pointerState.value.pointerInfo;
      // 描画中は書き込む値を示す。ガイドは静止中だと拍の罫線と紛れるため、描画中だけ引く
      return {
        baseX: frameToBaseX(pointerInfo.frame),
        normalizedY: volumeValueScale.value.dbToNormalizedY(pointerInfo.db),
        showPoint: false,
        showGuides: true,
      };
    }
    case "VOLUME_ERASE":
      return undefined;
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

// 描画中に強調する音符を決めるtick
const activeTick = computed(() => {
  switch (props.previewMode) {
    case "VOLUME_DRAW": {
      if (pointerState.value.type === "UNKNOWN") {
        throw new Error("pointer position is unknown while dragging.");
      }
      if (pointedEditableRange.value == undefined) {
        return undefined;
      }
      const pointedFrame = pointerState.value.pointerInfo.frame;
      return secondToTick(
        pointedFrame / props.editorFrameRate,
        toRaw(props.tempos),
        props.tpqn,
      );
    }
    case "IDLE":
    case "VOLUME_ERASE":
      return undefined;
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

const laneNotes = computed(() => {
  const width = viewportWidth.value;
  if (width == undefined) return [];
  return props.notes
    .map((note) => ({
      id: note.id,
      lyric: note.lyric,
      x:
        tickToBaseX(note.position, props.tpqn) * props.viewportInfo.scaleX -
        props.viewportInfo.offsetX,
      width: tickToBaseX(note.duration, props.tpqn) * props.viewportInfo.scaleX,
      active:
        activeTick.value != undefined &&
        note.position <= activeTick.value &&
        activeTick.value < note.position + note.duration,
    }))
    .filter(
      (note) =>
        note.x + note.width >= 0 &&
        note.x < width - VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
    );
});

const erasePreviewBaseXRanges = computed<VolumeEditorBaseXRange[]>(() =>
  props.previewEraseRanges.map((range) => ({
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  })),
);

const getVolumeEditorColors = (element: HTMLElement) => {
  const colors = resolveVolumeEditorColors(element, props.isDark);
  return {
    line: colors.line,
    feedback:
      props.previewMode === "VOLUME_DRAW" ? colors.editing : colors.hovered,
    areaContainer: colors.areaContainer,
    erasePreviewOverlay: colors.erasePreviewOverlay,
    zeroLine: colors.zeroLine,
    hoverPoint: colors.hoverPoint,
    guide: colors.guide,
  };
};

const cursorState = computed<CursorState>(() => {
  switch (props.previewMode) {
    case "IDLE":
      if (pointerState.value.type !== "INSIDE") {
        return "UNSET";
      }
      switch (props.tool) {
        case "DRAW":
          return pointedEditableRange.value != undefined
            ? "DRAW"
            : "NOT_ALLOWED";
        case "ERASE":
          return "ERASE";
        default:
          throw new ExhaustiveError(props.tool);
      }
    case "VOLUME_DRAW":
      return "DRAW";
    case "VOLUME_ERASE":
      return "ERASE";
    default:
      throw new ExhaustiveError(props.previewMode);
  }
});

const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "DRAW":
      return "cursor-crosshair";
    case "ERASE":
      return "cursor-erase";
    case "NOT_ALLOWED":
      return "cursor-not-allowed";
    default:
      return "cursor-default";
  }
});

const contextMenuData = computed<ContextMenuItemData[]>(() => [
  {
    type: "button",
    label: "ボリューム描画ツール",
    onClick: () => {
      contextMenu.value?.hide();
      emit("update:tool", "DRAW");
    },
    disableWhenUiLocked: false,
  },
  {
    type: "button",
    label: "ボリューム削除ツール",
    onClick: () => {
      contextMenu.value?.hide();
      emit("update:tool", "ERASE");
    },
    disableWhenUiLocked: false,
  },
]);

const onWheel = (event: WheelEvent) => {
  const containerElement = canvasContainer.value;
  assertNonNullable(containerElement);
  const localX = getXInBorderBox(event.clientX, containerElement);

  // dB目盛り列は時間軸を持たないので、その上での操作は受け付けない
  if (localX < VOLUME_EDITOR_LAYOUT.keyColumnWidthPx) {
    return;
  }

  // ドラッグ編集中はビューを動かさない
  if (props.previewMode !== "IDLE") {
    event.preventDefault();
    return;
  }

  // Ctrl/Cmd + ホイールは時間軸方向のズーム
  if (isOnCommandOrCtrlKeyDown(event)) {
    event.preventDefault();
    // 時間軸の原点はdB目盛り列の右端にあるので、その幅の分を引く
    emit(
      "zoomTimeline",
      localX - VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
      event.deltaY,
    );
    return;
  }

  // 横ホイールは時間軸方向のパン
  if (event.deltaX !== 0) {
    event.preventDefault();
    emit("panTimeline", event.deltaX);
    return;
  }

  // Shift + 縦ホイールも時間軸方向のパン
  if (event.shiftKey && event.deltaY !== 0) {
    event.preventDefault();
    emit("panTimeline", event.deltaY);
    return;
  }
};

const updateRendererColors = () => {
  const containerElement = canvasContainer.value;
  if (renderer == undefined || containerElement == undefined) {
    return;
  }
  renderer.updateColors(getVolumeEditorColors(containerElement));
};

watch(
  () => props.viewportInfo,
  (viewportInfo) => renderer?.updateViewportInfo(viewportInfo),
);
// 強調線の色はpreviewModeで切り替わるため、色の更新に含める
watch([() => props.previewMode, () => props.isDark], () =>
  updateRendererColors(),
);
watch(volumeSegments, (segments) => renderer?.updateVolumeSegments(segments));
watch(baselineNormalizedY, (baseline) =>
  renderer?.updateBaselineNormalizedY(baseline),
);
watch(erasePreviewBaseXRanges, (ranges) =>
  renderer?.updateErasePreviewRanges(ranges),
);
watch(feedbackBaseXRange, (range) => renderer?.updateFeedbackRange(range));
watch(editPosition, (position) => renderer?.updateEditPosition(position));

onMounted(async () => {
  const containerElement = canvasContainer.value;
  const canvasElement = canvas.value;
  assertNonNullable(containerElement, "canvas elements are missing.");
  assertNonNullable(canvasElement, "canvas elements are missing.");

  updateViewportRectCache();
  viewportWidth.value = containerElement.clientWidth;
  viewportHeight.value = containerElement.clientHeight;

  rendererAbortController = new AbortController();
  const pixiRenderer = await createVolumeEditorPixiRenderer({
    canvas: canvasElement,
    width: viewportWidth.value,
    height: viewportHeight.value,
    signal: rendererAbortController.signal,
  });
  if (pixiRenderer == undefined) {
    return;
  }

  // 生成を待つ間に変わった値も反映されるように、待ったあとの値を渡す
  renderer = new VolumeEditorRenderer(pixiRenderer, {
    width: viewportWidth.value,
    height: viewportHeight.value,
    viewportInfo: props.viewportInfo,
    colors: getVolumeEditorColors(containerElement),
    volumeSegments: volumeSegments.value,
    baselineNormalizedY: baselineNormalizedY.value,
    erasePreviewRanges: erasePreviewBaseXRanges.value,
    feedbackRange: feedbackBaseXRange.value,
    editPosition: editPosition.value,
  });
  resizeObserver = new ResizeObserver(() => {
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    updateViewportRectCache();
    if (
      width <= 0 ||
      height <= 0 ||
      (width === viewportWidth.value && height === viewportHeight.value)
    ) {
      return;
    }
    viewportWidth.value = width;
    viewportHeight.value = height;
    renderer?.resize(width, height);
  });
  resizeObserver.observe(containerElement);
});

onUnmounted(() => {
  rendererAbortController?.abort();
  resizeObserver?.disconnect();
  renderer?.destroy();
});
</script>

<style scoped lang="scss">
.volume-editor {
  width: 100%;
  height: 100%;
  position: relative;
  user-select: none;
  overflow: hidden;
  background: var(--scheme-color-song-grid-cell-white);
}

.volume-time-grid {
  position: absolute;
  inset: 0 0 0 v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
  z-index: 0;
  pointer-events: none;

  > :deep(*) {
    width: 100%;
    height: 100%;
  }
}

.volume-lane-notes {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.volume-lane-note {
  position: absolute;
  top: 0;
  height: v-bind("`${VOLUME_EDITOR_LAYOUT.noteLaneHeightPx}px`");
  overflow: hidden;
  color: var(--scheme-color-song-parameter-note-tick);
  font-family: "Unhinted Rounded M+ 1p Medium", sans-serif;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;

  &.active {
    color: var(--scheme-color-song-parameter-note-tick-active);
  }

  > span {
    display: block;
    margin: 2px 0 0 5px;
    line-height: 16px;
  }
}

// グリッドの中心はround(x)-0.5px。幅1pxの矩形はround(x)-1pxから描く。
.volume-lane-note-tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 6px;
  background: var(--scheme-color-song-parameter-note-tick);

  &.active {
    background: var(--scheme-color-song-parameter-note-tick-active);
  }
}

.volume-editor-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
}

.volume-editor-area {
  position: absolute;
  inset: 0 0 0 v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
  z-index: 2;
}

.volume-grid-labels {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 2;
  width: v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
  // dB目盛りの軸エリア。グリッド背景と同じ色で塗り、鍵盤と同じ右罫線を付ける
  // カーブが左へスクロールした分はこの下に隠れる
  background: var(--scheme-color-song-grid-cell-white);
  border-right: 1px solid var(--scheme-color-song-piano-keys-right-border);
  pointer-events: none;
  user-select: none;
}

.volume-grid-label {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  color: var(--scheme-color-song-volume-axis-label);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}
</style>
