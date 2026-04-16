<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @pointerdown="onSurfacePointerDown"
  >
    <canvas ref="canvas" class="volume-editor-canvas"></canvas>
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
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";

const props = defineProps<{
  offsetX: number;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
}>();

// NOTE: 最大値・最小値はエンジン出力と表示に合わせたヒューリスティックなもの
// エディタ側の表示や編集の問題ではないためエンジンが変わったら変更可能だが、既存のプロジェクトで表示が変わる点には注意
// 最大値: 0dB相当でのエンジン出力品質があまりよくなさそうなため、-0.5dB相当に設定
// 最小値: -36dB程度以下はエンジンの出力がノイズっぽいのと、オリジナルボリューム(エンジン出力デフォルト)の典型的な範囲で見やすい程度の高さにするため
const MIN_DISPLAY_DB = -36.5;
const MAX_DISPLAY_DB = -0.5;
const KEY_COLUMN_WIDTH_PX = 48; // ScoreSequencerの左側キー領域と合わせる

const { warn } = createLogger("SequencerVolumeEditor");
const store = useStore();
const { volumePreviewEdit, stateMachineProcess, previewMode, cursorState } =
  useVolumeEditorStateMachine(store);

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

// Mapの中身更新も検知するためのシグネチャ
const phraseSignature = computed(() =>
  [...store.state.phrases.values()].map(
    (phrase) => `${phrase.trackId}:${phrase.startTime}:${phrase.notes.length}`,
  ),
);
const phraseQuerySignature = computed(() =>
  [...store.state.phraseQueries.entries()].map(([key, query]) => {
    const volumeLen = query?.volume?.length ?? 0;
    const frameRate = query?.frameRate ?? 0;
    return `${key}:${volumeLen}:${frameRate}`;
  }),
);

const originalVolumeLineColorLight = new Color(156, 158, 156, 255);
const originalVolumeLineColorDark = new Color(114, 116, 114, 255);
const editedVolumeLineColorLight = new Color(0, 167, 63, 255);
const editedVolumeLineColorDark = new Color(95, 188, 117, 255);

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
    default:
      return "cursor-crosshair";
  }
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
const previewEraseRange = ref<{ startBaseX: number; endBaseX: number } | null>(
  null,
);

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

const frameToBaseX = (frame: number, frameRate: number) => {
  const seconds = frame / frameRate;
  const rawTempos = toRaw(tempos.value);
  const ticks = secondToTick(seconds, rawTempos, tpqn.value);
  return tickToBaseX(ticks, tpqn.value);
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

const updateGrid = () => {
  assertNonNullable(gridGraphics);
  assertNonNullable(viewportHeight.value);
  assertNonNullable(viewportWidth.value);
  gridGraphics.clear();
  const height = viewportHeight.value;
  const width = viewportWidth.value;
  const beatColor = isDark.value ? 0x4a4a4a : 0xc4c4c4;
  const measureColor = isDark.value ? 0x6b6b6b : 0x8a8a8a;

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
        .stroke({ width: 1, color: measureColor, alpha: 0.35 });

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
          .stroke({ width: 1, color: beatColor, alpha: 0.22 });
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

  updateGrid();

  // 削除中のプレビューオーバーレイ(半透明)
  if (erasePreviewOverlay) {
    erasePreviewOverlay.clear();
    const range = previewEraseRange.value;
    if (range && range.endBaseX > range.startBaseX) {
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
  editedVolumeLine.color = editedVolumeLineColor.value;

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

  const totalTicks = getTotalTicks(
    timeSignatures.value,
    numMeasures.value,
    tpqn.value,
  );
  const totalSeconds = tickToSecond(totalTicks, tempos.value, tpqn.value);
  const baseFrameLength = Math.max(Math.round(totalSeconds * frameRate), 1);

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
  volumeOriginalSegmentsData = buildSegments(originalFramewise, frameRate);
  renderInNextFrame = true;
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
      for (const [i, rawValue] of preview.data.entries()) {
        const value = Math.min(Math.max(rawValue, 0), 1);
        editFramewise[startFrame + i] = value;
      }
      maxFrame = Math.max(maxFrame, endFrame);
      previewEraseRange.value = null;
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
      editFramewise.fill(VALUE_INDICATING_NO_DATA, start, end);
      maxFrame = Math.max(maxFrame, end);
      const startBaseX = frameToBaseX(start, frameRate);
      const endBaseX = frameToBaseX(end, frameRate);
      previewEraseRange.value = { startBaseX, endBaseX };
    }
  }
  if (preview == undefined) {
    previewEraseRange.value = null;
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

  volumeEffectiveSegmentsData = buildSegments(effectiveFramewise, frameRate);
  renderInNextFrame = true;
};

const dispatchVolumeEditorEvent = (
  pointerEvent: PointerEvent,
  targetArea: "Editor" | "Window",
) => {
  const position = computeViewportPosition(pointerEvent);
  stateMachineProcess({
    type: "pointerEvent",
    targetArea,
    pointerEvent,
    position,
  });
};

const computeViewportPosition = (pointerEvent: PointerEvent) => {
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
  const db = normalizedYToDb(clamp(normalizedY, 0, 1));
  const linearValue = Math.min(decibelToLinear(db), 1);

  return {
    frame,
    value: linearValue,
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
  ],
  async ([isMounted]) => {
    try {
      await using _lock = await refreshVolumeSegmentsLock.acquire();
      if (isMounted) {
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
  erasePreviewOverlay = new PIXI.Graphics();
  gridGraphics = new PIXI.Graphics();
  originalVolumeLine = new VolumeLine({
    color: originalVolumeLineColor.value,
    width: 1.25,
    dashed: true,
    isVisible: true,
  });
  editedVolumeLine = new VolumeLine({
    color: editedVolumeLineColor.value,
    width: 2.25,
    showArea: true,
    areaAlpha: 0.2,
    isVisible: true,
  });

  stage.addChild(erasePreviewOverlay); // 下地
  stage.addChild(gridGraphics); // グリッドはオーバーレイの上に
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
      render();
      renderInNextFrame = false;
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
</style>
