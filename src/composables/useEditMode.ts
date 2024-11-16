import { computed, Ref } from "vue";
import { Store } from "vuex";
import { NoteId } from "@/type/preload";
import {
  State,
  NoteEditTool,
  PitchEditTool,
  SequencerEditTarget,
} from "@/store/type";
import { MouseButton } from "@/sing/viewHelper";

/*
// ノート編集モードのプリセット定義
export const NOTE_EDIT_MODES: Record<NoteEditMode["type"], NoteEditMode> = {
  SELECT_FIRST: {
    type: "SELECT_FIRST",
    cursor: CursorState.UNSET,
    behaviors: {
      shouldSelectAfterEditing: true,
      shouldAddNoteOnClick: false,
      shouldAddNoteOnDoubleClick: true,
      shouldDeselectAllOnClick: true,
      shouldRectSelectOnDrag: true,
      shouldDeselectAllOnCtrlOrCommandClick: true,
    },
  },
  EDIT_FIRST: {
    type: "EDIT_FIRST",
    cursor: CursorState.DRAW,
    behaviors: {
      shouldSelectAfterEditing: true,
      shouldAddNoteOnClick: true,
      shouldAddNoteOnDoubleClick: false,
      shouldDeselectAllOnClick: false,
      shouldRectSelectOnDrag: false,
      shouldDeselectAllOnCtrlOrCommandClick: false,
    },
  },
};

// ピッチ編集モードのプリセット定義
export const PITCH_EDIT_MODES: Record<PitchEditMode["type"], PitchEditMode> = {
  DRAW: {
    type: "DRAW",
    cursor: CursorState.DRAW,
  },
  ERASE: {
    type: "ERASE",
    cursor: CursorState.ERASE,
  },
}; */

// マウスダウン時の振る舞い
export type MouseDownBehavior =
  | "IGNORE"
  | "DESELECT_ALL"
  | "ADD_NOTE"
  | "START_RECT_SELECT"
  | "DRAW_PITCH"
  | "ERASE_PITCH";

// ダブルクリック時の振る舞い
export type MouseDoubleClickBehavior = "IGNORE" | "ADD_NOTE" | "EDIT_LYRIC";

/*
// マウスエッジ時の振る舞い
export type MouseEdgeBehavior =
  | "IGNORE"
  | "START_RESIZE_LEFT"
  | "START_RESIZE_RIGHT";

// マウスバー時の振る舞い
export type MouseBarBehavior = "IGNORE" | "START_MOVE" | "EDIT_LYRIC";
*/

export interface MouseDownContext {
  isSelfEventTarget: boolean;
  mouseButton: MouseButton;
  ctrlKey: boolean;
  shiftKey: boolean;
  editingLyricNoteId?: NoteId;
}

export interface EditModeContext {
  ctrlKey: Ref<boolean>;
  shiftKey: Ref<boolean>;
  nowPreviewing: Ref<boolean>;
}

export function useEditMode(store: Store<State>, context: EditModeContext) {
  const editTarget = computed({
    get: () => store.state.sequencerEditTarget || "NOTE",
    set: (value: SequencerEditTarget) => store.commit("SET_EDIT_TARGET", value),
  });

  const selectedNoteTool = computed({
    get: () => store.state.selectedNoteTool || "EDIT_FIRST",
    set: (value: NoteEditTool) => store.commit("SET_SELECTED_NOTE_TOOL", value),
  });

  const selectedPitchTool = computed({
    get: () => store.state.selectedPitchTool || "DRAW",
    set: (value: PitchEditTool) =>
      store.commit("SET_SELECTED_PITCH_TOOL", value),
  });

  /**
   * マウスダウン時の振る舞いを判定する
   * 条件の判定のみを行い、実際の処理は呼び出し側で行う
   */
  const resolveMouseDownBehavior = ({
    isSelfEventTarget,
    mouseButton,
    ctrlKey,
    shiftKey,
    editingLyricNoteId,
  }: MouseDownContext): MouseDownBehavior => {
    if (context.nowPreviewing.value) {
      return "IGNORE";
    }

    // ノート編集モード
    if (editTarget.value === "NOTE") {
      // 編集対象外の場合は無視
      if (!isSelfEventTarget) {
        return "IGNORE";
      }

      if (mouseButton === "LEFT_BUTTON") {
        // 歌詞編集中は無視
        if (editingLyricNoteId != undefined) {
          return "IGNORE";
        }

        // Shiftキーが押されている場合は矩形選択
        if (shiftKey) {
          return "START_RECT_SELECT";
        }

        if (selectedNoteTool.value === "SELECT_FIRST") {
          if (ctrlKey) {
            return "DESELECT_ALL";
          }
          return "START_RECT_SELECT";
        } else {
          return "ADD_NOTE";
        }
      }
      return "DESELECT_ALL";
    }

    if (editTarget.value === "PITCH") {
      if (mouseButton === "LEFT_BUTTON") {
        if (selectedPitchTool.value === "ERASE" || ctrlKey) {
          return "ERASE_PITCH";
        }
        return "DRAW_PITCH";
      }
    }

    return "IGNORE";
  };

  /**
   * ダブルクリック時の振る舞いを判定する
   */
  const resolveDoubleClickBehavior = (): MouseDoubleClickBehavior => {
    // プレビュー中は無視
    if (context.nowPreviewing.value) {
      return "IGNORE";
    }

    // 選択優先の場合はノート追加
    if (
      editTarget.value === "NOTE" &&
      selectedNoteTool.value === "SELECT_FIRST"
    ) {
      return "ADD_NOTE";
    }

    return "IGNORE";
  };

  return {
    editTarget,
    selectedNoteTool,
    selectedPitchTool,
    resolveMouseDownBehavior,
    resolveDoubleClickBehavior,
  };
}
