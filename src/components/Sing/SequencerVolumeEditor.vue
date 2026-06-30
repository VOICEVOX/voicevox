<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @pointerdown="onSurfacePointerDown"
    @pointermove="onSurfacePointerMove"
    @pointerleave="onSurfacePointerLeave"
  >
    <SequencerParameterGrid
      class="volume-time-grid"
      :viewportInfo="props.viewportInfo"
    />
    <canvas
      ref="canvas"
      class="volume-editor-canvas"
      @wheel="handleWheel"
    ></canvas>
    <div
      v-if="tooltipState != undefined"
      class="volume-value-guide-line"
      :style="tooltipGuideLineStyle"
    ></div>
    <div
      v-if="tooltipState != undefined"
      class="volume-value-tooltip"
      :style="tooltipStyle"
    >
      <div class="volume-value-tooltip-primary">
        {{ tooltipState.value.primaryLabel }}
      </div>
      <div
        v-if="tooltipState.value.secondaryLabel != undefined"
        class="volume-value-tooltip-secondary"
      >
        {{ tooltipState.value.secondaryLabel }}
      </div>
    </div>
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
      :sequencerVolumeTool="tool"
      @update:sequencerVolumeTool="setTool"
    />
    <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  toRaw,
  watch,
} from "vue";
import * as PIXI from "pixi.js";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import type { ContextMenuItemData } from "@/components/Menu/ContextMenu/Container.vue";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import { useMounted } from "@/composables/useMounted";
import { Mutex } from "@/helpers/mutex";
import { getOrThrow } from "@/helpers/mapHelper";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import { linearToDecibel } from "@/sing/audio";
import { secondToTick, tickToSecond } from "@/sing/music";
import { getTotalTicks } from "@/sing/rulerHelper";
import { clamp } from "@/sing/utility";
import { baseXToTick, tickToBaseX, type ViewportInfo } from "@/sing/viewHelper";
import { assertNonNullable } from "@/type/utility";
import type { TrackId } from "@/type/preload";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import { VolumeLine } from "@/sing/graphics/volumeLine";
import type { VolumeSegment } from "@/sing/graphics/volumeLine";
import { useTimelineWheel } from "@/composables/useTimelineWheel";
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";
import {
  VOLUME_EDITOR_ALPHA,
  VOLUME_EDITOR_LAYOUT,
  VOLUME_EDITOR_LINE_WIDTH,
  VOLUME_GRAPHICS_COLORS,
  VOLUME_LINE_COLORS,
} from "@/components/Sing/volumeEditorStyle";
import { absoluteVolumeValueScale } from "@/sing/volumeValueScale";
import type { VolumeGridLine } from "@/sing/volumeValueScale";
import {
  getOverlappingVolumeEditableFrameRanges,
  isFrameInVolumeEditableRange,
  maskVolumeEditDataByEditableRanges,
  mergeVolumeEditableFrameRanges,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";
import type { PositionOnVolumeEditor } from "@/sing/volumeEditorStateMachine/common";

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const volumeValueScale = absoluteVolumeValueScale;

const store = useStore();
const { volumePreviewEdit, stateMachineProcess, previewMode, cursorState } =
  useVolumeEditorStateMachine(store, {
    getEditableFrameRanges: () => editableFrameRanges.value,
  });

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const timeSignatures = computed(() => store.state.timeSignatures);
const isDark = computed(() => store.state.currentTheme === "Dark");

const numMeasuresContext = inject(numMeasuresInjectionKey);
if (numMeasuresContext == undefined) {
  throw new Error("numMeasuresContext is undefined.");
}
const { numMeasures } = numMeasuresContext;

watch(previewMode, (mode) => {
  emit("update:needsAutoScroll", mode !== "IDLE");
});

onBeforeUnmount(() => {
  if (previewMode.value !== "IDLE") {
    emit("update:needsAutoScroll", false);
  }
});

const setTool = (value: VolumeEditTool) => {
  if (value === tool.value) return;
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({
    sequencerVolumeTool: value,
  });
};

// phrases内部の更新を検知し、再描画するためのシグネチャ
const phraseSignature = computed(() =>
  [...store.state.phrases.values()].map(
    (phrase) =>
      `${phrase.trackId}:${phrase.startTime}:${phrase.notes.length}:${phrase.minNonPauseStartFrame}:${phrase.maxNonPauseEndFrame}:${phrase.singingVolumeKey}`,
  ),
);

const originalVolumeLineColor = computed(() =>
  isDark.value
    ? VOLUME_LINE_COLORS.originalDark
    : VOLUME_LINE_COLORS.originalLight,
);
const editedVolumeLineColor = computed(() =>
  isDark.value ? VOLUME_LINE_COLORS.editedDark : VOLUME_LINE_COLORS.editedLight,
);

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuData = computed<ContextMenuItemData[]>(() => [
  {
    type: "button",
    label: "ボリューム描画ツール",
    onClick: () => {
      contextMenu.value?.hide();
      setTool("DRAW");
    },
    disableWhenUiLocked: false,
  },
  {
    type: "button",
    label: "ボリューム削除ツール",
    onClick: () => {
      contextMenu.value?.hide();
      setTool("ERASE");
    },
    disableWhenUiLocked: false,
  },
]);

const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "DRAW":
      return "cursor-draw";
    case "ERASE":
      return "cursor-erase";
    case "NOT_ALLOWED":
      return "cursor-not-allowed";
    default:
      return "cursor-crosshair";
  }
});

const { handleWheel } = useTimelineWheel({
  leftPaddingPx: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
  isWheelDisabled: () => previewMode.value !== "IDLE",
  onPanX: (deltaX) => emit("panTimeline", deltaX),
  onZoomX: (anchorX, deltaY) => emit("zoomTimeline", anchorX, deltaY),
});

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref<number>();
const viewportHeight = ref<number>();

// TODO: pixi.js関連の変数をまとめてモジュール化し、isUnmountedなどのフラグを無くす
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let gridGraphics: PIXI.Graphics | undefined;
let erasePreviewOverlay: PIXI.Graphics | undefined;
let originalVolumeLine: VolumeLine | undefined;
let editedVolumeLine: VolumeLine | undefined;
let requestId: number | undefined;
let resizeObserver: ResizeObserver | undefined;
let renderInNextFrame = false;
let isUnmounted = false;
let viewportRectCache:
  | { left: number; top: number; width: number; height: number }
  | undefined;
// NOTE: オリジナルと編集後のセグメントデータ。
// リアクティビティは不要なため（renderInNextFrame経由で描画される）、refではなくplain変数で管理する。
let volumeOriginalSegmentsData: VolumeSegment[] = [];
let volumeEffectiveSegmentsData: VolumeSegment[] = [];
// NOTE: refreshEffectiveVolumeSegmentsがオリジナルのフレームデータを参照するためのキャッシュ。
// 編集データのみ変更されたとき、オリジナルの再計算をスキップするために使用する。
let originalFramewiseCache: number[] = [];
let hasOriginalFramewiseCache = false;
let originalFrameRateCache = 0;
let originalTrackIdCache: TrackId | undefined;
const editableFrameRanges = ref<VolumeEditableFrameRange[]>([]);
const previewEraseRanges = ref<{ startBaseX: number; endBaseX: number }[]>([]);

type VolumeTooltipValue = {
  primaryLabel: string;
  secondaryLabel?: string;
};

type VolumeTooltipState = {
  value: VolumeTooltipValue;
  x: number;
  y: number;
  guideY: number;
};

type VolumePointerInfo = {
  position: PositionOnVolumeEditor;
  db: number;
  originalValue: number | undefined;
  isEditable: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

const tooltipState = ref<VolumeTooltipState>();

watch([tool, previewMode], ([currentTool, currentPreviewMode]) => {
  if (currentTool !== "DRAW" && currentPreviewMode !== "VOLUME_DRAW") {
    tooltipState.value = undefined;
  }
});

const frameToBaseX = (frame: number, frameRate: number) => {
  const seconds = frame / frameRate;
  const rawTempos = toRaw(tempos.value);
  const ticks = secondToTick(seconds, rawTempos, tpqn.value);
  return tickToBaseX(ticks, tpqn.value);
};

const timelineFrameLength = computed(() => {
  const frameRate = editorFrameRate.value;
  const totalTicks = getTotalTicks(
    timeSignatures.value,
    numMeasures.value,
    tpqn.value,
  );
  const totalSeconds = tickToSecond(totalTicks, tempos.value, tpqn.value);
  return Math.max(Math.round(totalSeconds * frameRate), 1);
});

const getOriginalValueFromFramewise = (
  framewiseData: readonly number[],
  frame: number,
) => {
  const value = framewiseData.at(frame);
  if (value == undefined || value === VALUE_INDICATING_NO_DATA) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    throw new Error("original volume value must be finite.");
  }
  if (value <= 0) {
    return undefined;
  }
  return value;
};

const getOriginalValueAtFrame = (frame: number) => {
  if (!hasOriginalFramewiseCache) {
    return undefined;
  }
  return getOriginalValueFromFramewise(originalFramewiseCache, frame);
};

const isDenseHorizontalGridLabel = (line: VolumeGridLine) =>
  line.label === "0" ||
  line.label === "-12" ||
  line.label === "-24" ||
  line.label === "-36";

const isSparseHorizontalGridLine = (line: VolumeGridLine) =>
  line.label === "-12" || line.label === "-24";

const getVisibleHorizontalGridLines = (
  height: number,
  options: { includesLabels: boolean },
) => {
  if (height >= VOLUME_EDITOR_LAYOUT.denseGridLabelMinHeightPx) {
    return volumeValueScale.gridLines;
  }
  if (height >= VOLUME_EDITOR_LAYOUT.sparseGridLabelMinHeightPx) {
    return volumeValueScale.gridLines.filter(isDenseHorizontalGridLabel);
  }
  return options.includesLabels
    ? []
    : volumeValueScale.gridLines.filter(isSparseHorizontalGridLine);
};

const horizontalGridLabels = computed(() => {
  const height = viewportHeight.value;
  if (height == undefined) {
    return [];
  }
  return getVisibleHorizontalGridLines(height, { includesLabels: true }).map(
    (line) => {
      const y = (1 - volumeValueScale.dbToNormalizedY(line.db)) * height;
      return {
        label: line.label,
        y: clamp(y, 8, height - 8),
      };
    },
  );
});

const tooltipStyle = computed(() => {
  const tooltip = tooltipState.value;
  if (tooltip == undefined) {
    return undefined;
  }
  return {
    left: `${tooltip.x}px`,
    top: `${tooltip.y}px`,
  };
});

const tooltipGuideLineStyle = computed(() => {
  const tooltip = tooltipState.value;
  if (tooltip == undefined) {
    return undefined;
  }
  return {
    left: `${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`,
    top: `${tooltip.guideY}px`,
  };
});

const formatAbsoluteDbLabel = (db: number) => {
  const roundedDb = db >= volumeValueScale.maxDb ? 0 : Math.round(db * 10) / 10;
  return (Object.is(roundedDb, -0) ? 0 : roundedDb).toFixed(1);
};

const formatSignedDbLabel = (db: number) => {
  const roundedDb = Math.round(db * 10) / 10;
  const normalizedDb = Object.is(roundedDb, -0) ? 0 : roundedDb;
  return `${normalizedDb > 0 ? "+" : ""}${normalizedDb.toFixed(1)}`;
};

const formatTooltipValue = (pointerInfo: VolumePointerInfo) => {
  const tooltipValue: VolumeTooltipValue = {
    primaryLabel: formatAbsoluteDbLabel(pointerInfo.db),
  };
  const originalValue = pointerInfo.originalValue;
  if (originalValue == undefined) {
    return tooltipValue;
  }
  const originalDb = linearToDecibel(originalValue);
  if (originalDb < volumeValueScale.minDb) {
    return tooltipValue;
  }
  return {
    ...tooltipValue,
    secondaryLabel: `元との差 ${formatSignedDbLabel(pointerInfo.db - originalDb)}`,
  };
};

const resolveTooltipPosition = (pointerInfo: VolumePointerInfo) => {
  const rightX =
    pointerInfo.x +
    VOLUME_EDITOR_LAYOUT.tooltipOffsetPx +
    VOLUME_EDITOR_LAYOUT.tooltipWidthPx;
  const rawX =
    rightX <= pointerInfo.width
      ? pointerInfo.x + VOLUME_EDITOR_LAYOUT.tooltipOffsetPx
      : pointerInfo.x -
        VOLUME_EDITOR_LAYOUT.tooltipOffsetPx -
        VOLUME_EDITOR_LAYOUT.tooltipWidthPx;
  const rawY =
    pointerInfo.y -
      VOLUME_EDITOR_LAYOUT.tooltipOffsetPx -
      VOLUME_EDITOR_LAYOUT.tooltipHeightPx >=
    0
      ? pointerInfo.y -
        VOLUME_EDITOR_LAYOUT.tooltipOffsetPx -
        VOLUME_EDITOR_LAYOUT.tooltipHeightPx
      : pointerInfo.y + VOLUME_EDITOR_LAYOUT.tooltipOffsetPx;
  const maxX = Math.max(
    VOLUME_EDITOR_LAYOUT.tooltipPaddingPx,
    pointerInfo.width -
      VOLUME_EDITOR_LAYOUT.tooltipWidthPx -
      VOLUME_EDITOR_LAYOUT.tooltipPaddingPx,
  );
  const maxY = Math.max(
    VOLUME_EDITOR_LAYOUT.tooltipPaddingPx,
    pointerInfo.height -
      VOLUME_EDITOR_LAYOUT.tooltipHeightPx -
      VOLUME_EDITOR_LAYOUT.tooltipPaddingPx,
  );
  return {
    x: clamp(rawX, VOLUME_EDITOR_LAYOUT.tooltipPaddingPx, maxX),
    y: clamp(rawY, VOLUME_EDITOR_LAYOUT.tooltipPaddingPx, maxY),
  };
};

const updateTooltip = (
  pointerInfo: VolumePointerInfo,
  targetArea: "Editor" | "Window",
  pointerEventType: PointerEvent["type"],
) => {
  const isHoveringDrawTool =
    previewMode.value === "IDLE" &&
    tool.value === "DRAW" &&
    targetArea === "Editor" &&
    pointerEventType !== "pointerleave";
  const isDrawing = previewMode.value === "VOLUME_DRAW";
  if (!pointerInfo.isEditable || (!isHoveringDrawTool && !isDrawing)) {
    tooltipState.value = undefined;
    return;
  }

  const position = resolveTooltipPosition(pointerInfo);
  tooltipState.value = {
    value: formatTooltipValue(pointerInfo),
    x: position.x,
    y: position.y,
    guideY: pointerInfo.y,
  };
};

const buildSegments = (
  framewiseData: number[],
  frameRate: number,
  originalFramewiseData: readonly number[],
) => {
  const segments: VolumeSegment[] = [];
  let current: VolumeSegment | undefined;

  for (const [frame, value] of framewiseData.entries()) {
    if (value === VALUE_INDICATING_NO_DATA) {
      if (current != undefined && current.length >= 2) {
        segments.push(current);
      }
      current = undefined;
      continue;
    }

    const baseX = frameToBaseX(frame, frameRate);
    if (!Number.isFinite(baseX)) {
      throw new Error("baseX must be finite.");
    }
    const originalValue = getOriginalValueFromFramewise(
      originalFramewiseData,
      frame,
    );
    const normalizedY = volumeValueScale.valueToNormalizedY({
      value,
      frame,
      originalValue,
    });

    if (current == undefined) {
      current = [];
    }
    current.push({ baseX, normalizedY });
  }

  if (current != undefined && current.length >= 2) {
    segments.push(current);
  }
  return segments;
};

const updateHorizontalGrid = () => {
  assertNonNullable(gridGraphics);
  assertNonNullable(viewportHeight.value);
  assertNonNullable(viewportWidth.value);
  gridGraphics.clear();
  const height = viewportHeight.value;
  const width = viewportWidth.value;
  if (width <= VOLUME_EDITOR_LAYOUT.keyColumnWidthPx) {
    return;
  }

  const color = isDark.value
    ? VOLUME_GRAPHICS_COLORS.horizontalLineDark
    : VOLUME_GRAPHICS_COLORS.horizontalLineLight;
  for (const line of getVisibleHorizontalGridLines(height, {
    includesLabels: false,
  })) {
    if (!line.drawLine) {
      continue;
    }
    const y =
      Math.round((1 - volumeValueScale.dbToNormalizedY(line.db)) * height) +
      0.5;
    gridGraphics
      .moveTo(VOLUME_EDITOR_LAYOUT.keyColumnWidthPx, y)
      .lineTo(width, y)
      .stroke({
        width: VOLUME_EDITOR_LINE_WIDTH.horizontalGrid,
        color,
        alpha:
          line.kind === "baseline"
            ? VOLUME_EDITOR_ALPHA.horizontalGridBaseline
            : VOLUME_EDITOR_ALPHA.horizontalGrid,
      });
  }
};

const render = () => {
  assertNonNullable(renderer);
  assertNonNullable(stage);
  assertNonNullable(originalVolumeLine);
  assertNonNullable(editedVolumeLine);
  assertNonNullable(viewportWidth.value);
  assertNonNullable(viewportHeight.value);

  const viewInfo = {
    viewportWidth: viewportWidth.value,
    viewportHeight: viewportHeight.value,
    zoomX: props.viewportInfo.scaleX,
    offsetX: props.viewportInfo.offsetX,
    leftPadding: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
  };

  updateHorizontalGrid();

  // 削除中のプレビューオーバーレイ(半透明)
  if (erasePreviewOverlay != undefined) {
    erasePreviewOverlay.clear();
    for (const range of previewEraseRanges.value) {
      if (range.endBaseX <= range.startBaseX) {
        continue;
      }
      const startX =
        range.startBaseX * viewInfo.zoomX -
        viewInfo.offsetX +
        viewInfo.leftPadding;
      const endX =
        range.endBaseX * viewInfo.zoomX -
        viewInfo.offsetX +
        viewInfo.leftPadding;
      const clampedStart = Math.max(0, startX);
      const clampedEnd = Math.min(viewInfo.viewportWidth, endX);
      if (clampedEnd > clampedStart) {
        erasePreviewOverlay
          .rect(
            clampedStart,
            0,
            clampedEnd - clampedStart,
            viewInfo.viewportHeight,
          )
          .fill({
            color: VOLUME_GRAPHICS_COLORS.erasePreviewOverlay,
            alpha: VOLUME_EDITOR_ALPHA.erasePreviewOverlay,
          });
      }
    }
  }

  originalVolumeLine.color = originalVolumeLineColor.value;
  editedVolumeLine.color = editedVolumeLineColor.value;

  originalVolumeLine.update(volumeOriginalSegmentsData, viewInfo);
  editedVolumeLine.update(volumeEffectiveSegmentsData, viewInfo);

  renderer.render(stage);
};

const refreshVolumeSegmentsLock = new Mutex();

const refreshOriginalVolumeSegments = () => {
  const frameRate = editorFrameRate.value;
  const trackId = selectedTrackId.value;

  const baseFrameLength = timelineFrameLength.value;

  const originalFramewise = new Array<number>(baseFrameLength).fill(
    VALUE_INDICATING_NO_DATA,
  );

  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== trackId) {
      continue;
    }
    if (phrase.singingVolumeKey == undefined) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      throw new Error("phrase.queryKey is undefined.");
    }
    const phraseQuery = getOrThrow(store.state.phraseQueries, phrase.queryKey);
    if (phraseQuery.frameRate !== frameRate) {
      throw new Error(
        "The frame rate between the singing guide and the edit does not match.",
      );
    }
    const phraseSingingVolume = getOrThrow(
      store.state.phraseSingingVolumes,
      phrase.singingVolumeKey,
    );

    const startFrame = Math.round(phrase.startTime * frameRate);
    const endFrame = startFrame + phraseSingingVolume.length;
    if (originalFramewise.length < endFrame) {
      originalFramewise.push(
        ...new Array(endFrame - originalFramewise.length).fill(
          VALUE_INDICATING_NO_DATA,
        ),
      );
    }
    for (const [i, value] of phraseSingingVolume.entries()) {
      const v = Math.max(0, value);
      originalFramewise[startFrame + i] = Math.min(v, 1);
    }
  }

  originalFramewiseCache = originalFramewise;
  hasOriginalFramewiseCache = true;
  originalFrameRateCache = frameRate;
  originalTrackIdCache = trackId;

  // 編集可能区間のみ描画する（ポーズ区間のボリュームを非表示にする）
  const maskedOriginal = maskVolumeEditDataByEditableRanges(
    { values: originalFramewise, startFrame: 0 },
    editableFrameRanges.value,
  );
  volumeOriginalSegmentsData = buildSegments(
    maskedOriginal,
    frameRate,
    originalFramewise,
  );
  renderInNextFrame = true;
};

const refreshEditableFrameRanges = () => {
  const frameRate = editorFrameRate.value;

  const ranges: VolumeEditableFrameRange[] = [];
  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    if (phrase.singingVolumeKey == undefined) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      throw new Error("phrase.queryKey is undefined.");
    }
    const phraseQuery = getOrThrow(store.state.phraseQueries, phrase.queryKey);
    if (phraseQuery.frameRate !== frameRate) {
      throw new Error(
        "The frame rate between the singing guide and the edit does not match.",
      );
    }
    const phraseSingingVolume = getOrThrow(
      store.state.phraseSingingVolumes,
      phrase.singingVolumeKey,
    );
    const phraseStartFrame = Math.round(phrase.startTime * frameRate);
    const phraseEndFrame = phraseStartFrame + phraseSingingVolume.length;
    const startOffset = phrase.minNonPauseStartFrame ?? 0;
    const endOffset = phrase.maxNonPauseEndFrame ?? phraseSingingVolume.length;
    const startFrame = Math.max(0, phraseStartFrame + startOffset);
    const endFrame = Math.min(phraseEndFrame, phraseStartFrame + endOffset);
    if (startFrame < endFrame) {
      ranges.push({ startFrame, endFrame });
    }
  }

  editableFrameRanges.value = mergeVolumeEditableFrameRanges(ranges);
};

const refreshEffectiveVolumeSegments = () => {
  const frameRate = editorFrameRate.value;

  if (!hasOriginalFramewiseCache) {
    throw new Error("Original framewise cache is not available.");
  }
  if (originalTrackIdCache !== selectedTrackId.value) {
    return;
  }
  if (originalFrameRateCache !== frameRate) {
    throw new Error(
      `Frame rate mismatch in cache: expected ${frameRate}, got ${originalFrameRateCache}.`,
    );
  }

  const originalFramewise = originalFramewiseCache;
  const editableRanges = editableFrameRanges.value;
  let maxFrame = Math.max(originalFramewise.length, 1);

  const baseEditData = selectedTrack.value.volumeEditData;
  const editFramewise = new Array<number>(
    Math.max(maxFrame, baseEditData.length),
  ).fill(VALUE_INDICATING_NO_DATA);
  for (const [i, value] of baseEditData.entries()) {
    editFramewise[i] = value;
  }

  const preview = volumePreviewEdit.value;
  if (preview != undefined) {
    if (preview.type === "draw") {
      const startFrame = Math.max(0, preview.startFrame);
      const endFrame = startFrame + preview.data.length;
      if (editFramewise.length < endFrame) {
        editFramewise.push(
          ...new Array(endFrame - editFramewise.length).fill(
            VALUE_INDICATING_NO_DATA,
          ),
        );
      }
      // プレビューデータを editableRanges でマスクして適用
      const maskedPreview = maskVolumeEditDataByEditableRanges(
        { values: preview.data, startFrame: preview.startFrame },
        editableRanges,
      );
      for (const [i, rawValue] of maskedPreview.entries()) {
        if (rawValue === VALUE_INDICATING_NO_DATA) continue;
        editFramewise[startFrame + i] = Math.min(Math.max(rawValue, 0), 1);
      }
      maxFrame = Math.max(maxFrame, endFrame);
      previewEraseRanges.value = [];
    } else if (preview.type === "erase") {
      const start = Math.max(0, preview.startFrame);
      const end = start + preview.frameLength;
      if (editFramewise.length < end) {
        editFramewise.push(
          ...new Array(end - editFramewise.length).fill(
            VALUE_INDICATING_NO_DATA,
          ),
        );
      }
      const overlaps = getOverlappingVolumeEditableFrameRanges(
        start,
        preview.frameLength,
        editableRanges,
      );
      for (const overlap of overlaps) {
        editFramewise.fill(
          VALUE_INDICATING_NO_DATA,
          overlap.startFrame,
          overlap.endFrame,
        );
      }
      maxFrame = Math.max(maxFrame, end);
      previewEraseRanges.value = overlaps.map((overlap) => ({
        startBaseX: frameToBaseX(overlap.startFrame, frameRate),
        endBaseX: frameToBaseX(overlap.endFrame, frameRate),
      }));
    }
  }
  if (preview == undefined) {
    previewEraseRanges.value = [];
  }

  const totalFrames = Math.max(
    maxFrame,
    originalFramewise.length,
    editFramewise.length,
  );
  if (editFramewise.length < totalFrames) {
    editFramewise.push(
      ...new Array(totalFrames - editFramewise.length).fill(
        VALUE_INDICATING_NO_DATA,
      ),
    );
  }
  const effectiveFramewise = new Array<number>(totalFrames).fill(
    VALUE_INDICATING_NO_DATA,
  );
  for (const [i] of effectiveFramewise.entries()) {
    const edited = editFramewise.at(i) ?? VALUE_INDICATING_NO_DATA;
    if (edited !== VALUE_INDICATING_NO_DATA) {
      effectiveFramewise[i] = Math.min(Math.max(edited, 0), 1);
    } else {
      effectiveFramewise[i] =
        originalFramewise.at(i) ?? VALUE_INDICATING_NO_DATA;
    }
  }

  // 編集不可区間のボリュームを非表示にする
  const maskedEffective = maskVolumeEditDataByEditableRanges(
    { values: effectiveFramewise, startFrame: 0 },
    editableRanges,
  );

  volumeEffectiveSegmentsData = buildSegments(
    maskedEffective,
    frameRate,
    originalFramewise,
  );
  renderInNextFrame = true;
};

const dispatchVolumeEditorEvent = (
  pointerEvent: PointerEvent,
  targetArea: "Editor" | "Window",
) => {
  const pointerInfo = computeViewportPointerInfo(pointerEvent);
  stateMachineProcess({
    type: "pointerEvent",
    targetArea,
    pointerEvent,
    position: pointerInfo.position,
  });
  updateTooltip(pointerInfo, targetArea, pointerEvent.type);
};

const computeViewportPointerInfo = (
  pointerEvent: PointerEvent,
): VolumePointerInfo => {
  const rect =
    viewportRectCache ?? canvasContainer.value?.getBoundingClientRect();
  if (rect == undefined) {
    throw new Error("volume editor viewport element is null.");
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error("volume editor viewport size is invalid.");
  }
  const localX = pointerEvent.clientX - rect.left;
  const localY = pointerEvent.clientY - rect.top;
  const width = rect.width;
  const height = rect.height;
  const clampedX = clamp(localX, 0, width);
  const clampedY = clamp(localY, 0, height);

  const timelineX =
    props.viewportInfo.offsetX -
    VOLUME_EDITOR_LAYOUT.keyColumnWidthPx +
    clampedX;
  const baseX = Math.max(0, timelineX) / props.viewportInfo.scaleX;
  const ticks = baseXToTick(baseX, tpqn.value);
  const seconds = tickToSecond(ticks, tempos.value, tpqn.value);
  const frame = Math.max(0, Math.round(seconds * editorFrameRate.value));

  const normalizedY = 1 - clampedY / height;
  const db = volumeValueScale.normalizedYToDb(normalizedY);
  const originalValue = getOriginalValueAtFrame(frame);
  const value = volumeValueScale.dbToValue({
    db,
    frame,
    originalValue,
  });

  return {
    position: {
      frame,
      value,
    },
    db,
    originalValue,
    isEditable: isFrameInVolumeEditableRange(frame, editableFrameRanges.value),
    x: clampedX,
    y: clampedY,
    width,
    height,
  };
};

const onSurfacePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }
  if (canvasContainer.value != undefined) {
    const rect = canvasContainer.value.getBoundingClientRect();
    viewportRectCache = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  if (store.state.parameterPanelEditTarget !== "VOLUME") {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }
  dispatchVolumeEditorEvent(event, "Editor");
};

const onSurfacePointerMove = (event: PointerEvent) => {
  if (previewMode.value === "IDLE") {
    dispatchVolumeEditorEvent(event, "Editor");
  }
};

const onSurfacePointerLeave = (event: PointerEvent) => {
  if (previewMode.value === "IDLE") {
    dispatchVolumeEditorEvent(event, "Editor");
  }
};

const onWindowPointerMove = (event: PointerEvent) => {
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowPointerUp = (event: PointerEvent) => {
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowPointerCancel = (event: PointerEvent) => {
  dispatchVolumeEditorEvent(event, "Window");
};

watch(
  [
    () => props.viewportInfo.scaleX,
    () => props.viewportInfo.offsetX,
    isDark,
    () => viewportWidth.value,
    () => viewportHeight.value,
  ],
  () => {
    renderInNextFrame = true;
  },
);

const { mounted } = useMounted();

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
// NOTE: オリジナルのボリュームデータが変わったとき、実効データも再計算が必要
// （実効データはオリジナルと編集データのマージであるため）
watch(
  [
    mounted,
    phraseSignature,
    selectedTrackId,
    tempos,
    timeSignatures,
    tpqn,
    numMeasures,
    editorFrameRate,
  ],
  async ([isMounted]) => {
    await using _lock = await refreshVolumeSegmentsLock.acquire();
    if (isMounted) {
      refreshEditableFrameRanges();
      refreshOriginalVolumeSegments();
      refreshEffectiveVolumeSegments();
    }
  },
);

watch(
  [
    selectedTrackId,
    () => selectedTrack.value.volumeEditData,
    volumePreviewEdit,
  ],
  async () => {
    await using _lock = await refreshVolumeSegmentsLock.acquire();
    refreshEffectiveVolumeSegments();
  },
);

onMounted(async () => {
  const containerEl = canvasContainer.value;
  const canvasEl = canvas.value;
  if (containerEl == undefined || canvasEl == undefined) {
    throw new Error("canvas elements are missing.");
  }
  if (store.state.parameterPanelEditTarget !== "VOLUME") {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }

  // NOTE: レイアウトスラッシングなど防止のため、初期サイズをキャッシュする
  const initialRect = containerEl.getBoundingClientRect();
  viewportRectCache = {
    left: initialRect.left,
    top: initialRect.top,
    width: initialRect.width,
    height: initialRect.height,
  };
  viewportWidth.value = containerEl.clientWidth;
  viewportHeight.value = containerEl.clientHeight;

  renderer = await PIXI.autoDetectRenderer({
    canvas: canvasEl,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: viewportWidth.value,
    height: viewportHeight.value,
  });
  if (isUnmounted) {
    renderer.destroy({ removeView: true });
    return;
  }
  stage = new PIXI.Container();
  erasePreviewOverlay = new PIXI.Graphics();
  gridGraphics = new PIXI.Graphics();
  originalVolumeLine = new VolumeLine({
    color: originalVolumeLineColor.value,
    width: VOLUME_EDITOR_LINE_WIDTH.originalVolume,
    dashed: true,
    isVisible: true,
  });
  editedVolumeLine = new VolumeLine({
    color: editedVolumeLineColor.value,
    width: VOLUME_EDITOR_LINE_WIDTH.editedVolume,
    showArea: true,
    areaAlpha: VOLUME_EDITOR_ALPHA.editedVolumeArea,
    isVisible: true,
  });

  stage.addChild(erasePreviewOverlay);
  stage.addChild(gridGraphics);
  stage.addChild(originalVolumeLine.container);
  stage.addChild(editedVolumeLine.container);

  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  requestId = window.requestAnimationFrame(callback);

  resizeObserver = new ResizeObserver(() => {
    assertNonNullable(renderer);
    assertNonNullable(canvasContainer.value);
    const width = canvasContainer.value.clientWidth;
    const height = canvasContainer.value.clientHeight;
    const rect = canvasContainer.value.getBoundingClientRect();
    viewportRectCache = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    if (width > 0 && height > 0) {
      if (width === viewportWidth.value && height === viewportHeight.value) {
        return;
      }
      viewportWidth.value = width;
      viewportHeight.value = height;
      renderer.resize(width, height);
      // NOTE: 次フレームで再描画するとちらついてしまうため、同期的に再描画する
      renderInNextFrame = false;
      render();
    }
  });
  resizeObserver.observe(containerEl);

  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerCancel);
  renderInNextFrame = true;
});

onUnmounted(() => {
  isUnmounted = true;
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }
  originalVolumeLine?.destroy();
  editedVolumeLine?.destroy();
  gridGraphics?.destroy();
  stage?.destroy();
  renderer?.destroy({ removeView: true });
  resizeObserver?.disconnect();
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerCancel);
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

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

.volume-grid-labels {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 2;
  width: v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
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

.volume-value-guide-line {
  position: absolute;
  right: 0;
  z-index: 2;
  height: 0;
  border-top: v-bind("`${VOLUME_EDITOR_LINE_WIDTH.tooltipGuide}px`") solid
    color-mix(in oklch, var(--scheme-color-primary) 60%, transparent);
  opacity: v-bind("VOLUME_EDITOR_ALPHA.tooltipGuide");
  transform: translateY(-0.5px);
  pointer-events: none;
}

.volume-value-tooltip {
  position: absolute;
  z-index: calc(#{vars.$z-index-sing-tool-palette} + 1);
  box-sizing: border-box;
  width: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipWidthPx}px`");
  min-height: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipHeightPx}px`");
  padding: 3px 6px;
  border-radius: 4px;
  background: color-mix(in oklch, var(--scheme-color-surface) 8%, #000 92%);
  box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.volume-value-tooltip-primary {
  font-size: 11px;
  line-height: 14px;
}

.volume-value-tooltip-secondary {
  font-size: 10px;
  line-height: 12px;
  opacity: 0.78;
}
</style>
