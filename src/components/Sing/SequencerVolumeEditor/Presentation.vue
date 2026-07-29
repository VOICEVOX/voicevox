<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @wheel="handleWheel"
  >
    <SequencerParameterGrid
      class="volume-time-grid"
      :viewportInfo="props.viewportInfo"
    />
    <canvas ref="canvas" class="volume-editor-canvas" />
    <div
      class="volume-editor-area"
      @pointerdown="onSurfacePointerDown"
      @pointermove="onSurfacePointerMove"
      @pointerleave="onSurfacePointerLeave"
    ></div>
    <Tooltip
      :state="tooltipState"
      :tooltipStyle
      :guideLineStyle="tooltipGuideLineStyle"
    />
    <div class="volume-grid-labels" aria-hidden="true">
      <div
        v-for="label in horizontalGridLabels"
        :key="label.label"
        class="volume-grid-label"
        :style="{ top: `${label.y}px` }"
      >
        {{ label.label }}
      </div>
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
import { useVolumeEditorTooltip } from "./useTooltip";
import {
  useVolumeEditorInteraction,
  type VolumeEditorPointerEvent,
} from "./useInteraction";
import {
  buildVolumeSegments,
  VolumeEditorRenderer,
  type VolumeEditorBaseXRange,
} from "./renderer";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import ContextMenu, {
  type ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";
import { useTimelineWheel } from "@/composables/useTimelineWheel";
import type { Tempo, VolumeEditValue } from "@/domain/project/type";
import { secondToTick } from "@/sing/music";
import { clamp } from "@/sing/utility";
import {
  tickToBaseX,
  type CursorState,
  type ViewportInfo,
} from "@/sing/viewHelper";
import { createThemeColorResolver } from "@/sing/graphics/cssColor";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";
import type {
  VolumeEditableFrameRange,
  VolumeEditFrameRange,
} from "@/sing/volumeEditRanges";
import type {
  VolumeEditorPreviewMode,
  VolumeEditorTooltipData,
} from "@/sing/volumeEditorStateMachine/common";
import type { VolumeEditTool } from "@/store/type";
import { assertNonNullable, UnreachableError } from "@/type/utility";

defineOptions({
  name: "SequencerVolumeEditorPresentation",
});

const props = defineProps<{
  viewportInfo: ViewportInfo;
  effectiveFramewise: readonly VolumeEditValue[];
  previewEraseRanges: readonly VolumeEditFrameRange[];
  editableFrameRanges: readonly VolumeEditableFrameRange[];
  tempos: Tempo[];
  tpqn: number;
  editorFrameRate: number;
  previewMode: VolumeEditorPreviewMode;
  cursorState: CursorState;
  tooltipData: VolumeEditorTooltipData | undefined;
  tool: VolumeEditTool;
  isDark: boolean;
  uiLocked: boolean;
}>();

const emit = defineEmits<{
  pointerEvent: [event: VolumeEditorPointerEvent];
  "update:tool": [tool: VolumeEditTool];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const volumeEditMode = relativeVolumeEditMode;
const volumeValueScale = volumeEditMode.valueScale;

const resolveVolumeLineColors = createThemeColorResolver({
  edited: "--scheme-color-sing-volume-edited-line",
  hovered: "--scheme-color-sing-volume-edited-line-hover",
  editing: "--scheme-color-sing-volume-edited-line-editing",
  gridBaseline: "--scheme-color-sing-parameter-grid-measure-line",
  horizontalGrid: "--scheme-color-sing-grid-horizontal-line",
  erasePreviewOverlay: "--scheme-color-scrim",
});

const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref<number>();
const viewportHeight = ref<number>();
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const renderRequestToken = ref(0);

let renderer: VolumeEditorRenderer | undefined;
let resizeObserver: ResizeObserver | undefined;
let rendererAbortController: AbortController | undefined;

const frameToBaseX = (frame: number) => {
  const seconds = frame / props.editorFrameRate;
  const ticks = secondToTick(seconds, toRaw(props.tempos), props.tpqn);
  return tickToBaseX(ticks, props.tpqn);
};

// ツールチップには、ポインタ位置で設定されるボリューム(dB)を表示する。
// 絶対値編集においては以下は検討したが行わない:
// - 原音との差分: 原音はフレームごとに異なるため、ポインタを1フレーム横に動かした
//   だけで値が揺れて読み取りづらい(例: +1.0 → +3.0 → -1.5...)
// - 差分と絶対値の併記: 一目で何の値か分からなくなる
// ※ 相対値編集においては上記知見からベースとなる0dBラインとの差分のみの表示にする
const tooltipState = computed(() => {
  const data = props.tooltipData;
  if (data == undefined) {
    return undefined;
  }
  return {
    value: `${volumeValueScale.formatDbLabel(data.db)} dB`,
    pointerX: data.pointerX,
    pointerY: data.pointerY,
  };
});

const { tooltipStyle, tooltipGuideLineStyle } = useVolumeEditorTooltip({
  tooltipState,
  viewportWidth,
  viewportHeight,
});

const {
  canvasContainer,
  feedbackRange,
  updateViewportRectCache,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerLeave,
} = useVolumeEditorInteraction({
  previewMode: toRef(() => props.previewMode),
  viewportInfo: toRef(() => props.viewportInfo),
  tempos: toRef(() => props.tempos),
  tpqn: toRef(() => props.tpqn),
  frameRate: toRef(() => props.editorFrameRate),
  editableFrameRanges: toRef(() => props.editableFrameRanges),
  volumeEditMode,
  onPointerEvent: (event) => emit("pointerEvent", event),
  onRenderRequested: () => {
    renderRequestToken.value++;
  },
});

const volumeSegments = computed(() =>
  buildVolumeSegments(props.effectiveFramewise, {
    frameToBaseX,
    valueToNormalizedY: (value) => volumeValueScale.dbToNormalizedY(value),
  }),
);

const feedbackBaseXRange = computed<VolumeEditorBaseXRange | undefined>(() => {
  const range = feedbackRange.value;
  if (range == undefined) {
    return undefined;
  }
  return {
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  };
});

const erasePreviewBaseXRanges = computed<VolumeEditorBaseXRange[]>(() =>
  props.previewEraseRanges.map((range) => ({
    startBaseX: frameToBaseX(range.startFrame),
    endBaseX: frameToBaseX(range.endFrame),
  })),
);

const horizontalGridLabels = computed(() => {
  const height = viewportHeight.value;
  if (
    height == undefined ||
    height < VOLUME_EDITOR_LAYOUT.sparseGridLabelMinHeightPx
  ) {
    return [];
  }
  return volumeValueScale.gridLines
    .filter((line) => line.kind !== "minor")
    .map((line) => {
      const y = (1 - volumeValueScale.dbToNormalizedY(line.db)) * height;
      const min = VOLUME_EDITOR_LAYOUT.gridLabelEdgeMarginPx;
      const max = height - VOLUME_EDITOR_LAYOUT.gridLabelEdgeMarginPx;
      if (min > max) {
        throw new UnreachableError(
          "The grid label range is invalid. The viewport height must satisfy sparseGridLabelMinHeightPx.",
        );
      }
      return {
        label: line.label,
        y: clamp(y, min, max),
      };
    });
});

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

const { handleWheel } = useTimelineWheel({
  leftPaddingPx: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
  isWheelDisabled: () => props.previewMode !== "IDLE",
  onPanX: (deltaX) => emit("panTimeline", deltaX),
  onZoomX: (anchorX, deltaY) => emit("zoomTimeline", anchorX, deltaY),
});

const updateRenderer = (renderImmediately = false) => {
  const width = viewportWidth.value;
  const height = viewportHeight.value;
  const containerElement = canvasContainer.value;
  if (
    renderer == undefined ||
    width == undefined ||
    height == undefined ||
    containerElement == undefined
  ) {
    return;
  }
  renderer.update(
    {
      viewInfo: {
        viewportWidth: width,
        viewportHeight: height,
        zoomX: props.viewportInfo.scaleX,
        offsetX: props.viewportInfo.offsetX,
        leftPadding: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
      },
      volumeSegments: volumeSegments.value,
      feedbackRange: feedbackBaseXRange.value,
      erasePreviewRanges: erasePreviewBaseXRanges.value,
      gridLines: volumeValueScale.gridLines,
      valueScale: volumeValueScale,
      previewMode: props.previewMode,
      colors: resolveVolumeLineColors(containerElement, props.isDark),
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
    renderRequestToken,
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
    initialColors: resolveVolumeLineColors(containerElement, props.isDark),
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
}

.volume-time-grid {
  position: absolute;
  inset: 0 0 0 v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
  z-index: 0;
  pointer-events: none;
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
  background: var(--scheme-color-sing-grid-cell-white);
  border-right: 1px solid var(--scheme-color-sing-piano-keys-right-border);
  pointer-events: none;
  user-select: none;
}

.volume-grid-label {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: 0.78;
  white-space: nowrap;
}
</style>
