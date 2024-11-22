import { computed, watch, Ref } from "vue";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";
import { PreviewMode } from "@/sing/viewHelper";

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

export function useCursorState(context: CursorStateContext) {
  // カーソルの状態
  const cursorState = computed(() => {
    // カーソルの振る舞いを解決する関数を呼び出す
    return resolveCursorBehavior();
  });

  /**
   * カーソルの状態を関連するコンテキストから取得する
   */
  const resolveCursorBehavior = () => {
    // プレビューの場合
    if (context.nowPreviewing.value && context.previewMode.value !== "IDLE") {
      switch (context.previewMode.value) {
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
    if (context.editTarget.value === "NOTE") {
      // シフトキーが押されていたら常に十字カーソル
      if (context.shiftKey.value) {
        return "CROSSHAIR";
      }
      // ノート編集ツールが選択されていたら描画カーソル
      if (context.selectedNoteTool.value === "EDIT_FIRST") {
        return "DRAW";
      }
      // それ以外は未設定
      return "UNSET";
    }

    // ピッチ編集の場合
    if (context.editTarget.value === "PITCH") {
      // Ctrlキーが押されていたもしくは削除ツールが選択されていたら消しゴムカーソル
      if (
        context.ctrlKey.value ||
        context.selectedPitchTool.value === "ERASE"
      ) {
        return "ERASE";
      }

      // 描画ツールが選択されていたら描画カーソル
      if (context.selectedPitchTool.value === "DRAW") {
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
      context.ctrlKey,
      context.shiftKey,
      context.nowPreviewing,
      context.editTarget,
      context.selectedNoteTool,
      context.selectedPitchTool,
      context.previewMode,
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
