import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { getXInBorderBox } from "@/sing/viewHelper";

/**
 * 下パネルエディタ共通の wheel ハンドラ。
 * wheel イベントを解釈し、pan / zoom のコールバックを呼ぶ。
 * 実際のスクロール/ズーム処理は親（ScoreSequencer）が行う。
 */
export const useTimelineWheel = (options: {
  leftPaddingPx: number;
  isWheelDisabled: () => boolean;
  onPanX: (deltaX: number) => void;
  onZoomX: (anchorX: number, deltaY: number) => void;
}) => {
  const { leftPaddingPx, isWheelDisabled, onPanX, onZoomX } = options;

  type TimelineWheelAction =
    | { type: "none" }
    | { type: "panX"; deltaX: number }
    | { type: "zoomX"; anchorX: number; deltaY: number };

  const resolveTimelineWheelAction = (
    event: WheelEvent,
  ): TimelineWheelAction => {
    if (!(event.currentTarget instanceof HTMLElement)) {
      throw new Error("wheel event target is not HTMLElement.");
    }

    // Ctrl/Cmd + wheelでズーム処理
    if (isOnCommandOrCtrlKeyDown(event)) {
      const anchorX = Math.max(
        0,
        getXInBorderBox(event.clientX, event.currentTarget) - leftPaddingPx,
      );

      return {
        type: "zoomX",
        anchorX,
        deltaY: event.deltaY,
      };
    }

    // 横wheel(トラックパッドやマウス横スワイプ) → パンスクロール
    if (event.deltaX !== 0) {
      return {
        type: "panX",
        deltaX: event.deltaX,
      };
    }

    // 縦wheelも時間軸のパンに使う
    if (event.deltaY !== 0) {
      return {
        type: "panX",
        deltaX: event.deltaY,
      };
    }

    return { type: "none" };
  };

  const handleWheel = (event: WheelEvent) => {
    if (isWheelDisabled()) {
      event.preventDefault();
      return;
    }

    const action = resolveTimelineWheelAction(event);
    switch (action.type) {
      case "zoomX":
        event.preventDefault();
        onZoomX(action.anchorX, action.deltaY);
        return;
      case "panX":
        event.preventDefault();
        onPanX(action.deltaX);
        return;
      case "none":
        return;
    }
  };

  return { handleWheel };
};
