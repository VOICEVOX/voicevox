import { watch, ref, Ref } from "vue";
import { NoteId } from "@/type/preload";
import { NoteEditTool, PitchEditTool, SequencerEditTarget } from "@/store/type";
import {
  MouseButton,
  MouseDownBehavior,
  MouseDoubleClickBehavior,
} from "@/sing/viewHelper";

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
  const {
    ctrlKey,
    shiftKey,
    nowPreviewing,
    editTarget,
    selectedNoteTool,
    selectedPitchTool,
  } = editModeContext;

  /**
   * マウスダウン時の振る舞いを判定する
   * 条件の判定のみを行い、実際の処理は呼び出し側で行う
   */
  const resolveMouseDownBehavior = (
    mouseDownContext: MouseDownBehaviorContext,
  ): MouseDownBehavior => {
    const { isSelfEventTarget, mouseButton, editingLyricNoteId } =
      mouseDownContext;

    // プレビュー中は無視
    if (nowPreviewing.value) return "IGNORE";

    // ノート編集の場合
    if (editTarget.value === "NOTE") {
      // イベントが来ていない場合は無視
      if (!isSelfEventTarget) return "IGNORE";
      // 歌詞編集中は無視
      if (editingLyricNoteId != undefined) return "IGNORE";

      // 左クリックの場合
      if (mouseButton === "LEFT_BUTTON") {
        // シフトキーが押されている場合は常に矩形選択開始
        if (shiftKey.value) return "START_RECT_SELECT";

        // 編集優先ツールの場合
        if (selectedNoteTool.value === "EDIT_FIRST") {
          // コントロールキーが押されている場合は全選択解除
          if (ctrlKey.value) {
            return "DESELECT_ALL";
          }
          return "ADD_NOTE";
        }

        // 選択優先ツールの場合
        if (selectedNoteTool.value === "SELECT_FIRST") {
          // 矩形選択開始
          return "START_RECT_SELECT";
        }
      }

      return "DESELECT_ALL";
    }

    // ピッチ編集の場合
    if (editTarget.value === "PITCH") {
      // 左クリック以外は無視
      if (mouseButton !== "LEFT_BUTTON") return "IGNORE";

      // ピッチ削除ツールが選択されているかコントロールキーが押されている場合はピッチ削除
      if (selectedPitchTool.value === "ERASE" || ctrlKey.value) {
        return "ERASE_PITCH";
      }

      // それ以外はピッチ編集
      return "DRAW_PITCH";
    }

    return "IGNORE";
  };

  /**
   * ダブルクリック時の振る舞いを判定する
   */
  const resolveDoubleClickBehavior = (): MouseDoubleClickBehavior => {
    // プレビュー中は無視
    if (nowPreviewing.value) return "IGNORE";

    // ノート編集の選択優先ツールではノート追加
    if (
      editTarget.value === "NOTE" &&
      selectedNoteTool.value === "SELECT_FIRST"
    ) {
      return "ADD_NOTE";
    }

    return "IGNORE";
  };

  // Ctrlキーが押されたときにピッチツールを変更したかどうか
  const toolChangedByCtrl = ref(false);

  // ピッチ編集モードにおいてCtrlキーが押されたときにピッチツールを消しゴムツールにする
  watch(
    [ctrlKey],
    () => {
      // ピッチ編集モードでない場合は無視
      if (editTarget.value !== "PITCH") {
        return;
      }

      // 現在のツールがピッチ描画ツールの場合
      if (selectedPitchTool.value === "DRAW") {
        // Ctrlキーが押されたときはピッチ削除ツールに変更
        if (ctrlKey.value) {
          selectedPitchTool.value = "ERASE";
          toolChangedByCtrl.value = true;
        }
      }

      // 現在のツールがピッチ削除ツールかつCtrlキーが離されたとき
      if (selectedPitchTool.value === "ERASE" && toolChangedByCtrl.value) {
        // ピッチ描画ツールに戻す
        if (!ctrlKey.value) {
          selectedPitchTool.value = "DRAW";
          toolChangedByCtrl.value = false;
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
