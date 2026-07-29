import { onMounted, onUnmounted, ref } from "vue";
import type { Ref } from "vue";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import type { Tempo } from "@/domain/project/type";
import { tickToSecond } from "@/sing/music";
import { clamp } from "@/sing/utility";
import { baseXToTick, type ViewportInfo } from "@/sing/viewHelper";
import type { VolumeEditMode } from "@/sing/volumeEditMode";
import type {
  VolumeEditorPointerInfo,
  VolumeEditorPreviewMode,
} from "@/sing/volumeEditorStateMachine/common";
import { assertNonNullable } from "@/type/utility";

type ReadonlyRef<T> = Readonly<Pick<Ref<T>, "value">>;

export type VolumeEditorPointerEvent = {
  readonly pointerEvent: PointerEvent;
  readonly targetArea: "VolumeEditorArea" | "Window";
  readonly pointerInfo: VolumeEditorPointerInfo;
};

export const useVolumeEditorPointerInput = (options: {
  previewMode: ReadonlyRef<VolumeEditorPreviewMode>;
  viewportInfo: ReadonlyRef<ViewportInfo>;
  tempos: ReadonlyRef<readonly Tempo[]>;
  tpqn: ReadonlyRef<number>;
  frameRate: ReadonlyRef<number>;
  volumeEditMode: ReadonlyRef<VolumeEditMode>;
  onPointerEvent: (event: VolumeEditorPointerEvent) => void;
}) => {
  const canvasContainer = ref<HTMLElement | null>(null);

  let viewportRectCache:
    | { left: number; top: number; width: number; height: number }
    | undefined;

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

  const computeViewportPointerInfo = (
    pointerEvent: PointerEvent,
  ): VolumeEditorPointerInfo => {
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
    const db =
      options.volumeEditMode.value.valueScale.normalizedYToDb(normalizedY);
    const value = options.volumeEditMode.value.toStoredValue(db);

    return {
      position: { frame, value },
      db,
      x: clampedX,
      y: clampedY,
    };
  };

  const dispatchPointerEvent = (
    pointerEvent: PointerEvent,
    targetArea: "VolumeEditorArea" | "Window",
  ) => {
    const pointerInfo = computeViewportPointerInfo(pointerEvent);
    options.onPointerEvent({ pointerEvent, targetArea, pointerInfo });
  };

  const onSurfacePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    updateViewportRectCache();
    dispatchPointerEvent(event, "VolumeEditorArea");
  };

  const onSurfacePointerMove = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      return;
    }
    dispatchPointerEvent(event, "VolumeEditorArea");
  };

  const onSurfacePointerLeave = (event: PointerEvent) => {
    if (options.previewMode.value === "IDLE") {
      const pointerInfo = computeViewportPointerInfo(event);
      options.onPointerEvent({
        pointerEvent: event,
        targetArea: "VolumeEditorArea",
        pointerInfo,
      });
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
    updateViewportRectCache,
    onSurfacePointerDown,
    onSurfacePointerMove,
    onSurfacePointerLeave,
  };
};
