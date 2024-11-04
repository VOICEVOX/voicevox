import { computed, ref } from "vue";
import {
  CursorState,
  EditMode,
  NoteEditMode,
  PitchEditMode,
} from "@/type/preload";

// ノート編集モードのプリセット定義
export const NOTE_EDIT_MODES: Record<NoteEditMode["type"], NoteEditMode> = {
  SELECT_FIRST: {
    type: "SELECT_FIRST",
    cursor: CursorState.UNSET,
    behaviors: {
      shouldSelectAfterEditing: false,
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
};

export function useEditMode(props: { editTarget: "NOTE" | "PITCH" }) {
  // 編集モードの状態
  const selectedNoteEditMode = ref<"SELECT_FIRST" | "EDIT_FIRST">("EDIT_FIRST");
  const selectedPitchEditMode = ref<"DRAW" | "ERASE">("DRAW");
  const isPreviewMode = ref(false);

  // 現在のモード
  const currentMode = computed<EditMode>(() => {
    if (props.editTarget === "NOTE") {
      return {
        target: "NOTE",
        mode: NOTE_EDIT_MODES[selectedNoteEditMode.value],
      };
    } else {
      return {
        target: "PITCH",
        mode: PITCH_EDIT_MODES[selectedPitchEditMode.value],
      };
    }
  });

  // ノート編集の振る舞い判定
  const shouldSelectNoteAfterEditing = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldSelectAfterEditing,
  );

  const shouldAddNoteOnClick = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldAddNoteOnClick,
  );

  const shouldAddNoteOnDoubleClick = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldAddNoteOnDoubleClick,
  );

  const shouldDeselectAllOnClick = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldDeselectAllOnClick,
  );

  const shouldRectSelectOnDrag = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldRectSelectOnDrag,
  );

  const shouldDeselectAllOnCtrlOrCommandClick = computed(
    () =>
      currentMode.value.target === "NOTE" &&
      currentMode.value.mode.behaviors.shouldDeselectAllOnCtrlOrCommandClick,
  );

  // ピッチ編集の操作判定
  const shouldDrawPitch = computed(
    () =>
      props.editTarget === "PITCH" && currentMode.value.mode.type === "DRAW",
  );

  const shouldErasePitch = computed(
    () =>
      props.editTarget === "PITCH" && currentMode.value.mode.type === "ERASE",
  );

  // 編集モードの設定
  const setNoteEditMode = (mode: "SELECT_FIRST" | "EDIT_FIRST") => {
    selectedNoteEditMode.value = mode;
  };

  const setPitchEditMode = (mode: "DRAW" | "ERASE") => {
    selectedPitchEditMode.value = mode;
  };

  // プレビューモードの設定
  const setPreviewMode = (isPreviewing: boolean) => {
    isPreviewMode.value = isPreviewing;
  };

  return {
    selectedNoteEditMode,
    selectedPitchEditMode,
    currentMode,
    isPreviewMode,

    setNoteEditMode,
    setPitchEditMode,
    setPreviewMode,

    shouldSelectNoteAfterEditing,
    shouldAddNoteOnClick,
    shouldAddNoteOnDoubleClick,
    shouldDeselectAllOnClick,
    shouldRectSelectOnDrag,
    shouldDeselectAllOnCtrlOrCommandClick,

    shouldDrawPitch,
    shouldErasePitch,
  };
}
