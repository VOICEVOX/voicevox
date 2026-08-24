import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

/** 時間軸を持つビューにおける、ホイール操作の意味 */
export type TimelineWheelAction =
  | { readonly type: "none" }
  | { readonly type: "panX"; readonly deltaX: number }
  | { readonly type: "zoomX"; readonly deltaY: number };

/**
 * ホイールイベントを、時間軸に対する操作へ読み替える。
 * ズームの基準位置の算出と、イベントの既定動作の抑止は、
 * レイアウトと編集状態を知っている呼び出し側が行う。
 */
export const resolveTimelineWheelAction = (
  event: WheelEvent,
): TimelineWheelAction => {
  // Ctrl/Cmd + ホイールは時間軸方向のズーム
  if (isOnCommandOrCtrlKeyDown(event)) {
    return { type: "zoomX", deltaY: event.deltaY };
  }

  // 横ホイール(トラックパッドやマウス横スワイプ)は時間軸方向のパン
  if (event.deltaX !== 0) {
    return { type: "panX", deltaX: event.deltaX };
  }

  // Shift + 縦ホイールも時間軸方向のパン。
  // ブラウザは縦方向の値のまま配送し、スクロールする側がShiftを見て横に流すので、
  // 自前でスクロールさせるここでも同じようにShiftを見る
  if (event.shiftKey && event.deltaY !== 0) {
    return { type: "panX", deltaX: event.deltaY };
  }

  // Shiftを押していない縦ホイールは音程方向のスクロールに使われるものなので、
  // 時間軸方向の操作には使わない
  return { type: "none" };
};
