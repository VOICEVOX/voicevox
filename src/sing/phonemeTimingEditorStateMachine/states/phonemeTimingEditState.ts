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

      context.previewPhonemeTimingEdit.value = {
        noteId: this.noteId,
        phonemeIndexInNote: this.phonemeIndexInNote,
        offsetSeconds: initialOffsetSeconds,
      };
    }

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

    const targetInfo = context.phonemeTimingInfos.value.find(
      (info) =>
        info.noteId === this.noteId &&
        info.phonemeIndexInNote === this.phonemeIndexInNote,
    );
    if (targetInfo != undefined && this.shouldApplyPreview) {
      this.applyPreview(context);
    }

    context.previewPhonemeTimingEdit.value = undefined;
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

    void context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT({
      noteId: this.noteId,
      phonemeTimingEdit,
      trackId: this.targetTrackId,
    });
  }
}
