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
import { clamp, getPrev } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { assertNonNullable } from "@/type/utility";

export class MovePhonemeTimingState
  implements
    State<
      PhonemeTimingEditorStateDefinitions,
      PhonemeTimingEditorInput,
      PhonemeTimingEditorContext
    >
{
  readonly id = "movePhonemeTiming";

  private readonly targetTrackId: TrackId;
  private readonly noteId: NoteId;
  private readonly phonemeIndexInNote: number;
  private readonly startPositionX: number;
  private readonly returnStateId: PhonemeTimingEditorIdleStateId;

  private currentPositionX: number;
  private shouldApplyPreview: boolean;

  private animationContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    targetTrackId: TrackId;
    noteId: NoteId;
    phonemeIndexInNote: number;
    startPositionX: number;
    returnStateId: PhonemeTimingEditorIdleStateId;
  }) {
    this.targetTrackId = args.targetTrackId;
    this.noteId = args.noteId;
    this.phonemeIndexInNote = args.phonemeIndexInNote;
    this.startPositionX = args.startPositionX;
    this.returnStateId = args.returnStateId;

    this.currentPositionX = args.startPositionX;
    this.shouldApplyPreview = false;
  }

  onEnter(context: PhonemeTimingEditorContext) {
    const targetInfo = context.phonemeTimingInfos.value.find(
      (info) =>
        info.noteId === this.noteId &&
        info.phonemeIndexInNote === this.phonemeIndexInNote,
    );

    if (targetInfo != undefined) {
      const initialOffsetSeconds =
        targetInfo.editedStartTimeSeconds - targetInfo.originalStartTimeSeconds;

      context.previewPhonemeTiming.value = {
        type: "move",
        noteId: this.noteId,
        phonemeIndexInNote: this.phonemeIndexInNote,
        offsetSeconds: initialOffsetSeconds,
      };
    }

    context.previewMode.value = "MOVE_PHONEME_TIMING";
    context.cursorState.value = "EW_RESIZE";

    const previewIfNeeded = () => {
      if (this.animationContext == undefined) {
        throw new Error("animationContext is undefined.");
      }
      if (this.animationContext.executePreviewProcess) {
        this.updatePreview(context);
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
    if (this.animationContext == undefined) {
      throw new Error("animationContext is undefined.");
    }

    cancelAnimationFrame(this.animationContext.previewRequestId);

    const targetInfo = context.phonemeTimingInfos.value.find(
      (info) =>
        info.noteId === this.noteId &&
        info.phonemeIndexInNote === this.phonemeIndexInNote,
    );
    if (targetInfo != undefined && this.shouldApplyPreview) {
      this.applyPreview(context);
    }

    context.previewPhonemeTiming.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private updatePreview(context: PhonemeTimingEditorContext) {
    const phraseInfos = context.phraseInfos.value;
    const phonemeTimingInfos = context.phonemeTimingInfos.value;
    const viewportInfo = context.viewportInfo.value;
    const tempos = context.tempos.value;
    const tpqn = context.tpqn.value;

    const targetIndex = phonemeTimingInfos.findIndex(
      (info) =>
        info.noteId === this.noteId &&
        info.phonemeIndexInNote === this.phonemeIndexInNote,
    );
    if (targetIndex === -1) {
      return;
    }

    const targetInfo = phonemeTimingInfos[targetIndex];
    const prevInfo = getPrev(phonemeTimingInfos, targetIndex);
    if (prevInfo == undefined) {
      throw new Error("Previous phoneme timing info does not exist.");
    }

    const phraseInfo = getOrThrow(phraseInfos, targetInfo.phraseKey);
    assertNonNullable(phraseInfo.query);
    const frameRate = phraseInfo.query.frameRate;

    let minNonPauseStartTime: number | undefined = undefined;
    if (phraseInfo.minNonPauseStartFrame != undefined) {
      minNonPauseStartTime =
        phraseInfo.startTime + phraseInfo.minNonPauseStartFrame / frameRate;
    }

    let maxNonPauseEndTime: number | undefined = undefined;
    if (phraseInfo.maxNonPauseEndFrame != undefined) {
      maxNonPauseEndTime =
        phraseInfo.startTime + phraseInfo.maxNonPauseEndFrame / frameRate;
    }

    let minTimeSeconds = prevInfo.editedStartTimeSeconds;
    if (
      minNonPauseStartTime != undefined &&
      minTimeSeconds < minNonPauseStartTime
    ) {
      minTimeSeconds = minNonPauseStartTime;
    }

    let maxTimeSeconds = targetInfo.editedEndTimeSeconds;
    if (
      maxNonPauseEndTime != undefined &&
      maxTimeSeconds > maxNonPauseEndTime
    ) {
      maxTimeSeconds = maxNonPauseEndTime;
    }

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

    const originalStartTimeSeconds = targetInfo.originalStartTimeSeconds;
    const editedStartTimeSeconds = targetInfo.editedStartTimeSeconds;

    // 新しいoffsetSecondsを計算
    // initialStartTimeSeconds + timeDelta が minTimeSeconds と maxTimeSeconds の間になるようにclamp
    const newStartTime = clamp(
      editedStartTimeSeconds + timeDeltaSeconds,
      minTimeSeconds,
      maxTimeSeconds,
    );

    const newOffsetSeconds = newStartTime - originalStartTimeSeconds;

    context.previewPhonemeTiming.value = {
      type: "move",
      noteId: this.noteId,
      phonemeIndexInNote: this.phonemeIndexInNote,
      offsetSeconds: newOffsetSeconds,
    };
  }

  private applyPreview(context: PhonemeTimingEditorContext) {
    const preview = context.previewPhonemeTiming.value;
    if (preview == undefined || preview.type !== "move") {
      throw new Error("previewPhonemeTiming is undefined or not move type.");
    }

    const { offsetSeconds } = preview;

    const phonemeTimingEdit = {
      phonemeIndexInNote: this.phonemeIndexInNote,
      offsetSeconds,
    };

    void context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT({
      noteId: this.noteId,
      phonemeTimingEdit,
      trackId: this.targetTrackId,
    });
  }
}
