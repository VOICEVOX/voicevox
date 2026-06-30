<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @pointerdown="onSurfacePointerDown"
    @pointermove="onSurfacePointerMove"
    @pointerleave="onSurfacePointerLeave"
  >
    <canvas
      ref="canvas"
      class="volume-editor-canvas"
      @wheel="handleWheel"
    ></canvas>
    <div
      v-if="volumeValueTooltip != undefined"
      class="volume-value-guide-line"
      :style="volumeValueGuideLineStyle"
    ></div>
    <div
      v-if="volumeValueTooltip != undefined"
      class="volume-value-tooltip"
      :style="volumeValueTooltipStyle"
    >
      {{ volumeValueTooltip.label }}
    </div>
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
  toRef,
  watch,
} from "vue";
import * as PIXI from "pixi.js";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import type { ContextMenuItemData } from "@/components/Menu/ContextMenu/Container.vue";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import { useMounted } from "@/composables/useMounted";
import { createLogger } from "@/helpers/log";
import { Mutex } from "@/helpers/mutex";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import { decibelToLinear, linearToDecibel } from "@/sing/audio";
import { secondToTick, tickToSecond } from "@/sing/music";
import { getTotalTicks } from "@/sing/rulerHelper";
import { clamp } from "@/sing/utility";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { assertNonNullable } from "@/type/utility";
import type { TrackId } from "@/type/preload";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import { VolumeLine } from "@/sing/graphics/volumeLine";
import type { VolumeSegment } from "@/sing/graphics/volumeLine";
import { Color } from "@/sing/graphics/lineStrip";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";
import {
  getOverlappingVolumeEditableFrameRanges,
  maskVolumeEditDataByEditableRanges,
  mergeVolumeEditableFrameRanges,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";
import { useTimelineWheel } from "@/composables/useTimelineWheel";
import type { VolumeEditValueMode } from "@/components/Sing/parameterPanelViewMode";
import type { PositionOnVolumeEditor } from "@/sing/volumeEditorStateMachine/common";

const props = defineProps<{
  offsetX: number;
  valueMode: VolumeEditValueMode;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

// NOTE: 最大値・最小値はエンジン出力と表示に合わせたヒューリスティックなもの
// エディタ側の表示や編集の問題ではないためエンジンが変わったら変更可能だが、既存のプロジェクトで表示が変わる点には注意
// 最大値: 0dB相当でのエンジン出力品質があまりよくなさそうなため、-0.5dB相当に設定
// 最小値: -36dB程度以下はエンジンの出力がノイズっぽいのと、オリジナルボリューム(エンジン出力デフォルト)の典型的な範囲で見やすい程度の高さにするため
const MIN_DISPLAY_DB = -36.5;
const MAX_DISPLAY_DB = -0.5;
const ABSOLUTE_VOLUME_LEVEL_BASE_DB = -36;
const MIN_RELATIVE_DISPLAY_DB = -12;
const MAX_RELATIVE_DISPLAY_DB = 12;
const KEY_COLUMN_WIDTH_PX = 48; // ScoreSequencerの左側キー領域と合わせる
const VOLUME_VALUE_TOOLTIP_WIDTH_PX = 54;
const VOLUME_VALUE_TOOLTIP_HEIGHT_PX = 22;
const VOLUME_VALUE_TOOLTIP_OFFSET_PX = 10;
const VOLUME_VALUE_TOOLTIP_PADDING_PX = 4;

const { warn } = createLogger("SequencerVolumeEditor");
const store = useStore();
const { volumePreviewEdit, stateMachineProcess, previewMode, cursorState } =
  useVolumeEditorStateMachine(store, {
    getEditableFrameRanges: () => editableFrameRanges.value,
    getAbsoluteVolumeFromRelativeDb: (frame, relativeDb) =>
      getOriginalVolumeAtFrame(frame) * decibelToLinear(relativeDb),
  });

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const timeSignatures = computed(() => store.state.timeSignatures);
const isDark = computed(() => store.state.currentTheme === "Dark");

const numMeasuresContext = inject(numMeasuresInjectionKey, null);
const numMeasures = computed(() => numMeasuresContext?.numMeasures.value ?? 0);

const setTool = (value: VolumeEditTool) => {
  if (value === tool.value) return;
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({
    sequencerVolumeTool: value,
  });
};

// Mapの中身更新も検知するためのシグネチャ
const phraseSignature = computed(() =>
  [...store.state.phrases.values()].map(
    (phrase) =>
      `${phrase.trackId}:${phrase.startTime}:${phrase.notes.length}:${phrase.minNonPauseStartFrame}:${phrase.maxNonPauseEndFrame}`,
  ),
);
const phraseQuerySignature = computed(() =>
  [...store.state.phraseQueries.entries()].map(([key, query]) => {
    const volumeLen = query?.volume?.length ?? 0;
    const frameRate = query?.frameRate ?? 0;
    return `${key}:${volumeLen}:${frameRate}`;
  }),
);

const originalVolumeLineColorLight = new Color(156, 158, 156, 190);
const originalVolumeLineColorDark = new Color(156, 160, 156, 178);
const editedVolumeLineColorLight = new Color(72, 108, 86, 210);
const editedVolumeLineColorDark = new Color(156, 195, 169, 210);
const absoluteVolumeMajorGridDbValues = [
  MAX_DISPLAY_DB,
  -6,
  -12,
  -18,
  -24,
  -30,
  -36,
] as const;
const absoluteVolumeMinorGridDbValues = [-3, -9, -15, -21, -27, -33] as const;
const relativeVolumeMajorGridDbValues = [12, 6, 0, -6, -12] as const;
const relativeVolumeMinorGridDbValues = [9, 3, -3, -9] as const;

type VolumePointerInfo = {
  readonly position: PositionOnVolumeEditor;
  readonly db: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type VolumeValueTooltip = {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly guideY: number;
};

const originalVolumeLineColor = computed(() =>
  isDark.value ? originalVolumeLineColorDark : originalVolumeLineColorLight,
);
const editedVolumeLineColor = computed(() =>
  isDark.value ? editedVolumeLineColorDark : editedVolumeLineColorLight,
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
  leftPaddingPx: KEY_COLUMN_WIDTH_PX,
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
let volumeDbLabelBackground: PIXI.Graphics | undefined;
let volumeDbLabelContainer: PIXI.Container | undefined;
let volumeDbLabelTextStyles:
  | { light: PIXI.TextStyle; dark: PIXI.TextStyle }
  | undefined;
let erasePreviewOverlay: PIXI.Graphics | undefined;
let disabledOverlayGraphics: PIXI.Graphics | undefined;
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
const volumeDbLabelTexts: PIXI.Text[] = [];
const volumeValueTooltip = ref<VolumeValueTooltip>();
const volumeValueTooltipStyle = computed(() => {
  const tooltip = volumeValueTooltip.value;
  if (tooltip == undefined) {
    return undefined;
  }
  return {
    left: `${tooltip.x}px`,
    top: `${tooltip.y}px`,
  };
});
const volumeValueGuideLineStyle = computed(() => {
  const tooltip = volumeValueTooltip.value;
  if (tooltip == undefined) {
    return undefined;
  }
  return {
    left: `${KEY_COLUMN_WIDTH_PX}px`,
    top: `${tooltip.guideY}px`,
  };
});

watch(previewMode, (mode) => {
  emit("update:needsAutoScroll", mode !== "IDLE");
  if (mode !== "VOLUME_DRAW") {
    volumeValueTooltip.value = undefined;
  }
});

watch(tool, (currentTool) => {
  if (currentTool !== "DRAW" && previewMode.value !== "VOLUME_DRAW") {
    volumeValueTooltip.value = undefined;
  }
});

onBeforeUnmount(() => {
  if (previewMode.value !== "IDLE") {
    emit("update:needsAutoScroll", false);
  }
  volumeValueTooltip.value = undefined;
});

const gridPatterns = useSequencerGrid({
  timeSignatures: toRef(() => timeSignatures.value),
  tpqn: toRef(() => tpqn.value),
  sequencerZoomX: toRef(() => sequencerZoomX.value),
  numMeasures: toRef(() => numMeasures.value),
});

const normalizedYToDb = (y: number) => {
  const clampedY = clamp(y, 0, 1);
  return MIN_DISPLAY_DB + clampedY * (MAX_DISPLAY_DB - MIN_DISPLAY_DB);
};

const dbToNormalizedY = (db: number) => {
  const clampedDb = clamp(db, MIN_DISPLAY_DB, MAX_DISPLAY_DB);
  return (clampedDb - MIN_DISPLAY_DB) / (MAX_DISPLAY_DB - MIN_DISPLAY_DB);
};

const linearToNormalizedY = (linear: number) => {
  const db = linearToDecibel(Math.max(linear, 0));
  return dbToNormalizedY(db);
};

const relativeDbToNormalizedY = (db: number) => {
  const clampedDb = clamp(db, MIN_RELATIVE_DISPLAY_DB, MAX_RELATIVE_DISPLAY_DB);
  return (
    (clampedDb - MIN_RELATIVE_DISPLAY_DB) /
    (MAX_RELATIVE_DISPLAY_DB - MIN_RELATIVE_DISPLAY_DB)
  );
};

const normalizedYToRelativeDb = (y: number) => {
  const clampedY = clamp(y, 0, 1);
  return (
    MIN_RELATIVE_DISPLAY_DB +
    clampedY * (MAX_RELATIVE_DISPLAY_DB - MIN_RELATIVE_DISPLAY_DB)
  );
};

const valueModeDbToNormalizedY = (db: number) =>
  props.valueMode === "relative"
    ? relativeDbToNormalizedY(db)
    : dbToNormalizedY(db);

const formatVolumeDbLabel = (db: number) => {
  if (props.valueMode === "relative") {
    if (db === 0) return "0";
    return db > 0 ? `+${db}` : `${db}`;
  }
  const levelDb = Math.round(clamp(db - ABSOLUTE_VOLUME_LEVEL_BASE_DB, 0, 36));
  return levelDb === 0 ? "0" : `+${levelDb}`;
};

const formatVolumeTooltipLabel = (db: number) => {
  const roundedDb =
    Math.round(
      clamp(
        db,
        props.valueMode === "relative"
          ? MIN_RELATIVE_DISPLAY_DB
          : MIN_DISPLAY_DB,
        props.valueMode === "relative"
          ? MAX_RELATIVE_DISPLAY_DB
          : MAX_DISPLAY_DB,
      ) * 10,
    ) / 10;
  if (props.valueMode === "relative") {
    const prefix = roundedDb > 0 ? "+" : "";
    return `${prefix}${roundedDb.toFixed(1)} dB`;
  }
  const absoluteLevelDb =
    Math.round(clamp(roundedDb - ABSOLUTE_VOLUME_LEVEL_BASE_DB, 0, 36) * 10) /
    10;
  const prefix = absoluteLevelDb > 0 ? "+" : "";
  return `${prefix}${absoluteLevelDb.toFixed(1)}`;
};

const resolveVolumeValueTooltipPosition = (pointerInfo: VolumePointerInfo) => {
  const rightX =
    pointerInfo.x +
    VOLUME_VALUE_TOOLTIP_OFFSET_PX +
    VOLUME_VALUE_TOOLTIP_WIDTH_PX;
  const x =
    rightX <= pointerInfo.width
      ? pointerInfo.x + VOLUME_VALUE_TOOLTIP_OFFSET_PX
      : pointerInfo.x -
        VOLUME_VALUE_TOOLTIP_OFFSET_PX -
        VOLUME_VALUE_TOOLTIP_WIDTH_PX;
  const y =
    pointerInfo.y -
      VOLUME_VALUE_TOOLTIP_OFFSET_PX -
      VOLUME_VALUE_TOOLTIP_HEIGHT_PX >=
    0
      ? pointerInfo.y -
        VOLUME_VALUE_TOOLTIP_OFFSET_PX -
        VOLUME_VALUE_TOOLTIP_HEIGHT_PX
      : pointerInfo.y + VOLUME_VALUE_TOOLTIP_OFFSET_PX;
  const maxX = Math.max(
    VOLUME_VALUE_TOOLTIP_PADDING_PX,
    pointerInfo.width -
      VOLUME_VALUE_TOOLTIP_WIDTH_PX -
      VOLUME_VALUE_TOOLTIP_PADDING_PX,
  );
  const maxY = Math.max(
    VOLUME_VALUE_TOOLTIP_PADDING_PX,
    pointerInfo.height -
      VOLUME_VALUE_TOOLTIP_HEIGHT_PX -
      VOLUME_VALUE_TOOLTIP_PADDING_PX,
  );
  return {
    x: clamp(x, VOLUME_VALUE_TOOLTIP_PADDING_PX, maxX),
    y: clamp(y, VOLUME_VALUE_TOOLTIP_PADDING_PX, maxY),
  };
};

const updateVolumeValueTooltip = (
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
  if (!isHoveringDrawTool && !isDrawing) {
    volumeValueTooltip.value = undefined;
    return;
  }
  const position = resolveVolumeValueTooltipPosition(pointerInfo);
  volumeValueTooltip.value = {
    label: formatVolumeTooltipLabel(pointerInfo.db),
    x: position.x,
    y: position.y,
    guideY: pointerInfo.y,
  };
};

const frameToBaseX = (frame: number, frameRate: number) => {
  const seconds = frame / frameRate;
  const rawTempos = toRaw(tempos.value);
  const ticks = secondToTick(seconds, rawTempos, tpqn.value);
  return tickToBaseX(ticks, tpqn.value);
};

const timelineFrameLength = computed(() => {
  const frameRate = editorFrameRate.value;
  if (frameRate <= 0) {
    return 1;
  }
  const totalTicks = getTotalTicks(
    timeSignatures.value,
    numMeasures.value,
    tpqn.value,
  );
  const totalSeconds = tickToSecond(totalTicks, tempos.value, tpqn.value);
  return Math.max(Math.round(totalSeconds * frameRate), 1);
});

const frameToScreenX = (frame: number, frameRate: number) => {
  return (
    frameToBaseX(frame, frameRate) * sequencerZoomX.value -
    props.offsetX +
    KEY_COLUMN_WIDTH_PX
  );
};

const buildSegments = (framewiseData: number[], frameRate: number) => {
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
      continue;
    }
    const normalizedY = linearToNormalizedY(Math.min(Math.max(value, 0), 1));

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

const buildRelativeBaselineSegments = (
  originalFramewiseData: number[],
  frameRate: number,
) => {
  const segments: VolumeSegment[] = [];
  let current: VolumeSegment | undefined;

  for (const [frame, value] of originalFramewiseData.entries()) {
    if (value === VALUE_INDICATING_NO_DATA) {
      if (current != undefined && current.length >= 2) {
        segments.push(current);
      }
      current = undefined;
      continue;
    }

    const baseX = frameToBaseX(frame, frameRate);
    if (!Number.isFinite(baseX)) {
      continue;
    }

    if (current == undefined) {
      current = [];
    }
    current.push({ baseX, normalizedY: relativeDbToNormalizedY(0) });
  }

  if (current != undefined && current.length >= 2) {
    segments.push(current);
  }
  return segments;
};

const getRelativeDb = (editedLinear: number, originalLinear: number) => {
  if (originalLinear <= 0) {
    return editedLinear <= 0 ? 0 : MAX_RELATIVE_DISPLAY_DB;
  }
  if (editedLinear <= 0) {
    return MIN_RELATIVE_DISPLAY_DB;
  }
  return linearToDecibel(editedLinear) - linearToDecibel(originalLinear);
};

const buildRelativeSegments = (
  effectiveFramewiseData: number[],
  originalFramewiseData: number[],
  frameRate: number,
) => {
  const segments: VolumeSegment[] = [];
  let current: VolumeSegment | undefined;

  for (const [frame, value] of effectiveFramewiseData.entries()) {
    const originalValue =
      originalFramewiseData.at(frame) ?? VALUE_INDICATING_NO_DATA;
    if (
      value === VALUE_INDICATING_NO_DATA ||
      originalValue === VALUE_INDICATING_NO_DATA
    ) {
      if (current != undefined && current.length >= 2) {
        segments.push(current);
      }
      current = undefined;
      continue;
    }

    const baseX = frameToBaseX(frame, frameRate);
    if (!Number.isFinite(baseX)) {
      continue;
    }
    const relativeDb = getRelativeDb(
      Math.max(value, 0),
      Math.max(originalValue, 0),
    );

    if (current == undefined) {
      current = [];
    }
    current.push({ baseX, normalizedY: relativeDbToNormalizedY(relativeDb) });
  }

  if (current != undefined && current.length >= 2) {
    segments.push(current);
  }
  return segments;
};

const updateGrid = () => {
  assertNonNullable(gridGraphics);
  assertNonNullable(volumeDbLabelBackground);
  assertNonNullable(volumeDbLabelContainer);
  assertNonNullable(volumeDbLabelTextStyles);
  assertNonNullable(viewportHeight.value);
  assertNonNullable(viewportWidth.value);
  gridGraphics.clear();
  volumeDbLabelBackground.clear();
  const height = viewportHeight.value;
  const width = viewportWidth.value;
  // NOTE: ScoreSequencerのSVGグリッドは sing-colors.scss の CSS変数で色指定しているが、
  // PIXI.GraphicsではCSS変数を参照できないため、対応する近似hex値をハードコードしている。
  // ピアノロール側とつながって見えるように、時間方向の縦線は不透明で描画する。
  // sing-grid-beat-line: light oklch(lr-85), dark oklch(lr-4)
  // sing-grid-measure-line: light oklch(lr-75), dark oklch(lr-40)
  const beatColor = isDark.value ? 0x020202 : 0xd3d3d3;
  const measureColor = isDark.value ? 0x595959 : 0xb7b7b7;
  const volumeGridColor = isDark.value ? 0x6a6a6a : 0x9a9a9a;
  const labelBackgroundColor = isDark.value ? 0x1a1a1a : 0xf1f1f1;
  const labelStyle = isDark.value
    ? volumeDbLabelTextStyles.dark
    : volumeDbLabelTextStyles.light;
  const majorGridDbValues =
    props.valueMode === "relative"
      ? relativeVolumeMajorGridDbValues
      : absoluteVolumeMajorGridDbValues;
  const minorGridDbValues =
    props.valueMode === "relative"
      ? relativeVolumeMinorGridDbValues
      : absoluteVolumeMinorGridDbValues;
  const spacingFromZero =
    props.valueMode === "relative"
      ? Math.abs(relativeDbToNormalizedY(0) - relativeDbToNormalizedY(3)) *
        height
      : Math.abs(dbToNormalizedY(-6) - dbToNormalizedY(-3)) * height;
  const majorGridSpacingPx =
    props.valueMode === "relative"
      ? Math.abs(relativeDbToNormalizedY(6) - relativeDbToNormalizedY(0)) *
        height
      : Math.abs(dbToNormalizedY(-12) - dbToNormalizedY(-6)) * height;
  const showMinorGrid = spacingFromZero >= 12;
  const showLabels = width >= 64 && height >= 40 && majorGridSpacingPx >= 16;

  if (width > 0 && height > 0) {
    volumeDbLabelBackground
      .rect(0, 0, Math.min(KEY_COLUMN_WIDTH_PX, width), height)
      .fill({ color: labelBackgroundColor, alpha: 1 });
  }
  volumeDbLabelContainer.renderable = showLabels;

  if (showMinorGrid) {
    for (const db of minorGridDbValues) {
      const y = Math.round((1 - valueModeDbToNormalizedY(db)) * height) + 0.5;
      gridGraphics
        .moveTo(KEY_COLUMN_WIDTH_PX, y)
        .lineTo(width, y)
        .stroke({ width: 1, color: volumeGridColor, alpha: 0.09 });
    }
  }

  for (const [index, db] of majorGridDbValues.entries()) {
    const y = Math.round((1 - valueModeDbToNormalizedY(db)) * height) + 0.5;
    const isBaseline =
      props.valueMode === "relative" ? db === 0 : db === MAX_DISPLAY_DB;
    gridGraphics
      .moveTo(KEY_COLUMN_WIDTH_PX, y)
      .lineTo(width, y)
      .stroke({
        width: 1,
        color: volumeGridColor,
        alpha: isBaseline ? 0.32 : 0.18,
      });

    const label = volumeDbLabelTexts[index];
    if (label == undefined) {
      continue;
    }
    label.renderable = true;
    label.text = formatVolumeDbLabel(db);
    label.style = labelStyle;
    label.anchor.set(1, 0.5);
    label.x = KEY_COLUMN_WIDTH_PX - 6;
    label.y = height >= 16 ? clamp(y, 8, height - 8) : y;
  }
  for (let i = majorGridDbValues.length; i < volumeDbLabelTexts.length; i++) {
    volumeDbLabelTexts[i].renderable = false;
  }

  for (const pattern of gridPatterns.value) {
    const measuresInPattern = Math.round(pattern.width / pattern.patternWidth);
    for (let m = 0; m <= measuresInPattern; m++) {
      const measureX =
        pattern.x +
        pattern.patternWidth * m -
        props.offsetX +
        KEY_COLUMN_WIDTH_PX;
      if (measureX < -1 || measureX > width + 1) {
        continue;
      }
      gridGraphics
        .moveTo(measureX, 0)
        .lineTo(measureX, height)
        .stroke({ width: 1, color: measureColor, alpha: 1 });

      if (m === measuresInPattern) {
        continue;
      }
      for (let b = 1; b < pattern.beatsPerMeasure; b++) {
        const beatX = measureX + pattern.beatWidth * b;
        if (beatX < -1 || beatX > width + 1) {
          continue;
        }
        gridGraphics
          .moveTo(beatX, 0)
          .lineTo(beatX, height)
          .stroke({ width: 1, color: beatColor, alpha: 1 });
      }
    }
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
    zoomX: sequencerZoomX.value,
    offsetX: props.offsetX,
    leftPadding: KEY_COLUMN_WIDTH_PX,
  };

  // 編集不可区間のオーバーレイ
  if (disabledOverlayGraphics) {
    disabledOverlayGraphics.clear();
    const overlayAlpha = 0;
    const frameRate = editorFrameRate.value;
    if (frameRate > 0) {
      let cursor = 0;
      for (const range of editableFrameRanges.value) {
        if (cursor < range.startFrame) {
          const startX = frameToScreenX(cursor, frameRate);
          const endX = frameToScreenX(range.startFrame, frameRate);
          const clampedStart = Math.max(0, startX);
          const clampedEnd = Math.min(viewInfo.viewportWidth, endX);
          if (clampedEnd > clampedStart) {
            disabledOverlayGraphics
              .rect(
                clampedStart,
                0,
                clampedEnd - clampedStart,
                viewInfo.viewportHeight,
              )
              .fill({ color: 0x000000, alpha: overlayAlpha });
          }
        }
        cursor = Math.max(cursor, range.endFrame);
      }
      // 最後の editable range 以降
      const trailingStartX =
        editableFrameRanges.value.length > 0
          ? frameToScreenX(cursor, frameRate)
          : 0;
      if (trailingStartX < viewInfo.viewportWidth) {
        const clampedStart = Math.max(0, trailingStartX);
        disabledOverlayGraphics
          .rect(
            clampedStart,
            0,
            viewInfo.viewportWidth - clampedStart,
            viewInfo.viewportHeight,
          )
          .fill({ color: 0x000000, alpha: overlayAlpha });
      }
    }
  }

  updateGrid();

  // 削除中のプレビューオーバーレイ(半透明)
  if (erasePreviewOverlay) {
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
          .fill({ color: 0x000000, alpha: 0.12 });
      }
    }
  }

  originalVolumeLine.color = originalVolumeLineColor.value;
  originalVolumeLine.showArea = false;
  editedVolumeLine.color = editedVolumeLineColor.value;
  editedVolumeLine.showArea = props.valueMode === "absolute";

  originalVolumeLine.update(volumeOriginalSegmentsData, viewInfo);
  editedVolumeLine.update(volumeEffectiveSegmentsData, viewInfo);

  renderer.render(stage);
};

const refreshVolumeSegmentsLock = new Mutex();

const refreshOriginalVolumeSegments = () => {
  const frameRate = editorFrameRate.value;
  if (frameRate <= 0) {
    return;
  }
  const trackId = selectedTrackId.value;

  const baseFrameLength = timelineFrameLength.value;

  const originalFramewise = new Array<number>(baseFrameLength).fill(
    VALUE_INDICATING_NO_DATA,
  );

  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== trackId) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      continue;
    }
    const phraseQuery = store.state.phraseQueries.get(phrase.queryKey);
    // NOTE: ノート追加直後など、phraseとphraseQueryの更新が段階的に入る場合がある。
    // 未確定なphraseだけをスキップし、確定済みの範囲から順次表示を更新する。
    if (phraseQuery?.volume == undefined) {
      continue;
    }
    if (phraseQuery.frameRate !== frameRate) {
      throw new Error(
        `Frame rate mismatch: expected ${frameRate}, got ${phraseQuery.frameRate}. queryKey: ${phrase.queryKey}`,
      );
    }

    const startFrame = Math.round(phrase.startTime * frameRate);
    const endFrame = startFrame + phraseQuery.volume.length;
    if (originalFramewise.length < endFrame) {
      originalFramewise.push(
        ...new Array(endFrame - originalFramewise.length).fill(
          VALUE_INDICATING_NO_DATA,
        ),
      );
    }
    for (const [i, value] of phraseQuery.volume.entries()) {
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
  volumeOriginalSegmentsData =
    props.valueMode === "relative"
      ? buildRelativeBaselineSegments(maskedOriginal, frameRate)
      : buildSegments(maskedOriginal, frameRate);
  renderInNextFrame = true;
};

const refreshEditableFrameRanges = () => {
  const frameRate = editorFrameRate.value;
  if (frameRate <= 0) {
    editableFrameRanges.value = [];
    return;
  }

  const ranges: VolumeEditableFrameRange[] = [];
  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      continue;
    }
    const phraseQuery = store.state.phraseQueries.get(phrase.queryKey);
    if (phraseQuery?.volume == undefined) {
      continue;
    }
    if (phraseQuery.frameRate !== frameRate) {
      throw new Error(
        `Frame rate mismatch: expected ${frameRate}, got ${phraseQuery.frameRate}. queryKey: ${phrase.queryKey}`,
      );
    }
    const phraseStartFrame = Math.round(phrase.startTime * frameRate);
    const phraseEndFrame = phraseStartFrame + phraseQuery.volume.length;
    const startOffset = phrase.minNonPauseStartFrame ?? 0;
    const endOffset = phrase.maxNonPauseEndFrame ?? phraseQuery.volume.length;
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
  if (frameRate <= 0) {
    return;
  }

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

  const baseEditData = selectedTrack.value?.volumeEditData ?? [];
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
        editFramewise[startFrame + i] = Math.max(rawValue, 0);
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
      effectiveFramewise[i] = Math.max(edited, 0);
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

  volumeEffectiveSegmentsData =
    props.valueMode === "relative"
      ? buildRelativeSegments(maskedEffective, originalFramewise, frameRate)
      : buildSegments(maskedEffective, frameRate);
  renderInNextFrame = true;
};

const getOriginalVolumeAtFrame = (frame: number) => {
  const originalValue =
    originalFramewiseCache.at(frame) ?? VALUE_INDICATING_NO_DATA;
  if (originalValue === VALUE_INDICATING_NO_DATA) {
    return 0;
  }
  return Math.max(originalValue, 0);
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
  updateVolumeValueTooltip(pointerInfo, targetArea, pointerEvent.type);
};

const computeViewportPointerInfo = (pointerEvent: PointerEvent) => {
  const rect =
    viewportRectCache ?? canvasContainer.value?.getBoundingClientRect();
  if (rect == undefined) {
    throw new Error("volume editor viewport element is null.");
  }
  const localX = pointerEvent.clientX - rect.left;
  const localY = pointerEvent.clientY - rect.top;
  const width = rect.width || 1;
  const height = rect.height || 1;
  const clampedX = clamp(localX, 0, width);
  const clampedY = clamp(localY, 0, height);

  const timelineX = props.offsetX + clampedX - KEY_COLUMN_WIDTH_PX;
  const baseX = Math.max(0, timelineX) / sequencerZoomX.value;
  const ticks = baseXToTick(baseX, tpqn.value);
  const seconds = tickToSecond(ticks, tempos.value, tpqn.value);
  const frame = Math.max(0, Math.round(seconds * editorFrameRate.value));

  const normalizedY = 1 - clampedY / height;
  let linearValue: number;
  let relativeDb: number | undefined;
  let db: number;
  if (props.valueMode === "relative") {
    relativeDb = normalizedYToRelativeDb(normalizedY);
    db = relativeDb;
    linearValue = getOriginalVolumeAtFrame(frame) * decibelToLinear(relativeDb);
  } else {
    db = normalizedYToDb(clamp(normalizedY, 0, 1));
    linearValue = Math.min(decibelToLinear(db), 1);
  }

  return {
    position: {
      frame,
      value: linearValue,
      relativeDb,
    },
    db,
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
    () => store.state.sequencerZoomX,
    () => props.offsetX,
    () => props.valueMode,
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
    phraseQuerySignature,
    selectedTrackId,
    tempos,
    timeSignatures,
    tpqn,
    numMeasures,
    editorFrameRate,
    () => props.valueMode,
  ],
  async ([isMounted]) => {
    try {
      await using _lock = await refreshVolumeSegmentsLock.acquire();
      if (isMounted) {
        refreshEditableFrameRanges();
        refreshOriginalVolumeSegments();
        refreshEffectiveVolumeSegments();
      }
    } catch (e) {
      warn("Failed to refresh original volume segments.", e);
    }
  },
);

watch(
  [
    selectedTrackId,
    () => selectedTrack.value?.volumeEditData,
    volumePreviewEdit,
    () => props.valueMode,
  ],
  async () => {
    try {
      await using _lock = await refreshVolumeSegmentsLock.acquire();
      refreshEffectiveVolumeSegments();
    } catch (e) {
      warn("Failed to refresh effective volume segments.", e);
    }
  },
);

onMounted(async () => {
  const containerEl = canvasContainer.value;
  const canvasEl = canvas.value;
  if (!containerEl || !canvasEl) {
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
  disabledOverlayGraphics = new PIXI.Graphics();
  erasePreviewOverlay = new PIXI.Graphics();
  gridGraphics = new PIXI.Graphics();
  volumeDbLabelBackground = new PIXI.Graphics();
  volumeDbLabelContainer = new PIXI.Container();
  const fontFamily = window.getComputedStyle(containerEl).fontFamily;
  volumeDbLabelTextStyles = {
    light: new PIXI.TextStyle({
      fill: "#626a64",
      fontFamily,
      fontSize: 10,
    }),
    dark: new PIXI.TextStyle({
      fill: "#b9b5b6",
      fontFamily,
      fontSize: 10,
    }),
  };
  volumeDbLabelTexts.length = 0;
  for (const db of absoluteVolumeMajorGridDbValues) {
    const text = new PIXI.Text({
      text: formatVolumeDbLabel(db),
      style: isDark.value
        ? volumeDbLabelTextStyles.dark
        : volumeDbLabelTextStyles.light,
    });
    volumeDbLabelContainer.addChild(text);
    volumeDbLabelTexts.push(text);
  }
  originalVolumeLine = new VolumeLine({
    color: originalVolumeLineColor.value,
    width: 1,
    dashed: true,
    isVisible: true,
  });
  editedVolumeLine = new VolumeLine({
    color: editedVolumeLineColor.value,
    width: 1.5,
    showArea: true,
    areaAlpha: 0.1,
    isVisible: true,
  });

  stage.addChild(disabledOverlayGraphics); // 編集不可区間（最背面）
  stage.addChild(erasePreviewOverlay); // 下地
  stage.addChild(gridGraphics); // グリッドはオーバーレイの上に
  stage.addChild(originalVolumeLine.container);
  stage.addChild(editedVolumeLine.container);
  stage.addChild(volumeDbLabelBackground); // dBラベルの固定背景
  stage.addChild(volumeDbLabelContainer);

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
  volumeDbLabelBackground?.destroy();
  volumeDbLabelContainer?.destroy({ children: true });
  volumeDbLabelTexts.length = 0;
  disabledOverlayGraphics?.destroy();
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

.volume-editor-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.volume-value-guide-line {
  position: absolute;
  right: 0;
  height: 0;
  border-top: 1px solid rgba(0, 167, 63, 0.45);
  transform: translateY(-0.5px);
  z-index: calc(#{vars.$z-index-sing-tool-palette} - 1);
  pointer-events: none;
}

.volume-value-tooltip {
  position: absolute;
  z-index: calc(#{vars.$z-index-sing-tool-palette} + 1);
  box-sizing: border-box;
  width: 54px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(32, 34, 32, 0.88);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 22px;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
</style>
