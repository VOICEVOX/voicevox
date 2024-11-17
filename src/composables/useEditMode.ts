import { computed, Ref } from "vue";
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
  // オプショナル
  readonly isSelfEventTarget?: boolean;
  readonly mouseButton?: MouseButton;
  readonly editingLyricNoteId?: NoteId;
}

// 編集モードの状態
export interface EditModeState {
  readonly editTarget: Ref<SequencerEditTarget>;
  readonly selectedNoteTool: Ref<NoteEditTool>;
  readonly selectedPitchTool: Ref<PitchEditTool>;
}

export function useEditMode(state: EditModeState) {
  const isNoteEditTarget = computed(() => state.editTarget.value === "NOTE");
  const isPitchEditTarget = computed(() => state.editTarget.value === "PITCH");
  const isNoteSelectFirstTool = computed(
    () =>
      isNoteEditTarget.value && state.selectedNoteTool.value === "SELECT_FIRST",
  );
  const isNoteEditFirstTool = computed(
    () =>
      isNoteEditTarget.value && state.selectedNoteTool.value === "EDIT_FIRST",
  );
  const isPitchDrawTool = computed(
    () => isPitchEditTarget.value && state.selectedPitchTool.value === "DRAW",
  );
  const isPitchEraseTool = computed(
    () => isPitchEditTarget.value && state.selectedPitchTool.value === "ERASE",
  );

  const setEditTarget = (target: SequencerEditTarget) => {
    state.editTarget.value = target;
  };

  const setSelectedNoteTool = (tool: NoteEditTool) => {
    state.selectedNoteTool.value = tool;
  };

  const setSelectedPitchTool = (tool: PitchEditTool) => {
    state.selectedPitchTool.value = tool;
  };

  /**
   * マウスダウン時の振る舞いを判定する
   * 条件の判定のみを行い、実際の処理は呼び出し側で行う
   */
  const resolveMouseDownBehavior = (
    context: EditModeContext,
  ): MouseDownBehavior => {
    // プレビュー中は無視
    if (context.nowPreviewing.value) return "IGNORE";

    // ノート編集の場合
    if (isNoteEditTarget.value) {
      // イベントが来ていない場合は無視
      if (!context.isSelfEventTarget) return "IGNORE";
      // 歌詞編集中は無視
      if (context.editingLyricNoteId != undefined) return "IGNORE";

      // 左クリックの場合
      if (context.mouseButton === "LEFT_BUTTON") {
        // シフトキーが押されている場合は常に矩形選択開始
        if (context.shiftKey.value) return "START_RECT_SELECT";

        // 編集優先ツールの場合
        if (isNoteEditFirstTool.value) {
          // コントロールキーが押されている場合は全選択解除
          if (context.ctrlKey.value) {
            return "DESELECT_ALL";
          }
          return "ADD_NOTE";
        }

        // 選択優先ツールの場合
        if (isNoteSelectFirstTool.value) {
          // 矩形選択開始
          return "START_RECT_SELECT";
        }
      }

      return "DESELECT_ALL";
    }

    // ピッチ編集の場合
    if (isPitchEditTarget.value) {
      // 左クリック以外は無視
      if (context.mouseButton !== "LEFT_BUTTON") return "IGNORE";

      // ピッチ削除ツールが選択されているかコントロールキーが押されている場合はピッチ削除
      if (isPitchEraseTool.value || context.ctrlKey.value) {
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
  const resolveDoubleClickBehavior = (
    context: EditModeContext,
  ): MouseDoubleClickBehavior => {
    // プレビュー中は無視
    if (context.nowPreviewing.value) return "IGNORE";

    // ノート編集の選択優先ツールではノート追加
    if (isNoteEditTarget.value && isNoteSelectFirstTool.value) {
      return "ADD_NOTE";
    }

    return "IGNORE";
  };

  return {
    // 状態
    editTarget: state.editTarget,
    selectedNoteTool: state.selectedNoteTool,
    selectedPitchTool: state.selectedPitchTool,
    setEditTarget,
    setSelectedNoteTool,
    setSelectedPitchTool,
    resolveMouseDownBehavior,
    resolveDoubleClickBehavior,
    isNoteEditTarget,
    isPitchEditTarget,
    isNoteSelectFirstTool,
    isNoteEditFirstTool,
    isPitchDrawTool,
    isPitchEraseTool,
  };
}
