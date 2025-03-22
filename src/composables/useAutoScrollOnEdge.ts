import { ComputedRef, onMounted, onUnmounted, Ref, watch } from "vue";
import {
  calcMinimumDistanceVectorRectAndPoint,
  Rect,
  Vector2D,
} from "@/sing/utility";
import { getXInBorderBox, getYInBorderBox } from "@/sing/viewHelper";

export const useAutoScrollOnEdge = (
  element: Ref<HTMLElement | null>,
  enable: ComputedRef<boolean>,
) => {
  if (enable.value) {
    throw new Error("Auto-scroll should be enabled after mounting.");
  }

  const baseSpeed = 100;
  const accelerationFactor = 1.7;
  const maxSpeed = 2000;
  const threshold = 16;

  let autoScrollState:
    | {
        animationId: number;
        previousTimeStamp: number | undefined;
        cursorPos: Vector2D | undefined;
        triggerRect: Rect;
      }
    | undefined = undefined;

  const autoScrollAnimation = (timestamp: number) => {
    if (element.value == null) {
      throw new Error("element.value is null.");
    }
    if (autoScrollState == undefined) {
      throw new Error("autoScrollState is undefined.");
    }
    const previousTimeStamp = autoScrollState.previousTimeStamp ?? timestamp;

    if (autoScrollState.cursorPos != undefined) {
      // マウスカーソルがTriggerRectの外に出たらスクロールする
      const minimumDistanceVector = calcMinimumDistanceVectorRectAndPoint(
        autoScrollState.triggerRect,
        autoScrollState.cursorPos,
      );
      if (minimumDistanceVector.magnitude !== 0) {
        // NOTE: 速度の単位はpixels/s（ピクセル毎秒）
        const dt = (timestamp - previousTimeStamp) / 1000;
        const d = minimumDistanceVector.magnitude;
        const k = accelerationFactor;
        const vbase = baseSpeed;
        const vmax = maxSpeed;

        const scrollSpeed = Math.min(vbase + k * d * d, vmax);
        const scrollVector = minimumDistanceVector
          .toUnitVector()
          .scale(scrollSpeed * dt);

        element.value.scrollBy({
          top: Math.floor(scrollVector.y),
          left: Math.floor(scrollVector.x),
          behavior: "auto",
        });
      }
    }

    autoScrollState.previousTimeStamp = timestamp;
    autoScrollState.animationId = requestAnimationFrame(autoScrollAnimation);
  };

  watch(enable, (value) => {
    if (value) {
      // 自動スクロールのアニメーションループを開始する
      if (element.value == null) {
        throw new Error(
          "element.value is null. Auto-scroll should be enabled after mounting.",
        );
      }
      const elementWidth = element.value.clientWidth;
      const elementHeight = element.value.clientHeight;

      autoScrollState = {
        animationId: requestAnimationFrame(autoScrollAnimation),
        previousTimeStamp: undefined,
        cursorPos: undefined,
        triggerRect: {
          x: threshold,
          y: threshold,
          width: Math.max(elementWidth - threshold * 2, 0),
          height: Math.max(elementHeight - threshold * 2, 0),
        },
      };
    } else {
      // 自動スクロールのアニメーションループを停止する
      if (autoScrollState != undefined) {
        cancelAnimationFrame(autoScrollState.animationId);
        autoScrollState = undefined;
      }
    }
  });

  const onMouseMove = (event: MouseEvent) => {
    if (element.value == null) {
      throw new Error("element.value is null.");
    }
    if (autoScrollState != undefined) {
      autoScrollState.cursorPos = new Vector2D(
        getXInBorderBox(event.clientX, element.value),
        getYInBorderBox(event.clientY, element.value),
      );
    }
  };

  onMounted(() => {
    window.addEventListener("mousemove", onMouseMove);
  });

  onUnmounted(() => {
    window.removeEventListener("mousemove", onMouseMove);
  });
};
