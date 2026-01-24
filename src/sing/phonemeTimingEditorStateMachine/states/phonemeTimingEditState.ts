import { SetNextState, State } from "@/sing/stateMachine";
import {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { NoteId, TrackId } from "@/type/preload";
import { baseXToTick, getButton } from "@/sing/viewHelper";
import { tickToSecond } from "@/sing/music";
import { clamp } from "@/sing/utility";

export class PhonemeTimingEditState
  implements
    State<
      PhonemeTimingEditorStateDefinitions,
      PhonemeTimingEditorInput,
      PhonemeTimingEditorContext
    >
{
  readonly id = "phonemeTimingEdit";

  private readonly targetTrackId: TrackId;
  private readonly noteId: NoteId;
  private readonly phonemeIndexInNote: number;
  private readonly initialStartTimeSeconds: number;
  private readonly initialOffsetSeconds: number;
  private readonly hasExistingEdit: boolean;
  private readonly minTimeSeconds: number;
  private readonly maxTimeSeconds: number;
  private readonly startPositionX: number;
  private readonly returnStateId: PhonemeTimingEditorIdleStateId;

  private currentPositionX: number;
  private shouldApplyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    targetTrackId: TrackId;
    noteId: NoteId;
    phonemeIndexInNote: number;
    initialStartTimeSeconds: number;
    initialOffsetSeconds: number;
    hasExistingEdit: boolean;
    minTimeSeconds: number;
    maxTimeSeconds: number;
    startPositionX: number;
    returnStateId: PhonemeTimingEditorIdleStateId;
  }) {
    this.targetTrackId = args.targetTrackId;
    this.noteId = args.noteId;
    this.phonemeIndexInNote = args.phonemeIndexInNote;
    this.initialStartTimeSeconds = args.initialStartTimeSeconds;
    this.initialOffsetSeconds = args.initialOffsetSeconds;
    this.hasExistingEdit = args.hasExistingEdit;
    this.minTimeSeconds = args.minTimeSeconds;
    this.maxTimeSeconds = args.maxTimeSeconds;
    this.startPositionX = args.startPositionX;
    this.returnStateId = args.returnStateId;

    this.currentPositionX = args.startPositionX;
    this.shouldApplyPreview = false;
  }

  onEnter(context: PhonemeTimingEditorContext) {
    context.previewPhonemeTimingEdit.value = {
      noteId: this.noteId,
      phonemeIndexInNote: this.phonemeIndexInNote,
      offsetSeconds: this.initialOffsetSeconds,
    };

    context.previewMode.value = "PHONEME_TIMING_EDIT";
    context.cursorState.value = "EW_RESIZE";

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.updatePreview(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
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
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }

    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);

      if (
        input.targetArea === "Window" ||
        input.targetArea === "PhonemeTimingArea"
      ) {
        if (input.pointerEvent.type === "pointermove") {
          this.currentPositionX = input.positionX;
          this.innerContext.executePreviewProcess = true;
        } else if (
          input.pointerEvent.type === "pointerup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          // 編集適用判定: startPositionXとcurrentPositionXの差があれば適用する
          const pixelDelta = Math.abs(
            this.currentPositionX - this.startPositionX,
          );
          this.shouldApplyPreview = pixelDelta >= 1;
          setNextState(this.returnStateId, undefined);
        }
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);

    if (this.shouldApplyPreview) {
      this.applyPreview(context);
    }

    context.previewPhonemeTimingEdit.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private updatePreview(context: PhonemeTimingEditorContext) {
    if (context.previewPhonemeTimingEdit.value == undefined) {
      throw new Error("previewPhonemeTimingEdit is undefined.");
    }

    const viewportInfo = context.viewportInfo.value;
    const tempos = context.tempos.value;
    const tpqn = context.tpqn.value;

    // ピクセル座標からbaseXを計算し、tickを経由して秒に変換
    // これによりテンポ変更を正しく考慮できる
    const startBaseX =
      (this.startPositionX + viewportInfo.offsetX) / viewportInfo.scaleX;
    const currentBaseX =
      (this.currentPositionX + viewportInfo.offsetX) / viewportInfo.scaleX;

    const startTicks = baseXToTick(startBaseX, tpqn);
    const currentTicks = baseXToTick(currentBaseX, tpqn);

    const startSeconds = tickToSecond(startTicks, tempos, tpqn);
    const currentSeconds = tickToSecond(currentTicks, tempos, tpqn);

    const timeDeltaSeconds = currentSeconds - startSeconds;

    // 新しいoffsetSecondsを計算
    // initialStartTimeSeconds + timeDelta が minTimeSeconds と maxTimeSeconds の間になるようにclamp
    const newStartTime = this.initialStartTimeSeconds + timeDeltaSeconds;
    const clampedStartTime = clamp(
      newStartTime,
      this.minTimeSeconds,
      this.maxTimeSeconds,
    );

    // clampedStartTimeとinitialStartTimeSecondsの差分が実際の変化量
    const actualTimeDelta = clampedStartTime - this.initialStartTimeSeconds;
    const newOffsetSeconds = this.initialOffsetSeconds + actualTimeDelta;

    context.previewPhonemeTimingEdit.value = {
      noteId: this.noteId,
      phonemeIndexInNote: this.phonemeIndexInNote,
      offsetSeconds: newOffsetSeconds,
    };
  }

  private applyPreview(context: PhonemeTimingEditorContext) {
    if (context.previewPhonemeTimingEdit.value == undefined) {
      throw new Error("previewPhonemeTimingEdit is undefined.");
    }

    const { offsetSeconds } = context.previewPhonemeTimingEdit.value;

    const phonemeTimingEdit = {
      phonemeIndexInNote: this.phonemeIndexInNote,
      offsetSeconds,
    };

    if (this.hasExistingEdit) {
      void context.store.actions.COMMAND_UPDATE_PHONEME_TIMING_EDITS({
        noteId: this.noteId,
        phonemeTimingEdits: [phonemeTimingEdit],
        trackId: this.targetTrackId,
      });
    } else {
      void context.store.actions.COMMAND_ADD_PHONEME_TIMING_EDITS({
        noteId: this.noteId,
        phonemeTimingEdits: [phonemeTimingEdit],
        trackId: this.targetTrackId,
      });
    }
  }
}
