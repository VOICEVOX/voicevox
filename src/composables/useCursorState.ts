import { computed, watch, Ref } from "vue";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";
import { PreviewMode, CursorState } from "@/sing/viewHelper";

// カーソル状態の外部コンテキスト
export interface CursorStateContext {
  readonly ctrlKey: Ref<boolean>;
  readonly shiftKey: Ref<boolean>;
  readonly nowPreviewing: Ref<boolean>;
  readonly editTarget: Ref<SequencerEditTarget>;
  readonly selectedNoteTool: Ref<NoteEditTool>;
  readonly selectedPitchTool: Ref<PitchEditTool>;
  readonly previewMode: Ref<PreviewMode>;
}

export function useCursorState(cursorStateContext: CursorStateContext) {
  const {
    ctrlKey,
    shiftKey,
    nowPreviewing,
    editTarget,
    selectedNoteTool,
    selectedPitchTool,
    previewMode,
  } = cursorStateContext;

  // カーソルの状態
  const cursorState: Ref<CursorState> = computed(() => resolveCursorBehavior());

  /**
   * カーソルの状態を関連するコンテキストから取得する
   */
  const resolveCursorBehavior = (): CursorState => {
    // プレビューの場合
    if (nowPreviewing.value && previewMode.value !== "IDLE") {
      switch (previewMode.value) {
        case "ADD_NOTE":
          return "DRAW";
        case "MOVE_NOTE":
          return "MOVE";
        case "RESIZE_NOTE_RIGHT":
        case "RESIZE_NOTE_LEFT":
          return "EW_RESIZE";
        case "DRAW_PITCH":
          return "DRAW";
        case "ERASE_PITCH":
          return "ERASE";
        default:
          return "UNSET";
      }
    }

    // ノート編集の場合
    if (editTarget.value === "NOTE") {
      // シフトキーが押されていたら常に十字カーソル
      if (shiftKey.value) {
        return "CROSSHAIR";
      }
      // ノート編集ツールが選択されていたら描画カーソル
      if (selectedNoteTool.value === "EDIT_FIRST") {
        return "DRAW";
      }
      // それ以外は未設定
      return "UNSET";
    }

    // ピッチ編集の場合
    if (editTarget.value === "PITCH") {
      // Ctrlキーが押されていたもしくは削除ツールが選択されていたら消しゴムカーソル
      if (ctrlKey.value || selectedPitchTool.value === "ERASE") {
        return "ERASE";
      }

      // 描画ツールが選択されていたら描画カーソル
      if (selectedPitchTool.value === "DRAW") {
        return "DRAW";
      }
    }
    return "UNSET";
  };

  // カーソル用のCSSクラス名ヘルパー
  const cursorClass = computed(() => {
    switch (cursorState.value) {
      case "EW_RESIZE":
        return "cursor-ew-resize";
      case "CROSSHAIR":
        return "cursor-crosshair";
      case "MOVE":
        return "cursor-move";
      case "DRAW":
        return "cursor-draw";
      case "ERASE":
        return "cursor-erase";
      default:
        return "";
    }
  });

  // カーソルに関連するコンテキストが更新されたらカーソルの状態を変更
  watch(
    [
      ctrlKey,
      shiftKey,
      nowPreviewing,
      editTarget,
      selectedNoteTool,
      selectedPitchTool,
      previewMode,
    ],
    () => {},
    { immediate: true },
  );

  return {
    cursorState,
    cursorClass,
    resolveCursorBehavior,
  };
}
