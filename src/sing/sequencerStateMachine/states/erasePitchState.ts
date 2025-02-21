import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  IdleStateId,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { TrackId } from "@/type/preload";
import { getButton } from "@/sing/viewHelper";

export class ErasePitchState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "erasePitch";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: PositionOnSequencer;
  private applyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    cursorPosAtStart: PositionOnSequencer;
    targetTrackId: TrackId;
    returnStateId: IdleStateId;
  }) {
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;
    this.returnStateId = args.returnStateId;

    this.currentCursorPos = args.cursorPosAtStart;
    this.applyPreview = false;
  }

  onEnter(context: Context) {
    context.previewPitchEdit.value = {
      type: "erase",
      startFrame: this.cursorPosAtStart.frame,
      frameLength: 1,
    };
    context.cursorState.value = "ERASE";
    context.previewMode.value = "ERASE_PITCH";

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewErasePitch(context);
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
    input: Input;
    context: Context;
    setNextState: SetNextState<SequencerStateDefinitions>;
  }) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);

      if (input.targetArea === "Window") {
        if (input.mouseEvent.type === "mousemove") {
          this.currentCursorPos = input.cursorPos;
          this.innerContext.executePreviewProcess = true;
        } else if (
          input.mouseEvent.type === "mouseup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = true;
          setNextState(this.returnStateId, undefined);
        }
      }
    }
  }

  onExit(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "erase") {
      throw new Error("previewPitchEdit.type is not erase.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);

    if (this.applyPreview) {
      void context.store.actions.COMMAND_ERASE_PITCH_EDIT_DATA({
        startFrame: context.previewPitchEdit.value.startFrame,
        frameLength: context.previewPitchEdit.value.frameLength,
        trackId: this.targetTrackId,
      });
    }

    context.previewPitchEdit.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private previewErasePitch(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "erase") {
      throw new Error("previewPitchEdit.value.type is not erase.");
    }
    const cursorFrame = Math.max(0, this.currentCursorPos.frame);
    const tempPitchEdit = { ...context.previewPitchEdit.value };

    if (tempPitchEdit.startFrame > cursorFrame) {
      tempPitchEdit.frameLength += tempPitchEdit.startFrame - cursorFrame;
      tempPitchEdit.startFrame = cursorFrame;
    }

    const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.frameLength - 1;
    if (lastFrame < cursorFrame) {
      tempPitchEdit.frameLength += cursorFrame - lastFrame;
    }

    context.previewPitchEdit.value = tempPitchEdit;
  }
}
