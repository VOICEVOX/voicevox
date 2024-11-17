import { ref } from "vue";
import { describe, it, expect } from "vitest";
import {
  useEditMode,
  EditModeState,
  EditModeContext,
} from "@/composables/useEditMode";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";
import { NoteId } from "@/type/preload";

describe("useEditMode", () => {
  // 編集モードのモックstate
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

  // コンテキストのモック
  const createMockContext = (
    overrides: Partial<EditModeContext> = {},
  ): EditModeContext => ({
    ctrlKey: ref(false),
    shiftKey: ref(false),
    nowPreviewing: ref(false),
    ...overrides,
  });

  it("プレビュー中は常にIGNOREを返す", () => {
    const { resolveMouseDownBehavior } = useEditMode(createMockState());

    const result = resolveMouseDownBehavior({
      ...createMockContext({ nowPreviewing: ref(true) }),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("IGNORE");
  });

  it("Shiftキーが押されている場合は常に矩形選択", () => {
    const { resolveMouseDownBehavior } = useEditMode(createMockState());

    const result = resolveMouseDownBehavior({
      ...createMockContext({ shiftKey: ref(true) }),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("START_RECT_SELECT");
  });

  it("ノート編集で編集優先ツールの場合、通常クリックでノート追加", () => {
    const { resolveMouseDownBehavior } = useEditMode(
      createMockState({
        editTarget: ref("NOTE"),
        selectedNoteTool: ref("EDIT_FIRST"),
      }),
    );

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("ADD_NOTE");
  });

  it("ノート編集で選択優先ツールの場合、通常クリックで矩形選択開始", () => {
    const { resolveMouseDownBehavior } = useEditMode(
      createMockState({
        editTarget: ref("NOTE"),
        selectedNoteTool: ref("SELECT_FIRST"),
      }),
    );

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("START_RECT_SELECT");
  });

  it("歌詞編集中は無視", () => {
    const { resolveMouseDownBehavior } = useEditMode(createMockState());

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
      editingLyricNoteId: NoteId("note-1"),
    });

    expect(result).toBe("IGNORE");
  });

  it("編集対象外の場合は無視", () => {
    const { resolveMouseDownBehavior } = useEditMode(createMockState());

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: false,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("IGNORE");
  });

  it("ピッチ編集モードで通常クリックでピッチ描画", () => {
    const { resolveMouseDownBehavior } = useEditMode(
      createMockState({
        editTarget: ref("PITCH"),
        selectedPitchTool: ref("DRAW"),
      }),
    );

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("DRAW_PITCH");
  });

  it("ピッチ編集モードで消しゴムツールの場合はピッチ削除", () => {
    const { resolveMouseDownBehavior } = useEditMode(
      createMockState({
        editTarget: ref("PITCH"),
        selectedPitchTool: ref("ERASE"),
      }),
    );

    const result = resolveMouseDownBehavior({
      ...createMockContext(),
      isSelfEventTarget: true,
      mouseButton: "LEFT_BUTTON",
    });

    expect(result).toBe("ERASE_PITCH");
  });

  it("ダブルクリック時、プレビュー中は常にIGNOREを返す", () => {
    const { resolveDoubleClickBehavior } = useEditMode(createMockState());

    const result = resolveDoubleClickBehavior(
      createMockContext({
        nowPreviewing: ref(true),
      }),
    );

    expect(result).toBe("IGNORE");
  });

  it("ダブルクリック時、ノート編集で選択優先ツールの場合はノート追加", () => {
    const { resolveDoubleClickBehavior } = useEditMode(
      createMockState({
        editTarget: ref("NOTE"),
        selectedNoteTool: ref("SELECT_FIRST"),
      }),
    );

    const result = resolveDoubleClickBehavior(createMockContext());

    expect(result).toBe("ADD_NOTE");
  });

  it("ダブルクリック時、その他の場合はIGNORE", () => {
    const { resolveDoubleClickBehavior } = useEditMode(
      createMockState({
        editTarget: ref("PITCH"),
      }),
    );

    const result = resolveDoubleClickBehavior(createMockContext());

    expect(result).toBe("IGNORE");
  });
});
