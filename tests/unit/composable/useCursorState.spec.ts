import { ref, nextTick } from "vue";
import {
  useCursorState,
  CursorStateContext,
} from "@/composables/useCursorState";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";
import { PreviewMode } from "@/sing/viewHelper";

describe("useCursorState", () => {
  let context: CursorStateContext;

  beforeEach(() => {
    // モックコンテキスト
    context = {
      ctrlKey: ref(false),
      shiftKey: ref(false),
      nowPreviewing: ref(false),
      editTarget: ref<SequencerEditTarget>("NOTE"),
      selectedNoteTool: ref<NoteEditTool>("EDIT_FIRST"),
      selectedPitchTool: ref<PitchEditTool>("DRAW"),
      previewMode: ref<PreviewMode>("IDLE"),
    };
  });

  describe("プレビュー中の動作", () => {
    it("ノート追加の場合はDRAW", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "ADD_NOTE";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("DRAW");
    });

    it("ノート移動の場合はMOVE", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "MOVE_NOTE";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("MOVE");
    });

    it("リサイズ右の場合はEW_RESIZE", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "RESIZE_NOTE_RIGHT";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("EW_RESIZE");
    });

    it("リサイズ左の場合はEW_RESIZE", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "RESIZE_NOTE_LEFT";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("EW_RESIZE");
    });

    it("ピッチ編集の場合はDRAW", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "DRAW_PITCH";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("DRAW");
    });

    it("ピッチ削除の場合はERASE", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "ERASE_PITCH";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("ERASE");
    });

    it("その他の場合はUNSET", () => {
      context.nowPreviewing.value = true;
      context.previewMode.value = "UNKNOWN_MODE" as PreviewMode;

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("UNSET");
    });
  });

  describe("ノート編集中の動作", () => {
    beforeEach(() => {
      context.editTarget.value = "NOTE";
    });

    it("編集優先ツール選択時はDRAW", () => {
      context.selectedNoteTool.value = "EDIT_FIRST";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("DRAW");
    });

    it("編集ツール選択時でもSHIFTキー押下時はCROSSHAIR", () => {
      context.selectedNoteTool.value = "EDIT_FIRST";
      context.shiftKey.value = true;

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("CROSSHAIR");
    });

    it("他のツール選択時はUNSET", () => {
      context.selectedNoteTool.value = "UNKNOWN_TOOL" as NoteEditTool;

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("UNSET");
    });
  });

  describe("ピッチ編集中の動作", () => {
    beforeEach(() => {
      context.editTarget.value = "PITCH";
    });

    it("ピッチ編集ツール選択時はDRAW", () => {
      context.selectedPitchTool.value = "DRAW";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("DRAW");
    });

    it("ピッチ削除ツール選択時はERASE", () => {
      context.selectedPitchTool.value = "ERASE";

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("ERASE");
    });

    it("他のツール選択時はUNSET", () => {
      context.selectedPitchTool.value = "UNKNOWN_TOOL" as PitchEditTool;

      const { cursorState } = useCursorState(context);
      expect(cursorState.value).toBe("UNSET");
    });
  });

  describe("watcherの動作", () => {
    it("Shiftキー押下時はCROSSHAIR", async () => {
      const { cursorState } = useCursorState(context);

      context.shiftKey.value = true;
      await nextTick();
      expect(cursorState.value).toBe("CROSSHAIR");
    });

    it("CtrlキーとShiftキーが同時に押された場合はCROSSHAIR", async () => {
      const { cursorState } = useCursorState(context);
      context.ctrlKey.value = true;
      context.shiftKey.value = true;
      await nextTick();
      expect(cursorState.value).toBe("CROSSHAIR"); // Shift優先
    });

    it("プレビュー中のモード変更時にDRAWに更新される", async () => {
      const { cursorState } = useCursorState(context);

      context.nowPreviewing.value = true;
      context.previewMode.value = "ADD_NOTE";
      await nextTick();
      expect(cursorState.value).toBe("DRAW");
    });
  });
});
