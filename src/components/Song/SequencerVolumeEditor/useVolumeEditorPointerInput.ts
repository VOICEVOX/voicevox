import { onMounted, onUnmounted, ref } from "vue";
import type { Ref } from "vue";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import type { Tempo } from "@/domain/project/type";
import { tickToSecond } from "@/song/music";
import { baseXToTick, type ViewportInfo } from "@/song/viewHelper";
import type { VolumeValueScale } from "@/song/volumeValueScale";
import type { VolumeEditorPreviewMode } from "@/song/volumeEditorStateMachine/common";
import { assertNonNullable, ExhaustiveError } from "@/type/utility";

type ReadonlyRef<T> = Readonly<Pick<Ref<T>, "value">>;

/**
 * ポインタが指すフレームとdB、ボリュームエディター内の座標。
 * dbは、ボリュームエディターの縦軸の目盛りと同じ単位で表す。
 */
export type VolumeEditorPointerInfo = {
  readonly frame: number;
  readonly db: number;
  readonly x: number;
  readonly y: number;
};

/**
 * ポインタがボリュームエディターの上にあるかと、最後にポインタイベントを受けたときの位置。
 * UNKNOWNは、まだポインタイベントを1つも受けていない状態。
 * dB目盛りの列や、ツールパレットなどボリュームエディターに重なる要素の上にあるときはOUTSIDEになる。
 */
export type VolumeEditorPointerState =
  | { readonly type: "UNKNOWN" }
  | {
      readonly type: "OUTSIDE";
      readonly pointerInfo: VolumeEditorPointerInfo;
    }
  | {
      readonly type: "INSIDE";
      readonly pointerInfo: VolumeEditorPointerInfo;
    };

export type VolumeEditorPointerEvent = {
  readonly pointerEvent: PointerEvent;
  readonly targetArea: "VolumeEditorArea" | "Window";
  readonly pointerInfo: VolumeEditorPointerInfo;
};

export const useVolumeEditorPointerInput = (options: {
  canvasContainer: ReadonlyRef<HTMLElement | null>;
  previewMode: ReadonlyRef<VolumeEditorPreviewMode>;
  viewportInfo: ReadonlyRef<ViewportInfo>;
  tempos: ReadonlyRef<readonly Tempo[]>;
  tpqn: ReadonlyRef<number>;
  frameRate: ReadonlyRef<number>;
  valueScale: ReadonlyRef<VolumeValueScale>;
  onPointerEvent: (event: VolumeEditorPointerEvent) => void;
}) => {
  const { canvasContainer } = options;

  // getBoundingClientRectは呼ぶたびにブラウザのレイアウト再計算を発生させることがあり、
  // pointermoveの頻度で呼ぶとドラッグ中の描画がカクつくため、取得済みの矩形を使い回す
  let viewportRectCache:
    { left: number; top: number; width: number; height: number } | undefined;

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

    const timelineX =
      options.viewportInfo.value.offsetX -
      VOLUME_EDITOR_LAYOUT.keyColumnWidthPx +
      localX;
    const baseX = Math.max(0, timelineX) / options.viewportInfo.value.scaleX;
    const ticks = baseXToTick(baseX, options.tpqn.value);
    const seconds = tickToSecond(
      ticks,
      options.tempos.value,
      options.tpqn.value,
    );
    const frame = Math.max(0, Math.round(seconds * options.frameRate.value));

    const normalizedY = 1 - localY / rect.height;
    const db = options.valueScale.value.normalizedYToDb(normalizedY);

    return {
      frame,
      db,
      x: localX,
      y: localY,
    };
  };

  const pointerState = ref<VolumeEditorPointerState>({ type: "UNKNOWN" });

  const dispatchPointerEvent = (
    pointerEvent: PointerEvent,
    targetArea: "VolumeEditorArea" | "Window",
    pointerInfo: VolumeEditorPointerInfo,
  ) => {
    options.onPointerEvent({ pointerEvent, targetArea, pointerInfo });
  };

  // ボリュームエディターの要素で受けたイベントでは、ステートマシンへ渡すかどうかを判定する前に
  // pointerStateを書き換える。ドラッグ中はpointerleaveをステートマシンへ渡さないが、
  // ポインタが外に出たことはpointerStateに反映する必要があるため
  const onSurfacePointerDown = (event: PointerEvent) => {
    updateViewportRectCache();
    const pointerInfo = computeViewportPointerInfo(event);
    pointerState.value = { type: "INSIDE", pointerInfo };
    if (event.button !== 0) {
      return;
    }
    dispatchPointerEvent(event, "VolumeEditorArea", pointerInfo);
  };

  const onSurfacePointerMove = (event: PointerEvent) => {
    const pointerInfo = computeViewportPointerInfo(event);
    pointerState.value = { type: "INSIDE", pointerInfo };
    if (options.previewMode.value !== "IDLE") {
      return;
    }
    dispatchPointerEvent(event, "VolumeEditorArea", pointerInfo);
  };

  const onSurfacePointerLeave = (event: PointerEvent) => {
    const pointerInfo = computeViewportPointerInfo(event);
    pointerState.value = { type: "OUTSIDE", pointerInfo };
    if (options.previewMode.value === "IDLE") {
      dispatchPointerEvent(event, "VolumeEditorArea", pointerInfo);
    }
  };

  // ドラッグを終える受け渡しは、同じpointerupを受けたwindowのリスナーが行う
  const onSurfacePointerUp = (event: PointerEvent) => {
    const pointerInfo = computeViewportPointerInfo(event);
    pointerState.value = { type: "INSIDE", pointerInfo };
  };

  // windowで受けたイベントからは、ボリュームエディターの上にあるかは分からない。
  // ボリュームエディターの上で起きたイベントはwindowより先に受けるので、
  // その時点でINSIDEになっていなければ外にある
  const dispatchWindowPointerEvent = (event: PointerEvent) => {
    const pointerInfo = computeViewportPointerInfo(event);
    const currentState = pointerState.value;
    switch (currentState.type) {
      case "UNKNOWN":
      case "OUTSIDE":
        pointerState.value = { type: "OUTSIDE", pointerInfo };
        break;
      case "INSIDE":
        pointerState.value = { type: "INSIDE", pointerInfo };
        break;
      default:
        throw new ExhaustiveError(currentState);
    }
    dispatchPointerEvent(event, "Window", pointerInfo);
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchWindowPointerEvent(event);
    }
  };

  const onWindowPointerUp = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchWindowPointerEvent(event);
    }
  };

  const onWindowPointerCancel = (event: PointerEvent) => {
    if (options.previewMode.value !== "IDLE") {
      dispatchWindowPointerEvent(event);
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
    pointerState,
    updateViewportRectCache,
    onSurfacePointerDown,
    onSurfacePointerUp,
    onSurfacePointerMove,
    onSurfacePointerLeave,
  };
};
