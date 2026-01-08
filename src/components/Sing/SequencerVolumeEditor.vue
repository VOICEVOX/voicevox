<template>
  <div
    ref="canvasContainer"
    class="volume-editor"
    :class="cursorClass"
    @mousedown="onSurfaceMouseDown"
    @mousemove="onSurfaceMouseMove"
    @mouseleave="onSurfaceMouseLeave"
    @contextmenu.prevent="onContextMenu"
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
  ref,
  toRef,
  watch,
} from "vue";
import * as PIXI from "pixi.js";
import AsyncLock from "async-lock";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Container.vue";
import { useStore } from "@/store";
import { useParameterPanelStateMachine } from "@/composables/useParameterPanelStateMachine";
import { useAutoScrollOnEdge } from "@/composables/useAutoScrollOnEdge";
import { useMounted } from "@/composables/useMounted";
import {
  VALUE_INDICATING_NO_DATA,
  decibelToLinear,
  linearToDecibel,
  secondToTick,
  tickToSecond,
} from "@/sing/domain";
import { getTotalTicks } from "@/sing/rulerHelper";
import { clamp } from "@/sing/utility";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import {
  numMeasuresInjectionKey,
  sequencerBodyInjectionKey,
} from "@/components/Sing/ScoreSequencer.vue";
import { VolumeLine, VolumeSegment } from "@/sing/graphics/volumeLine";
import { Color } from "@/sing/graphics/lineStrip";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";

const props = defineProps<{
  offsetX: number;
}>();

const MIN_DISPLAY_DB = -25;
const MAX_DISPLAY_DB = -1;
const KEY_COLUMN_WIDTH_PX = 48; // ScoreSequencerの左側キー領域と合わせる

const store = useStore();
const {
  volumePreviewEdit,
  volumeStateMachineProcess,
  volumePreviewMode,
  volumeCursorState,
} = useParameterPanelStateMachine({
  state: {
    get tpqn() {
      return store.state.tpqn;
    },
    get tempos() {
      return store.state.tempos;
    },
    get sequencerZoomX() {
      return store.state.sequencerZoomX;
    },
    get sequencerZoomY() {
      return store.state.sequencerZoomY;
    },
    get sequencerVolumeTool() {
      return store.state.sequencerVolumeTool;
    },
    get parameterPanelEditTarget() {
      return store.state.parameterPanelEditTarget;
    },
    get nowPlaying() {
      return store.state.nowPlaying;
    },
  },
  getters: {
    get SELECTED_TRACK_ID() {
      return store.getters.SELECTED_TRACK_ID;
    },
    get PLAYHEAD_POSITION() {
      return store.getters.PLAYHEAD_POSITION;
    },
  },
  actions: {
    COMMAND_SET_VOLUME_EDIT_DATA: store.actions.COMMAND_SET_VOLUME_EDIT_DATA,
    COMMAND_ERASE_VOLUME_EDIT_DATA:
      store.actions.COMMAND_ERASE_VOLUME_EDIT_DATA,
  },
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

const sequencerBody = inject(sequencerBodyInjectionKey, null);
const enableAutoScrollOnEdge = computed(
  () => volumePreviewMode.value !== "IDLE",
);
if (sequencerBody != null) {
  useAutoScrollOnEdge(sequencerBody, enableAutoScrollOnEdge, {
    clampOutsideX: true,
    clampOutsideY: true,
  });
}

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
  switch (volumeCursorState.value) {
    case "DRAW":
      return "cursor-draw";
    case "ERASE":
      return "cursor-crosshair";
    default:
      return "cursor-crosshair";
  }
});

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref<number>();
const viewportHeight = ref<number>();
const isDragging = ref(false);

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let gridGraphics: PIXI.Graphics | undefined;
let erasePreviewOverlay: PIXI.Graphics | undefined;
let originalVolumeLine: VolumeLine | undefined;
let editedVolumeLine: VolumeLine | undefined;
let requestId: number | undefined;
let resizeObserver: ResizeObserver | undefined;
let renderInNextFrame = false;

const volumeOriginalSegments = ref<VolumeSegment[]>([]);
const volumeEffectiveSegments = ref<VolumeSegment[]>([]);
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
  const ticks = secondToTick(seconds, tempos.value, tpqn.value);
  return tickToBaseX(ticks, tpqn.value);
};

const buildSegments = (framewiseData: number[], frameRate: number) => {
  const segments: VolumeSegment[] = [];
  let current: VolumeSegment | undefined;

  for (let frame = 0; frame < framewiseData.length; frame++) {
    const value = framewiseData[frame];
    if (value == undefined || value === VALUE_INDICATING_NO_DATA) {
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
  if (
    gridGraphics == undefined ||
    viewportHeight.value == undefined ||
    viewportWidth.value == undefined
  ) {
    return;
  }
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
      gridGraphics.lineStyle(1, measureColor, 0.35);
      gridGraphics.moveTo(measureX, 0);
      gridGraphics.lineTo(measureX, height);

      if (m === measuresInPattern) {
        continue;
      }
      for (let b = 1; b < pattern.beatsPerMeasure; b++) {
        const beatX = measureX + pattern.beatWidth * b;
        if (beatX < -1 || beatX > width + 1) {
          continue;
        }
        gridGraphics.lineStyle(1, beatColor, 0.22);
        gridGraphics.moveTo(beatX, 0);
        gridGraphics.lineTo(beatX, height);
      }
    }
  }
};

const render = () => {
  if (
    renderer == undefined ||
    stage == undefined ||
    originalVolumeLine == undefined ||
    editedVolumeLine == undefined ||
    viewportWidth.value == undefined ||
    viewportHeight.value == undefined
  ) {
    return;
  }

  const viewInfo = {
    viewportWidth: viewportWidth.value,
    viewportHeight: viewportHeight.value,
    zoomX: sequencerZoomX.value,
    offsetX: props.offsetX,
    leftPadding: KEY_COLUMN_WIDTH_PX,
  };

  updateGrid();

  // erase preview overlay (full-height translucent white)
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
        erasePreviewOverlay.beginFill(0x000000, 0.12);
        erasePreviewOverlay.drawRect(
          clampedStart,
          0,
          clampedEnd - clampedStart,
          viewInfo.viewportHeight,
        );
        erasePreviewOverlay.endFill();
      }
    }
  }

  originalVolumeLine.color = originalVolumeLineColor.value;
  editedVolumeLine.color = editedVolumeLineColor.value;

  originalVolumeLine.update(volumeOriginalSegments.value, viewInfo);
  editedVolumeLine.update(volumeEffectiveSegments.value, viewInfo);

  renderer.render(stage);
};

const asyncLock = new AsyncLock({ maxPending: 1 });

const refreshVolumeSegments = async () => {
  const frameRate = editorFrameRate.value;
  if (frameRate <= 0) {
    return;
  }

  const totalTicks = getTotalTicks(
    timeSignatures.value,
    numMeasures.value,
    tpqn.value,
  );
  const totalSeconds = tickToSecond(totalTicks, tempos.value, tpqn.value);
  const baseFrameLength = Math.max(
    Math.round(totalSeconds * frameRate),
    selectedTrack.value?.volumeEditData.length ?? 0,
    1,
  );

  const originalFramewise = new Array<number>(baseFrameLength).fill(
    VALUE_INDICATING_NO_DATA,
  );
  let maxFrame = baseFrameLength;

  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      continue;
    }
    const phraseQuery = store.state.phraseQueries.get(phrase.queryKey);
    if (phraseQuery == undefined || phraseQuery.volume == undefined) {
      continue;
    }
    if (phraseQuery.frameRate !== frameRate) {
      continue;
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
    for (let i = 0; i < phraseQuery.volume.length; i++) {
      const v = Math.max(0, phraseQuery.volume[i]);
      originalFramewise[startFrame + i] = Math.min(v, 1);
    }
    maxFrame = Math.max(maxFrame, endFrame);
  }

  const baseEditData = selectedTrack.value?.volumeEditData ?? [];
  const editFramewise = new Array<number>(
    Math.max(maxFrame, baseEditData.length),
  ).fill(VALUE_INDICATING_NO_DATA);
  for (let i = 0; i < baseEditData.length; i++) {
    if (baseEditData[i] != undefined) {
      editFramewise[i] = baseEditData[i];
    }
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
      for (let i = 0; i < preview.data.length; i++) {
        const value = Math.min(Math.max(preview.data[i], 0), 1);
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
  if (originalFramewise.length < totalFrames) {
    originalFramewise.push(
      ...new Array(totalFrames - originalFramewise.length).fill(
        VALUE_INDICATING_NO_DATA,
      ),
    );
  }
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
  for (let i = 0; i < totalFrames; i++) {
    const edited = editFramewise[i];
    if (edited != undefined && edited !== VALUE_INDICATING_NO_DATA) {
      effectiveFramewise[i] = Math.min(Math.max(edited, 0), 1);
    } else {
      effectiveFramewise[i] = originalFramewise[i];
    }
  }

  volumeOriginalSegments.value = buildSegments(originalFramewise, frameRate);
  volumeEffectiveSegments.value = buildSegments(effectiveFramewise, frameRate);
  renderInNextFrame = true;
};

const dispatchVolumeEditorEvent = (
  mouseEvent: MouseEvent,
  targetArea: "Editor" | "Window",
) => {
  const position = computeViewportPosition(mouseEvent);
  volumeStateMachineProcess({
    type: "mouseEvent",
    targetArea,
    mouseEvent,
    position,
  });
};

const computeViewportPosition = (mouseEvent: MouseEvent) => {
  const viewport = canvasContainer.value;
  if (viewport == null) {
    throw new Error("volume editor viewport element is null.");
  }

  const rect = viewport.getBoundingClientRect();
  const localX = mouseEvent.clientX - rect.left;
  const localY = mouseEvent.clientY - rect.top;
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

const onSurfaceMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) {
    return;
  }
  if (store.state.parameterPanelEditTarget !== "VOLUME") {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }
  isDragging.value = true;
  dispatchVolumeEditorEvent(event, "Editor");
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("mouseup", onWindowMouseUp);
};

const onSurfaceMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Editor");
};

const onSurfaceMouseLeave = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowMouseUp = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
  isDragging.value = false;
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
};

const onContextMenu = (event: MouseEvent) => {
  contextMenu.value?.show(event);
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

watch(
  [
    mounted,
    phraseSignature,
    phraseQuerySignature,
    selectedTrackId,
    () => selectedTrack.value?.volumeEditData,
    volumePreviewEdit,
    tempos,
    timeSignatures,
    tpqn,
    numMeasures,
    editorFrameRate,
  ],
  ([isMounted]) => {
    asyncLock.acquire(
      "volume",
      async () => {
        if (isMounted) {
          await refreshVolumeSegments();
        }
      },
      () => {
        /* ignore */
      },
    );
  },
);

onMounted(() => {
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

  viewportWidth.value = containerEl.clientWidth;
  viewportHeight.value = containerEl.clientHeight;

  renderer = new PIXI.Renderer({
    view: canvasEl,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: viewportWidth.value,
    height: viewportHeight.value,
  });
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
  stage.addChild(originalVolumeLine.displayObject);
  stage.addChild(editedVolumeLine.displayObject);

  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  requestId = window.requestAnimationFrame(callback);

  resizeObserver = new ResizeObserver(() => {
    if (renderer == undefined || canvasContainer.value == undefined) {
      return;
    }
    const width = canvasContainer.value.clientWidth;
    const height = canvasContainer.value.clientHeight;
    if (width > 0 && height > 0) {
      viewportWidth.value = width;
      viewportHeight.value = height;
      renderer.resize(width, height);
      renderInNextFrame = true;
    }
  });
  resizeObserver.observe(containerEl);
});

onBeforeUnmount(() => {
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }
  originalVolumeLine?.destroy();
  editedVolumeLine?.destroy();
  gridGraphics?.destroy();
  stage?.destroy();
  renderer?.destroy(true);
  resizeObserver?.disconnect();
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
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
