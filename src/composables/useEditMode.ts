import { watch, Ref } from "vue";
import { NoteId } from "@/type/preload";
import { NoteEditTool, PitchEditTool, SequencerEditTarget } from "@/store/type";
import { MouseButton } from "@/sing/viewHelper";

// マウスダウン時の振る舞い
export type MouseDownBehavior =
  | "IGNORE"
  | "DESELECT_ALL"
  | "ADD_NOTE"
  | "START_RECT_SELECT"
  | "DRAW_PITCH"
  | "ERASE_PITCH";

// ダブルクリック時の振る舞い
export type MouseDoubleClickBehavior = "IGNORE" | "ADD_NOTE";

// 編集モードの外部コンテキスト
export interface EditModeContext {
  readonly ctrlKey: Ref<boolean>;
  readonly shiftKey: Ref<boolean>;
  readonly nowPreviewing: Ref<boolean>;
  readonly editTarget: Ref<SequencerEditTarget>;
  readonly selectedNoteTool: Ref<NoteEditTool>;
  readonly selectedPitchTool: Ref<PitchEditTool>;
}

// マウスダウン時特有のコンテキスト
export interface MouseDownBehaviorContext {
  readonly isSelfEventTarget?: boolean;
  readonly mouseButton?: MouseButton;
  readonly editingLyricNoteId?: NoteId;
}

export function useEditMode(editModeContext: EditModeContext) {
  /**
   * マウスダウン時の振る舞いを判定する
   * 条件の判定のみを行い、実際の処理は呼び出し側で行う
   */
  const resolveMouseDownBehavior = (
    mouseDownContext: MouseDownBehaviorContext,
  ): MouseDownBehavior => {
    // マウスダウン時のコンテキストも使う
    const context = {
      ...editModeContext,
      ...mouseDownContext,
    };
    // プレビュー中は無視
    if (context.nowPreviewing.value) return "IGNORE";

    // ノート編集の場合
    if (context.editTarget.value === "NOTE") {
      // イベントが来ていない場合は無視
      if (!context.isSelfEventTarget) return "IGNORE";
      // 歌詞編集中は無視
      if (context.editingLyricNoteId != undefined) return "IGNORE";

      // 左クリックの場合
      if (context.mouseButton === "LEFT_BUTTON") {
        // シフトキーが押されている場合は常に矩形選択開始
        if (context.shiftKey.value) return "START_RECT_SELECT";

        // 編集優先ツールの場合
        if (context.selectedNoteTool.value === "EDIT_FIRST") {
          // コントロールキーが押されている場合は全選択解除
          if (context.ctrlKey.value) {
            return "DESELECT_ALL";
          }
          return "ADD_NOTE";
        }

        // 選択優先ツールの場合
        if (context.selectedNoteTool.value === "SELECT_FIRST") {
          // 矩形選択開始
          return "START_RECT_SELECT";
        }
      }

      return "DESELECT_ALL";
    }

    // ピッチ編集の場合
    if (context.editTarget.value === "PITCH") {
      // 左クリック以外は無視
      if (context.mouseButton !== "LEFT_BUTTON") return "IGNORE";

      // ピッチ削除ツールが選択されているかコントロールキーが押されている場合はピッチ削除
      if (
        context.selectedPitchTool.value === "ERASE" ||
        context.ctrlKey.value
      ) {
        return "ERASE_PITCH";
      }

      // それ以外はピッチ描画
      return "DRAW_PITCH";
    }

    return "IGNORE";
  };

  /**
   * ダブルクリック時の振る舞いを判定する
   */
  const resolveDoubleClickBehavior = (): MouseDoubleClickBehavior => {
    const context = {
      ...editModeContext,
    };
    // プレビュー中は無視
    if (context.nowPreviewing.value) return "IGNORE";

    // ノート編集の選択優先ツールではノート追加
    if (
      context.editTarget.value === "NOTE" &&
      context.selectedNoteTool.value === "SELECT_FIRST"
    ) {
      return "ADD_NOTE";
    }

    return "IGNORE";
  };

  // ピッチ編集モードにおいてCtrlキーが押されたときにピッチツールを消しゴムツールにする
  watch(
    [editModeContext.ctrlKey],
    () => {
      // ピッチ編集モードでない場合は無視
      if (editModeContext.editTarget.value !== "PITCH") {
        return;
      }

      // Ctrlキーが押されたとき
      if (editModeContext.ctrlKey.value) {
        // ピッチ描画ツールの場合はピッチ削除ツールに変更
        if (editModeContext.selectedPitchTool.value === "DRAW") {
          editModeContext.selectedPitchTool.value = "ERASE";
        }
      }
    },
    { immediate: true },
  );

  return {
    resolveMouseDownBehavior,
    resolveDoubleClickBehavior,
  };
}
