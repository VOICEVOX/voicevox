import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

/** 時間軸を持つビューにおける、ホイール操作の意味 */
export type TimelineWheelAction =
  | { readonly type: "none" }
  | { readonly type: "panX"; readonly deltaX: number }
  // ズーム量はホイールを縦に回した量から決まるため、deltaYを持つ
  | { readonly type: "zoomX"; readonly deltaY: number };

/**
 * ホイールイベントを、時間軸に対する操作へ読み替える。
 * 読み替えるだけなので、イベントの既定動作は止めない。
 * ズームの基準位置も算出しない。求め方がビューのレイアウトによって変わるため、
 * レイアウトを知っている呼び出し側に任せる。
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

  // Shiftを押していない縦ホイールは、ピアノロールでは音程方向のスクロールに使われる。
  // シーケンサー全体で意味を揃えるため、時間軸方向の操作には割り当てない
  return { type: "none" };
};
