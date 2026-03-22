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

  const handleWheel = (event: WheelEvent) => {
    if (!(event.currentTarget instanceof HTMLElement)) {
      throw new Error("wheel event target is not HTMLElement.");
    }

    if (isWheelDisabled()) {
      event.preventDefault();
      return;
    }

    // Ctrl/Cmd + wheelでズーム処理
    if (isOnCommandOrCtrlKeyDown(event)) {
      const anchorX = Math.max(
        0,
        getXInBorderBox(event.clientX, event.currentTarget) - leftPaddingPx,
      );
      event.preventDefault();
      onZoomX(anchorX, event.deltaY);
      return;
    }

    // 横wheel(トラックパッドやマウス横スワイプ) → パンスクロール
    if (event.deltaX !== 0) {
      event.preventDefault();
      onPanX(event.deltaX);
    }

    // 縦wheelはなにもしない / 必要が出てきたら追加
  };

  return { handleWheel };
};
