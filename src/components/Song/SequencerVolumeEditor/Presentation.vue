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
      <svg class="volume-zero-line">
        <line x1="0" x2="100%" :y1="zeroLinePosition" :y2="zeroLinePosition" />
      </svg>
    </div>
    <canvas ref="canvas" class="volume-editor-canvas" />
    <svg class="volume-annotations" aria-hidden="true">
      <circle
        v-if="hoverPoint != undefined"
        class="volume-hover-point"
        :cx="hoverPoint.x"
        :cy="hoverPoint.y"
        :r="VOLUME_EDITOR_LAYOUT.hoverPointRadiusPx"
      />
      <text
        v-for="label in endpointLabels"
        :key="label.x"
        :x="label.x + 10"
        :y="label.y - 8"
        class="volume-endpoint-label"
      >
        {{ label.text }}
      </text>
      <line
        v-if="verticalGuide != undefined"
        class="volume-vertical-guide"
        :x1="verticalGuide.x"
        :x2="verticalGuide.x"
        :y1="VOLUME_EDITOR_LAYOUT.noteLaneHeightPx"
        :y2="verticalGuide.endY"
      />
    </svg>
    <div
      class="volume-editor-area"
      @pointerdown="onSurfacePointerDown"
      @pointermove="onSurfacePointerMove"
      @pointerleave="onSurfacePointerLeave"
    ></div>
    <Tooltip
      :state="tooltipState"
      :showGuide="props.previewMode === 'VOLUME_DRAW'"
      :viewportWidth
      :viewportHeight
    />
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
  buildVolumeEndpointNodes,
  VolumeEditorRenderer,
  type VolumeEditorBaseXRange,
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
import {
  volumeBaseXToScreenX,
  volumeNormalizedYToScreenY,
  type VolumePoint,
  type VolumeViewInfo,
} from "@/song/graphics/volumeLine";
import type { VolumeEditMode } from "@/song/volumeEditMode";
import type {
  VolumeEditableFrameRange,
  VolumeEditFrameRange,
} from "@/song/volumeEditRanges";
import type {
  VolumeEditorPreviewMode,
  VolumeEditorTooltipData,
} from "@/song/volumeEditorStateMachine/common";
import type { VolumeEditTool } from "@/store/type";
import { assertNonNullable } from "@/type/utility";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

defineOptions({
  name: "SequencerVolumeEditorPresentation",
});

const props = defineProps<{
  viewportInfo: ViewportInfo;
  effectiveFramewise: readonly VolumeEditValue[];
  editableFrameRanges: readonly VolumeEditableFrameRange[];
  notes: readonly Note[];
  previewEraseRanges: readonly VolumeEditFrameRange[];
  tempos: Tempo[];
  tpqn: number;
  editorFrameRate: number;
  previewMode: VolumeEditorPreviewMode;
  cursorState: CursorState;
  tooltipData: VolumeEditorTooltipData | undefined;
  highlightedFrame: number | undefined;
  highlightedEditableRange: VolumeEditableFrameRange | undefined;
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

const zeroLinePosition = computed(
  () => `${(1 - volumeValueScale.value.dbToNormalizedY(0)) * 100}%`,
);

const resolveVolumeLineColors = createThemeColorResolver({
  line: "--scheme-color-song-volume-line",
  hovered: "--scheme-color-song-volume-line-hover",
  editing: "--scheme-color-song-volume-line-editing",
  areaContainer: "--scheme-color-song-volume-area-container",
  endpointContainer: "--scheme-color-song-volume-endpoint-container",
  erasePreviewOverlay: "--scheme-color-song-volume-erase-preview",
});

const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref<number>();
const viewportHeight = ref<number>();
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const viewInfo = computed<VolumeViewInfo | undefined>(() => {
  if (viewportWidth.value == undefined || viewportHeight.value == undefined)
    return undefined;
  return {
    viewportWidth: viewportWidth.value,
    viewportHeight: viewportHeight.value,
    zoomX: props.viewportInfo.scaleX,
    offsetX: props.viewportInfo.offsetX,
    leftPadding: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
  };
});

let renderer: VolumeEditorRenderer | undefined;
let resizeObserver: ResizeObserver | undefined;
let rendererAbortController: AbortController | undefined;

// px⇔フレームの変換はポインタ入力側の逆変換と対で保守するため、ビュー側に置く
const frameToBaseX = (frame: number) => {
  const seconds = frame / props.editorFrameRate;
  const ticks = secondToTick(seconds, toRaw(props.tempos), props.tpqn);
  return tickToBaseX(ticks, props.tpqn);
};

// ツールチップには、0dBラインからの変更量のみを表示する。
// 原音との実効値やその差分は、原音がフレームごとに揺れて
// 値が読み取れないため表示しない(例: +1.0 → +3.0 → -1.5...)
const tooltipState = computed(() => {
  const data = props.tooltipData;
  if (props.uiLocked || data == undefined) {
    return undefined;
  }
  return {
    value: `${volumeValueScale.value.formatDbLabel(data.db)} dB`,
    pointerX: data.pointerX,
    pointerY: data.pointerY,
  };
});

const {
  canvasContainer,
  updateViewportRectCache,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerLeave,
} = useVolumeEditorPointerInput({
  previewMode: toRef(() => props.previewMode),
  viewportInfo: toRef(() => props.viewportInfo),
  tempos: toRef(() => props.tempos),
  tpqn: toRef(() => props.tpqn),
  frameRate: toRef(() => props.editorFrameRate),
  volumeEditMode,
  onPointerEvent: (event) => emit("pointerEvent", event),
});

const volumeSegments = computed(() =>
  buildVolumeSegments(props.effectiveFramewise, {
    frameToBaseX,
    valueToNormalizedY: (value) =>
      volumeValueScale.value.dbToNormalizedY(value),
  }),
);

const feedbackBaseXRange = computed<VolumeEditorBaseXRange | undefined>(() => {
  const range = props.highlightedEditableRange;
  // ステートマシンが描画できると判断した位置だけを強調する。
  if (props.cursorState !== "DRAW" || props.uiLocked || range == undefined) {
    return undefined;
  }
  return {
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  };
});

const hoveredCurvePoint = computed<VolumePoint | undefined>(() => {
  const frame = props.highlightedFrame;
  if (
    props.previewMode !== "IDLE" ||
    props.uiLocked ||
    props.highlightedEditableRange == undefined ||
    frame == undefined
  ) {
    return undefined;
  }
  const value = props.effectiveFramewise[frame];
  if (value == null) return undefined;
  // ポインターの高さではなく、実際に編集するフレームのカーブ上に表示する。
  return {
    baseX: frameToBaseX(frame),
    normalizedY: volumeValueScale.value.dbToNormalizedY(value),
  };
});

const hoverPoint = computed(() => {
  const point = hoveredCurvePoint.value;
  const view = viewInfo.value;
  if (props.cursorState !== "DRAW" || point == undefined || view == undefined)
    return undefined;
  const x = volumeBaseXToScreenX(point.baseX, view);
  if (x < view.leftPadding || x > view.viewportWidth) return undefined;
  return {
    x,
    y: volumeNormalizedYToScreenY(point.normalizedY, view.viewportHeight),
  };
});
const verticalGuide = computed(() => {
  if (props.uiLocked) return undefined;
  if (props.previewMode === "VOLUME_DRAW") {
    const data = props.tooltipData;
    if (data == undefined) return undefined;
    // 描画中はホバー点を出さないので、横ガイドとの交点まで伸ばす。
    return {
      x: data.pointerX,
      endY: Math.max(VOLUME_EDITOR_LAYOUT.noteLaneHeightPx, data.pointerY),
    };
  }
  const point = hoveredCurvePoint.value;
  const view = viewInfo.value;
  if (point == undefined || view == undefined) return undefined;
  const pointY = volumeNormalizedYToScreenY(
    point.normalizedY,
    view.viewportHeight,
  );
  // ホバー点があるときだけ、線が点に食い込まないよう半径ぶん手前で止める。
  const gap =
    hoverPoint.value == undefined ? 0 : VOLUME_EDITOR_LAYOUT.hoverPointRadiusPx;
  return {
    x: volumeBaseXToScreenX(point.baseX, view),
    endY: Math.max(VOLUME_EDITOR_LAYOUT.noteLaneHeightPx, pointY - gap),
  };
});

const laneNotes = computed(() => {
  const view = viewInfo.value;
  if (view == undefined) return [];
  const frame = props.highlightedFrame;
  const activeTick =
    props.previewMode === "VOLUME_DRAW" && frame != undefined
      ? secondToTick(
          frame / props.editorFrameRate,
          toRaw(props.tempos),
          props.tpqn,
        )
      : undefined;
  return props.notes
    .map((note) => ({
      id: note.id,
      lyric: note.lyric,
      x:
        tickToBaseX(note.position, props.tpqn) * props.viewportInfo.scaleX -
        props.viewportInfo.offsetX,
      width: tickToBaseX(note.duration, props.tpqn) * props.viewportInfo.scaleX,
      active:
        activeTick != undefined &&
        note.position <= activeTick &&
        activeTick < note.position + note.duration,
    }))
    .filter(
      (note) =>
        note.x + note.width >= 0 &&
        note.x < view.viewportWidth - view.leftPadding,
    );
});

const endpointLabels = computed(() => {
  const view = viewInfo.value;
  if (view == undefined) return [];
  const startValues = new Map(
    props.editableFrameRanges.map((range) => [
      frameToBaseX(range.startFrame),
      props.effectiveFramewise[range.startFrame],
    ]),
  );
  return buildVolumeEndpointNodes(volumeSegments.value, view).flatMap(
    (node) => {
      // 統合点ではラベルを省き、実際の区間先頭にだけ表示する。
      if (node.startBaseX !== node.endBaseX) return [];
      const value = startValues.get(node.startBaseX);
      if (value == null) return [];
      const label = volumeValueScale.value.formatDbLabel(value);
      // 0dBは基準線の位置そのものなので、ラベルは省く。
      if (label === volumeValueScale.value.formatDbLabel(0)) return [];
      return [{ x: node.x, y: node.y, text: `${label} dB` }];
    },
  );
});

const erasePreviewBaseXRanges = computed<VolumeEditorBaseXRange[]>(() =>
  props.previewEraseRanges.map((range) => ({
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  })),
);

const getVolumeEditorLineColors = (element: HTMLElement) => {
  const colors = resolveVolumeLineColors(element, props.isDark);
  return {
    line: colors.line,
    feedback:
      props.previewMode === "VOLUME_DRAW" ? colors.editing : colors.hovered,
    areaContainer: colors.areaContainer,
    endpointContainer: colors.endpointContainer,
    erasePreviewOverlay: colors.erasePreviewOverlay,
  };
};

const cursorClass = computed(() => {
  switch (props.cursorState) {
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

const updateRenderer = (renderImmediately = false) => {
  const view = viewInfo.value;
  const containerElement = canvasContainer.value;
  if (
    renderer == undefined ||
    view == undefined ||
    containerElement == undefined
  ) {
    return;
  }
  renderer.update(
    {
      viewInfo: view,
      volumeSegments: volumeSegments.value,
      feedbackRange: feedbackBaseXRange.value,
      erasePreviewRanges: erasePreviewBaseXRanges.value,
      valueScale: volumeValueScale.value,
      colors: getVolumeEditorLineColors(containerElement),
    },
    renderImmediately,
  );
};

watch(
  [
    () => props.viewportInfo.scaleX,
    () => props.viewportInfo.offsetX,
    () => props.previewMode,
    () => props.isDark,
    volumeSegments,
    feedbackBaseXRange,
    erasePreviewBaseXRanges,
    viewportWidth,
    viewportHeight,
  ],
  () => updateRenderer(),
);

onMounted(async () => {
  const containerElement = canvasContainer.value;
  const canvasElement = canvas.value;
  assertNonNullable(containerElement, "canvas elements are missing.");
  assertNonNullable(canvasElement, "canvas elements are missing.");

  updateViewportRectCache();
  viewportWidth.value = containerElement.clientWidth;
  viewportHeight.value = containerElement.clientHeight;

  rendererAbortController = new AbortController();
  renderer = await VolumeEditorRenderer.create({
    canvas: canvasElement,
    width: viewportWidth.value,
    height: viewportHeight.value,
    initialColors: getVolumeEditorLineColors(containerElement),
    signal: rendererAbortController.signal,
  });
  if (renderer == undefined) {
    return;
  }

  updateRenderer(true);
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
    updateRenderer(true);
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

// 線の中心を表示スケールの0dB位置に置き、Canvasの基準と一致させる。
.volume-zero-line {
  position: absolute;
  inset: 0;
  stroke: var(--scheme-color-song-volume-zero-line);
  stroke-width: 1px;
  stroke-dasharray: 5 4;
}

.volume-annotations {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
  clip-path: inset(
    0 0 0 v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`")
  );
}

.volume-hover-point {
  fill: var(--scheme-color-song-volume-indicator);
}

.volume-endpoint-label {
  font-size: 10px;
  fill: var(--scheme-color-song-volume-endpoint-label);
}

.volume-vertical-guide {
  stroke: var(--scheme-color-song-volume-value-guide-line);
  stroke-width: 1px;
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
  color: var(--scheme-color-song-volume-note-tick);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;

  &.active {
    color: var(--scheme-color-song-volume-note-tick-active);
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
  background: var(--scheme-color-song-volume-note-tick);

  &.active {
    background: var(--scheme-color-song-volume-note-tick-active);
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
