import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Ref } from "vue";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import type { Tempo } from "@/domain/project/type";
import { tickToSecond } from "@/sing/music";
import { clamp } from "@/sing/utility";
import { baseXToTick, type ViewportInfo } from "@/sing/viewHelper";
import type { VolumeEditMode } from "@/sing/volumeEditMode";
import {
  findVolumeEditableFrameRange,
  isFrameInVolumeEditableRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";
import type {
  VolumeEditorPointerInfo,
  VolumeEditorPreviewMode,
} from "@/sing/volumeEditorStateMachine/common";
import { assertNonNullable } from "@/type/utility";

type ReadonlyRef<T> = Readonly<Pick<Ref<T>, "value">>;

type VolumePointerInfo = VolumeEditorPointerInfo & {
  readonly isEditable: boolean;
};

export type VolumeEditorPointerEvent = {
  readonly pointerEvent: PointerEvent;
  readonly targetArea: "Editor" | "Window";
  readonly pointerInfo: VolumeEditorPointerInfo;
};

export const useVolumeEditorInteraction = (options: {
  previewMode: ReadonlyRef<VolumeEditorPreviewMode>;
  viewportInfo: ReadonlyRef<ViewportInfo>;
  tempos: ReadonlyRef<readonly Tempo[]>;
  tpqn: ReadonlyRef<number>;
  frameRate: ReadonlyRef<number>;
  editableFrameRanges: ReadonlyRef<readonly VolumeEditableFrameRange[]>;
  volumeEditMode: VolumeEditMode;
  onPointerEvent: (event: VolumeEditorPointerEvent) => void;
  onRenderRequested: () => void;
}) => {
  const canvasContainer = ref<HTMLElement | null>(null);
  const isPointerInParameterArea = ref(false);
  const hoverPointerInfo = ref<VolumePointerInfo>();
  const drawEditableRange = ref<VolumeEditableFrameRange>();

  let viewportRectCache:
    | { left: number; top: number; width: number; height: number }
    | undefined;

  const hideHoverFeedback = () => {
    if (hoverPointerInfo.value == undefined) {
      return;
    }
    hoverPointerInfo.value = undefined;
    options.onRenderRequested();
  };

  const hideDrawFeedback = () => {
    if (drawEditableRange.value == undefined) {
      return;
    }
    drawEditableRange.value = undefined;
    options.onRenderRequested();
  };

  const hoveredEditableRange = computed(() => {
    const pointerInfo = hoverPointerInfo.value;
    if (
      options.previewMode.value !== "IDLE" ||
      pointerInfo == undefined ||
      !pointerInfo.isEditable
    ) {
      return undefined;
    }
    return findVolumeEditableFrameRange(
      pointerInfo.position.frame,
      options.editableFrameRanges.value,
    );
  });

  const feedbackRange = computed(() =>
    options.previewMode.value === "VOLUME_DRAW"
      ? drawEditableRange.value
      : hoveredEditableRange.value,
  );

  const getViewportRect = () => {
    const rect =
      viewportRectCache ?? canvasContainer.value?.getBoundingClientRect();
    assertNonNullable(rect, "volume editor viewport element is null.");
    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error("volume editor viewport size is invalid.");
    }
    return rect;
  };

  const updateViewportRectCache = () => {
    const containerElement = canvasContainer.value;
    assertNonNullable(
      containerElement,
      "volume editor viewport element is null.",
    );
    const rect = containerElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    viewportRectCache = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const isPointerEventInParameterArea = (pointerEvent: PointerEvent) => {
    const rect = getViewportRect();
    const localX = pointerEvent.clientX - rect.left;
    const localY = pointerEvent.clientY - rect.top;
    return (
      localX >= VOLUME_EDITOR_LAYOUT.keyColumnWidthPx &&
      localX <= rect.width &&
      localY >= 0 &&
      localY <= rect.height
    );
  };

  const computeViewportPointerInfo = (
    pointerEvent: PointerEvent,
  ): VolumePointerInfo => {
    const rect = getViewportRect();
    const localX = pointerEvent.clientX - rect.left;
    const localY = pointerEvent.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const minX = Math.min(VOLUME_EDITOR_LAYOUT.keyColumnWidthPx, width);
    const clampedX = clamp(localX, minX, width);
    const clampedY = clamp(localY, 0, height);

    const timelineX =
      options.viewportInfo.value.offsetX -
      VOLUME_EDITOR_LAYOUT.keyColumnWidthPx +
      clampedX;
    const baseX = Math.max(0, timelineX) / options.viewportInfo.value.scaleX;
    const ticks = baseXToTick(baseX, options.tpqn.value);
    const seconds = tickToSecond(
      ticks,
      options.tempos.value,
      options.tpqn.value,
    );
    const frame = Math.max(0, Math.round(seconds * options.frameRate.value));

    const normalizedY = 1 - clampedY / height;
    const db = options.volumeEditMode.valueScale.normalizedYToDb(normalizedY);
    const value = options.volumeEditMode.toStoredValue(db);

    return {
      position: { frame, value },
      db,
      isEditable: isFrameInVolumeEditableRange(
        frame,
        options.editableFrameRanges.value,
      ),
      isInParameterArea: isPointerInParameterArea.value,
      x: clampedX,
      y: clampedY,
    };
  };

  const captureDrawFeedbackStart = (
    pointerEvent: PointerEvent,
    targetArea: "Editor" | "Window",
    pointerInfo: VolumePointerInfo,
    editableRange: VolumeEditableFrameRange | undefined,
  ) => {
    if (targetArea !== "Editor" || pointerEvent.type !== "pointerdown") {
      return;
    }
    if (!pointerInfo.isInParameterArea || editableRange == undefined) {
      hideDrawFeedback();
      return;
    }
    // Containerでの状態遷移がpropsへ反映される前に、pointerdown時点の情報を保持する。
    // previewModeがVOLUME_DRAWになった次の描画から、この範囲がフィードバック線に使われる。
    drawEditableRange.value = editableRange;
    options.onRenderRequested();
  };

  const updateDrawFeedbackRange = (
    pointerEvent: PointerEvent,
    editableRange: VolumeEditableFrameRange | undefined,
  ) => {
    if (
      options.previewMode.value !== "VOLUME_DRAW" ||
      pointerEvent.type !== "pointermove"
    ) {
      return;
    }
    const currentRange = drawEditableRange.value;
    if (
      currentRange?.startFrame === editableRange?.startFrame &&
      currentRange?.endFrame === editableRange?.endFrame
    ) {
      return;
    }
    // Shift制約の基準点は維持し、色を重ねる範囲だけ現在の編集位置へ追随させる。
    drawEditableRange.value = editableRange;
    options.onRenderRequested();
  };

  const updateHoverFeedback = (
    pointerInfo: VolumePointerInfo,
    targetArea: "Editor" | "Window",
  ) => {
    if (
      targetArea !== "Editor" ||
      options.previewMode.value !== "IDLE" ||
      !isPointerInParameterArea.value ||
      !pointerInfo.isEditable
    ) {
      hideHoverFeedback();
      return;
    }
    hoverPointerInfo.value = pointerInfo;
    options.onRenderRequested();
  };

  const dispatchPointerEvent = (
    pointerEvent: PointerEvent,
    targetArea: "Editor" | "Window",
  ) => {
    const pointerInfo = computeViewportPointerInfo(pointerEvent);
    const editableRange = findVolumeEditableFrameRange(
      pointerInfo.position.frame,
      options.editableFrameRanges.value,
    );
    captureDrawFeedbackStart(
      pointerEvent,
      targetArea,
      pointerInfo,
      editableRange,
    );
    updateDrawFeedbackRange(pointerEvent, editableRange);
    options.onPointerEvent({ pointerEvent, targetArea, pointerInfo });
    updateHoverFeedback(pointerInfo, targetArea);
  };

  const hidePointerFeedback = () => {
    isPointerInParameterArea.value = false;
    hideHoverFeedback();
    hideDrawFeedback();
  };

  const onSurfacePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    updateViewportRectCache();
    isPointerInParameterArea.value = isPointerEventInParameterArea(event);
    if (!isPointerInParameterArea.value) {
      hidePointerFeedback();
    }
    dispatchPointerEvent(event, "Editor");
  };

  const onSurfacePointerMove = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      return;
    }
    isPointerInParameterArea.value = isPointerEventInParameterArea(event);
    if (!isPointerInParameterArea.value) {
      hidePointerFeedback();
    }
    dispatchPointerEvent(event, "Editor");
  };

  const onSurfacePointerLeave = (event: PointerEvent) => {
    isPointerInParameterArea.value = false;
    if (options.previewMode.value === "IDLE") {
      dispatchPointerEvent(event, "Editor");
    }
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchPointerEvent(event, "Window");
    }
  };

  const onWindowPointerUp = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchPointerEvent(event, "Window");
    }
  };

  const onWindowPointerCancel = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchPointerEvent(event, "Window");
    }
  };

  watch(
    () => options.previewMode.value,
    (mode) => {
      if (mode !== "IDLE") {
        hideHoverFeedback();
      }
      if (mode !== "VOLUME_DRAW") {
        hideDrawFeedback();
      }
    },
  );

  onMounted(() => {
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);
  });

  onUnmounted(() => {
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
  });

  return {
    canvasContainer,
    feedbackRange,
    updateViewportRectCache,
    onSurfacePointerDown,
    onSurfacePointerMove,
    onSurfacePointerLeave,
  };
};
