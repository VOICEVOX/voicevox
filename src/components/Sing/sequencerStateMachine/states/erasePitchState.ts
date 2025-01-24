import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/components/Sing/sequencerStateMachine/common";
import { TrackId } from "@/type/preload";
import { getButton } from "@/sing/viewHelper";

export class ErasePitchState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "erasePitch";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;

  private currentCursorPos: PositionOnSequencer;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    cursorPosAtStart: PositionOnSequencer;
    targetTrackId: TrackId;
  }) {
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;

    this.currentCursorPos = args.cursorPosAtStart;
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

  onEnter(context: Context) {
    context.previewPitchEdit.value = {
      type: "erase",
      startFrame: this.cursorPosAtStart.frame,
      frameLength: 1,
    };
    context.nowPreviewing.value = true;

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
    const mouseButton = getButton(input.mouseEvent);
    if (input.targetArea === "SequencerBody") {
      if (input.mouseEvent.type === "mousemove") {
        this.currentCursorPos = input.cursorPos;
        this.innerContext.executePreviewProcess = true;
      } else if (input.mouseEvent.type === "mouseup") {
        if (mouseButton === "LEFT_BUTTON") {
          setNextState("idle", undefined);
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

    void context.store.actions.COMMAND_ERASE_PITCH_EDIT_DATA({
      startFrame: context.previewPitchEdit.value.startFrame,
      frameLength: context.previewPitchEdit.value.frameLength,
      trackId: this.targetTrackId,
    });

    context.previewPitchEdit.value = undefined;
    context.nowPreviewing.value = false;
  }
}
