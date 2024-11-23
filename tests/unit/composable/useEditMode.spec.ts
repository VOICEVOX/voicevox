import { ref, nextTick } from "vue";
import {
  useEditMode,
  EditModeContext,
  MouseDownBehaviorContext,
} from "@/composables/useEditMode";
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";
import { NoteId } from "@/type/preload";

describe("useEditMode", () => {
  let context: EditModeContext;

  beforeEach(() => {
    // モックコンテキスト
    context = {
      ctrlKey: ref(false),
      shiftKey: ref(false),
      nowPreviewing: ref(false),
      editTarget: ref<SequencerEditTarget>("NOTE"),
      selectedNoteTool: ref<NoteEditTool>("EDIT_FIRST"),
      selectedPitchTool: ref<PitchEditTool>("DRAW"),
    };
  });

  // マウスダウンの振る舞い
  describe("resolveMouseDownBehavior", () => {
    let mouseDownContext: MouseDownBehaviorContext;

    beforeEach(() => {
      mouseDownContext = {
        isSelfEventTarget: true,
        mouseButton: "LEFT_BUTTON",
        editingLyricNoteId: undefined,
      } as MouseDownBehaviorContext;
    });

    describe("プレビュー中の動作", () => {
      it("モード関係なくプレビュー中は無視", () => {
        context.nowPreviewing.value = true;
        const { resolveMouseDownBehavior } = useEditMode(context);
        const behavior = resolveMouseDownBehavior(mouseDownContext);
        expect(behavior).toBe("IGNORE");
      });
    });

    describe("ノート編集モードでの動作", () => {
      beforeEach(() => {
        context.editTarget.value = "NOTE";
      });

      it("自分からイベントがきていない場合は無視", () => {
        mouseDownContext = {
          ...mouseDownContext,
          isSelfEventTarget: false,
        } as MouseDownBehaviorContext;
        const { resolveMouseDownBehavior } = useEditMode(context);
        const behavior = resolveMouseDownBehavior(mouseDownContext);
        expect(behavior).toBe("IGNORE");
      });

      it("歌詞編集中は無視", () => {
        mouseDownContext = {
          ...mouseDownContext,
          editingLyricNoteId: NoteId("some-id"),
        } as MouseDownBehaviorContext;
        const { resolveMouseDownBehavior } = useEditMode(context);
        const behavior = resolveMouseDownBehavior(mouseDownContext);
        expect(behavior).toBe("IGNORE");
      });

      describe("マウスの左ボタンが押された場合", () => {
        beforeEach(() => {
          mouseDownContext = {
            ...mouseDownContext,
            mouseButton: "LEFT_BUTTON",
          } as MouseDownBehaviorContext;
        });

        it("Shiftが押されている場合、常に矩形選択開始", () => {
          context.shiftKey.value = true;
          const { resolveMouseDownBehavior } = useEditMode(context);
          const behavior = resolveMouseDownBehavior(mouseDownContext);
          expect(behavior).toBe("START_RECT_SELECT");
        });

        describe("選択ツールが編集優先の場合", () => {
          beforeEach(() => {
            context.selectedNoteTool.value = "EDIT_FIRST";
          });

          it("ctrlが押されている場合、DESELECT_ALL を返す", () => {
            context.ctrlKey.value = true;
            const { resolveMouseDownBehavior } = useEditMode(context);
            const behavior = resolveMouseDownBehavior(mouseDownContext);
            expect(behavior).toBe("DESELECT_ALL");
          });

          it("ctrlが押されていない場合、ノート追加", () => {
            context.ctrlKey.value = false;
            const { resolveMouseDownBehavior } = useEditMode(context);
            const behavior = resolveMouseDownBehavior(mouseDownContext);
            expect(behavior).toBe("ADD_NOTE");
          });
        });

        describe("選択ツールが選択優先の場合", () => {
          beforeEach(() => {
            context.selectedNoteTool.value = "SELECT_FIRST";
          });

          it("矩形選択開始", () => {
            const { resolveMouseDownBehavior } = useEditMode(context);
            const behavior = resolveMouseDownBehavior(mouseDownContext);
            expect(behavior).toBe("START_RECT_SELECT");
          });
        });

        it("その他の場合、全選択解除", () => {
          context.selectedNoteTool.value = "UNKNOWN_TOOL" as NoteEditTool;
          const { resolveMouseDownBehavior } = useEditMode(context);
          const behavior = resolveMouseDownBehavior(mouseDownContext);
          expect(behavior).toBe("DESELECT_ALL");
        });
      });

      it("マウスの左ボタン以外が押された場合(メニュー表示右ボタンなど)、全選択解除", () => {
        mouseDownContext = {
          ...mouseDownContext,
          mouseButton: "RIGHT_BUTTON",
        } as MouseDownBehaviorContext;
        const { resolveMouseDownBehavior } = useEditMode(context);
        const behavior = resolveMouseDownBehavior(mouseDownContext);
        expect(behavior).toBe("DESELECT_ALL");
      });
    });

    describe("ピッチ編集モードでの動作", () => {
      beforeEach(() => {
        context.editTarget.value = "PITCH";
      });

      it("マウスの左ボタン以外が押された場合、無視", () => {
        mouseDownContext = {
          ...mouseDownContext,
          mouseButton: "RIGHT_BUTTON",
        } as MouseDownBehaviorContext;
        const { resolveMouseDownBehavior } = useEditMode(context);
        const behavior = resolveMouseDownBehavior(mouseDownContext);
        expect(behavior).toBe("IGNORE");
      });

      describe("マウスの左ボタンが押された場合", () => {
        beforeEach(() => {
          mouseDownContext = {
            ...mouseDownContext,
            mouseButton: "LEFT_BUTTON",
          } as MouseDownBehaviorContext;
        });

        it("削除ツールの場合、削除", () => {
          context.selectedPitchTool.value = "ERASE";
          const { resolveMouseDownBehavior } = useEditMode(context);
          const behavior = resolveMouseDownBehavior(mouseDownContext);
          expect(behavior).toBe("ERASE_PITCH");
        });

        it("編集ツールが選択されていてCtrlが押されていない場合、編集ツール", () => {
          context.selectedPitchTool.value = "DRAW";
          context.ctrlKey.value = false;
          const { resolveMouseDownBehavior } = useEditMode(context);
          const behavior = resolveMouseDownBehavior(mouseDownContext);
          expect(behavior).toBe("DRAW_PITCH");
        });

        it("ctrlが押されている場合、削除", () => {
          context.selectedPitchTool.value = "DRAW";
          context.ctrlKey.value = true;
          const { resolveMouseDownBehavior } = useEditMode(context);
          const behavior = resolveMouseDownBehavior(mouseDownContext);
          expect(behavior).toBe("ERASE_PITCH");
        });
      });
    });

    it("いずれでもない場合は無視", () => {
      context.editTarget.value = "UNKNOWN_TARGET" as SequencerEditTarget;
      const { resolveMouseDownBehavior } = useEditMode(context);
      const behavior = resolveMouseDownBehavior(mouseDownContext);
      expect(behavior).toBe("IGNORE");
    });
  });

  // ダブルクリックの振る舞い
  describe("resolveDoubleClickBehavior", () => {
    it("プレビュー中は無視", () => {
      context.nowPreviewing.value = true;
      const { resolveDoubleClickBehavior } = useEditMode(context);
      const behavior = resolveDoubleClickBehavior();
      expect(behavior).toBe("IGNORE");
    });

    it("ノート編集モードで選択ツールが選択優先の場合、ノート追加", () => {
      context.editTarget.value = "NOTE";
      context.selectedNoteTool.value = "SELECT_FIRST";
      const { resolveDoubleClickBehavior } = useEditMode(context);
      const behavior = resolveDoubleClickBehavior();
      expect(behavior).toBe("ADD_NOTE");
    });

    it("ノート編集モードで選択ツールが編集優先の場合、無視", () => {
      context.editTarget.value = "NOTE";
      context.selectedNoteTool.value = "EDIT_FIRST";
      const { resolveDoubleClickBehavior } = useEditMode(context);
      const behavior = resolveDoubleClickBehavior();
      expect(behavior).toBe("IGNORE");
    });

    it("ピッチ編集モードでは無視", () => {
      context.editTarget.value = "PITCH";
      const { resolveDoubleClickBehavior } = useEditMode(context);
      const behavior = resolveDoubleClickBehavior();
      expect(behavior).toBe("IGNORE");
    });
  });

  describe("watcherの動作", () => {
    it("ピッチ編集モードでctrlKeyが押されたとき削除ツールに変更される", async () => {
      context.editTarget.value = "PITCH";
      context.selectedPitchTool.value = "DRAW";
      context.ctrlKey.value = false;

      useEditMode(context);

      context.ctrlKey.value = true;
      await nextTick();

      expect(context.selectedPitchTool.value).toBe("ERASE");
    });

    it("ピッチ編集モードでない場合、描画ツールは変更されない", async () => {
      context.editTarget.value = "NOTE";
      context.selectedPitchTool.value = "ERASE";
      context.ctrlKey.value = false;

      useEditMode(context);

      context.ctrlKey.value = true;
      await nextTick();

      expect(context.selectedPitchTool.value).toBe("ERASE");
    });

    it("ピッチ編集モードで編集ツールでないときctrlKeyが押されたときはなにもしない", async () => {
      context.editTarget.value = "PITCH";
      context.selectedPitchTool.value = "ERASE";
      context.ctrlKey.value = false;

      useEditMode(context);

      context.ctrlKey.value = true;
      await nextTick();

      expect(context.selectedPitchTool.value).toBe("ERASE");
    });

    it("ピッチ編集モードでCtrlキーで削除ツールにしていた場合、Ctrlキーが離されたとき描画ツールに戻る", async () => {
      context.editTarget.value = "PITCH";
      context.selectedPitchTool.value = "DRAW";
      context.ctrlKey.value = false;

      useEditMode(context);

      // Ctrlキーを押す
      context.ctrlKey.value = true;
      await nextTick();
      expect(context.selectedPitchTool.value).toBe("ERASE");

      // Ctrlキーを離す
      context.ctrlKey.value = false;
      await nextTick();
      expect(context.selectedPitchTool.value).toBe("DRAW");
    });
    it("ピッチ編集モードで削除ツール選択中だがCtrlキーによる変更でない場合、Ctrlキーが離されても描画ツールに戻らない", async () => {
      context.editTarget.value = "PITCH";
      context.selectedPitchTool.value = "ERASE"; // 手動で消しゴムツールに設定した場合
      context.ctrlKey.value = true;

      useEditMode(context);

      // Ctrlキーを離す
      context.ctrlKey.value = false;
      await nextTick();
      expect(context.selectedPitchTool.value).toBe("ERASE");
    });
  });
});
