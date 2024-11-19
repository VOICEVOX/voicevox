import { ref } from "vue";
import { describe, it, expect } from "vitest";
import { useEditMode, EditModeState } from "@/composables/useEditMode";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";

describe("useEditMode", () => {
  // モックステート
  const createMockState = (
    overrides: Partial<EditModeState> = {},
  ): EditModeState => {
    return {
      editTarget: ref("NOTE" as SequencerEditTarget),
      selectedNoteTool: ref("EDIT_FIRST" as NoteEditTool),
      selectedPitchTool: ref("DRAW" as PitchEditTool),
      ...overrides,
    };
  };

  // 公開メソッドをテスト
  it("初期状態ではeditTargetが'NOTE'", () => {
    const state = createMockState();
    const { editTarget } = useEditMode(state);
    expect(editTarget.value).toBe("NOTE");
  });

  it("setEditTargetが正しく更新される", () => {
    const state = createMockState();
    const { editTarget, setEditTarget } = useEditMode(state);
    setEditTarget("PITCH");
    expect(editTarget.value).toBe("PITCH");
  });

  it("editTargetの変更に応じてisNoteEditTargetが変化する", () => {
    const state = createMockState();
    const { isNoteEditTarget, setEditTarget } = useEditMode(state);
    expect(isNoteEditTarget.value).toBe(true);
    setEditTarget("PITCH");
    expect(isNoteEditTarget.value).toBe(false);
  });

  it("editTargetの変更に応じてisPitchEditTargetが変化する", () => {
    const state = createMockState();
    const { isPitchEditTarget, setEditTarget } = useEditMode(state);
    expect(isPitchEditTarget.value).toBe(false);
    setEditTarget("PITCH");
    expect(isPitchEditTarget.value).toBe(true);
  });

  it("selectedNoteToolの初期値は'EDIT_FIRST'", () => {
    const state = createMockState();
    const { selectedNoteTool } = useEditMode(state);
    expect(selectedNoteTool.value).toBe("EDIT_FIRST");
  });

  it("setSelectedNoteToolでツールが正しく更新される", () => {
    const state = createMockState();
    const { selectedNoteTool, setSelectedNoteTool } = useEditMode(state);
    setSelectedNoteTool("SELECT_FIRST");
    expect(selectedNoteTool.value).toBe("SELECT_FIRST");
  });

  it("selectedPitchToolの初期値は'DRAW'", () => {
    const state = createMockState();
    const { selectedPitchTool } = useEditMode(state);
    expect(selectedPitchTool.value).toBe("DRAW");
  });

  it("setSelectedPitchToolでツールが正しく更新される", () => {
    const state = createMockState();
    const { selectedPitchTool, setSelectedPitchTool } = useEditMode(state);
    setSelectedPitchTool("ERASE");
    expect(selectedPitchTool.value).toBe("ERASE");
  });

  it("editTargetが'NOTE'でselectedNoteToolが'SELECT_FIRST'の場合、isNoteSelectFirstToolがtrueである", () => {
    const state = createMockState({
      editTarget: ref("NOTE"),
      selectedNoteTool: ref("SELECT_FIRST"),
    });
    const { isNoteSelectFirstTool } = useEditMode(state);
    expect(isNoteSelectFirstTool.value).toBe(true);
  });

  it("editTargetが'NOTE'でselectedNoteToolが'EDIT_FIRST'の場合、isNoteEditFirstToolがtrueである", () => {
    const state = createMockState({
      editTarget: ref("NOTE"),
      selectedNoteTool: ref("EDIT_FIRST"),
    });
    const { isNoteEditFirstTool } = useEditMode(state);
    expect(isNoteEditFirstTool.value).toBe(true);
  });

  it("editTargetが'PITCH'でselectedNoteToolが'EDIT_FIRST'の場合、isNoteEditFirstToolはfalseである", () => {
    const state = createMockState({
      editTarget: ref("PITCH"),
      selectedNoteTool: ref("EDIT_FIRST"),
    });
    const { isNoteEditFirstTool } = useEditMode(state);
    expect(isNoteEditFirstTool.value).toBe(false);
  });

  it("editTargetが'PITCH'でselectedPitchToolが'DRAW'の場合、isPitchDrawToolがtrueである", () => {
    const state = createMockState({
      editTarget: ref("PITCH"),
      selectedPitchTool: ref("DRAW"),
    });
    const { isPitchDrawTool } = useEditMode(state);
    expect(isPitchDrawTool.value).toBe(true);
  });

  it("editTargetが'PITCH'でselectedPitchToolが'ERASE'の場合、isPitchEraseToolがtrueである", () => {
    const state = createMockState({
      editTarget: ref("PITCH"),
      selectedPitchTool: ref("ERASE"),
    });
    const { isPitchEraseTool } = useEditMode(state);
    expect(isPitchEraseTool.value).toBe(true);
  });

  it("editTargetが'NOTE'でselectedPitchToolが'DRAW'の場合、isPitchDrawToolはfalseである", () => {
    const state = createMockState({
      editTarget: ref("NOTE"),
      selectedPitchTool: ref("DRAW"),
    });
    const { isPitchDrawTool } = useEditMode(state);
    expect(isPitchDrawTool.value).toBe(false);
  });
});
