import { ref, computed } from "vue";

// カーソル状態
export enum CursorState {
  UNSET = "unset",
  EW_RESIZE = "ew-resize",
  MOVE = "move",
  CROSSHAIR = "crosshair",
  DRAW = "draw",
  ERASE = "erase",
}

// カーソル状態を管理するカスタムコンポーザブル
export const useCursorState = () => {
  const cursorState = ref<CursorState>(CursorState.UNSET);

  const cursorClass = computed(() => {
    switch (cursorState.value) {
      case CursorState.EW_RESIZE:
        return "cursor-ew-resize";
      case CursorState.CROSSHAIR:
        return "cursor-crosshair";
      case CursorState.MOVE:
        return "cursor-move";
      case CursorState.DRAW:
        return "cursor-draw";
      case CursorState.ERASE:
        return "cursor-erase";
      default:
        return "";
    }
  });

  const setCursorState = (state: CursorState) => {
    cursorState.value = state;
  };

  const resetCursorState = () => {
    cursorState.value = CursorState.UNSET;
  };

  return {
    cursorState,
    cursorClass,
    setCursorState,
    resetCursorState,
  };
};
