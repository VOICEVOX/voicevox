import type { SetNextState, State } from "@/sing/stateMachine";
import type {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingInfo,
  PhraseInfo,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { NoteId, TrackId } from "@/type/preload";
import { baseXToTick, getButton } from "@/sing/viewHelper";
import { tickToSecond } from "@/sing/music";
import { clamp, getPrev } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { assertNonNullable } from "@/type/utility";

export class MovePhonemeTimingState implements State<
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext
> {
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
        } else if (input.pointerEvent.type === "pointercancel") {
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

    const newStartTime = this.clampMovingPhonemeStartTime(
      editedStartTimeSeconds + timeDeltaSeconds,
      phraseInfo,
      prevInfo,
      targetInfo,
      frameRate,
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

  /**
   * 移動対象の音素の開始時刻を、音素タイミングに課される次の制約に基づいてクランプする。
   * - 前後の音素が最低1フレーム分残ること
   * - 非pause区間の開始フレームが所定の最小値以上、終了フレームが所定の最大値以下
   *
   * @param candidateTimeSeconds - クランプしたい開始時刻の候補
   * @param phraseInfo - 対象音素が属するフレーズの情報
   * @param prevInfo - 対象音素の直前の音素のタイミング情報
   * @param targetInfo - 対象音素のタイミング情報
   * @param frameRate - フレームレート
   */
  private clampMovingPhonemeStartTime(
    candidateTimeSeconds: number,
    phraseInfo: PhraseInfo,
    prevInfo: PhonemeTimingInfo,
    targetInfo: PhonemeTimingInfo,
    frameRate: number,
  ): number {
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

    const oneFrameSeconds = 1 / frameRate;

    let minTimeSeconds = prevInfo.editedStartTimeSeconds + oneFrameSeconds;
    if (
      minNonPauseStartTime != undefined &&
      minTimeSeconds < minNonPauseStartTime
    ) {
      minTimeSeconds = minNonPauseStartTime;
    }

    let maxTimeSeconds = targetInfo.editedEndTimeSeconds - oneFrameSeconds;
    if (
      maxNonPauseEndTime != undefined &&
      maxTimeSeconds > maxNonPauseEndTime
    ) {
      maxTimeSeconds = maxNonPauseEndTime;
    }

    // 上記の切り上げ・切り下げで範囲が反転し得るので、その場合は一点に潰す
    if (minTimeSeconds > maxTimeSeconds) {
      minTimeSeconds = maxTimeSeconds;
    }

    return clamp(candidateTimeSeconds, minTimeSeconds, maxTimeSeconds);
  }
}
