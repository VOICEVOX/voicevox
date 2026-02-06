import { SetNextState, State } from "@/sing/stateMachine";
import {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { NoteId, TrackId } from "@/type/preload";
import { getButton, tickToBaseX } from "@/sing/viewHelper";
import { secondToTick } from "@/sing/music";

export class ErasePhonemeTimingState
  implements
    State<
      PhonemeTimingEditorStateDefinitions,
      PhonemeTimingEditorInput,
      PhonemeTimingEditorContext
    >
{
  readonly id = "erasePhonemeTiming";

  private readonly targetTrackId: TrackId;
  private readonly returnStateId: PhonemeTimingEditorIdleStateId;

  private prevPositionX: number;
  private currentPositionX: number;
  private targets: {
    noteId: NoteId;
    phonemeIndexInNote: number;
  }[];
  private shouldApplyPreview: boolean;

  private animationContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    targetTrackId: TrackId;
    startPositionX: number;
    returnStateId: PhonemeTimingEditorIdleStateId;
  }) {
    this.targetTrackId = args.targetTrackId;
    this.returnStateId = args.returnStateId;

    this.prevPositionX = args.startPositionX;
    this.currentPositionX = args.startPositionX;
    this.targets = [];
    this.shouldApplyPreview = false;
  }

  onEnter(context: PhonemeTimingEditorContext) {
    context.previewPhonemeTiming.value = {
      type: "erase",
      targets: [],
    };
    context.previewMode.value = "ERASE_PHONEME_TIMING";
    context.cursorState.value = "CROSSHAIR";

    // 初期位置での当たり判定
    this.updateEraseTargets(context);

    const previewIfNeeded = () => {
      if (this.animationContext == undefined) {
        throw new Error("animationContext is undefined.");
      }
      if (this.animationContext.executePreviewProcess) {
        this.updateEraseTargets(context);
        this.animationContext.executePreviewProcess = false;
      }
      this.animationContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.animationContext = {
      executePreviewProcess: false,
      previewRequestId,
    };
  }

  process({
    input,
    setNextState,
  }: {
    input: PhonemeTimingEditorInput;
    context: PhonemeTimingEditorContext;
    setNextState: SetNextState<PhonemeTimingEditorStateDefinitions>;
  }) {
    if (this.animationContext == undefined) {
      throw new Error("animationContext is undefined.");
    }

    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);

      if (
        input.targetArea === "Window" ||
        input.targetArea === "PhonemeTimingArea"
      ) {
        if (input.pointerEvent.type === "pointermove") {
          this.currentPositionX = input.positionX;
          this.animationContext.executePreviewProcess = true;
        } else if (
          input.pointerEvent.type === "pointerup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.shouldApplyPreview = this.targets.length > 0;
          setNextState(this.returnStateId, undefined);
        }
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    if (this.animationContext == undefined) {
      throw new Error("animationContext is undefined.");
    }

    cancelAnimationFrame(this.animationContext.previewRequestId);

    if (this.shouldApplyPreview) {
      this.applyPreview(context);
    }

    context.previewPhonemeTiming.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private updateEraseTargets(context: PhonemeTimingEditorContext) {
    const phonemeTimingInfos = context.phonemeTimingInfos.value;
    const phonemeTimingEditData = context.phonemeTimingEditData.value;
    const viewportInfo = context.viewportInfo.value;
    const tempos = context.tempos.value;
    const tpqn = context.tpqn.value;

    // 高速移動対応: 前回と現在の位置の間の範囲で当たり判定
    const threshold = 4;
    const minX =
      Math.min(this.prevPositionX, this.currentPositionX) - threshold;
    const maxX =
      Math.max(this.prevPositionX, this.currentPositionX) + threshold;

    for (const phonemeTimingInfo of phonemeTimingInfos) {
      if (phonemeTimingInfo.noteId == undefined) {
        continue;
      }

      // 編集済みかどうか確認
      const phonemeTimingEdits = phonemeTimingEditData.get(
        phonemeTimingInfo.noteId,
      );
      const hasExistingEdit =
        phonemeTimingEdits?.some(
          (edit) =>
            edit.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote,
        ) ?? false;

      if (!hasExistingEdit) {
        continue;
      }

      // 音素タイミング線のX座標を計算
      const phonemeStartTicks = secondToTick(
        phonemeTimingInfo.editedStartTimeSeconds,
        tempos,
        tpqn,
      );
      const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn);
      const phonemeX = Math.round(
        phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
      );

      // カーソルの軌跡範囲内かどうか判定
      if (phonemeX >= minX && phonemeX <= maxX) {
        // まだ削除対象リストにない場合、追加
        const alreadyInTargets = this.targets.some(
          (t) =>
            t.noteId === phonemeTimingInfo.noteId &&
            t.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote,
        );

        if (!alreadyInTargets) {
          this.targets.push({
            noteId: phonemeTimingInfo.noteId,
            phonemeIndexInNote: phonemeTimingInfo.phonemeIndexInNote,
          });
        }
      }
    }

    // プレビューを更新
    context.previewPhonemeTiming.value = {
      type: "erase",
      targets: [...this.targets],
    };

    // 次回のために現在位置を保存
    this.prevPositionX = this.currentPositionX;
  }

  private applyPreview(context: PhonemeTimingEditorContext) {
    if (this.targets.length === 0) {
      return;
    }

    void context.store.actions.COMMAND_ERASE_PHONEME_TIMING_EDITS({
      targets: this.targets,
      trackId: this.targetTrackId,
    });
  }
}
