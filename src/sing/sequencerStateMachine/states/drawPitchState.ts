import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  IdleStateId,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { TrackId } from "@/type/preload";
import {
  applyGaussianFilter,
  createArray,
  linearInterpolation,
} from "@/sing/utility";
import { getButton } from "@/sing/viewHelper";

export class DrawPitchState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "drawPitch";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: PositionOnSequencer;
  private applyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
        prevCursorPos: PositionOnSequencer;
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
      type: "draw",
      data: [this.cursorPosAtStart.frequency],
      startFrame: this.cursorPosAtStart.frame,
    };
    context.cursorState.value = "UNSET";
    context.previewMode.value = "DRAW_PITCH";

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewDrawPitch(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
      executePreviewProcess: false,
      previewRequestId,
      prevCursorPos: this.cursorPosAtStart,
    };
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: SetNextState<SequencerStateDefinitions>;
  }) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "draw") {
      throw new Error("previewPitchEdit.type is not draw.");
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
          // カーソルを動かさずにマウスのボタンを離したときに1フレームのみの変更になり、
          // 1フレームの変更はピッチ編集ラインとして表示されないので、無視する
          const previewPitchEditDataLength =
            context.previewPitchEdit.value.data.length;
          this.applyPreview = previewPitchEditDataLength >= 2;
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
    if (context.previewPitchEdit.value.type !== "draw") {
      throw new Error("previewPitchEdit.type is not draw.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);

    if (this.applyPreview) {
      // 平滑化を行う
      let data = context.previewPitchEdit.value.data;
      data = data.map((value) => Math.log(value));
      applyGaussianFilter(data, 0.7);
      data = data.map((value) => Math.exp(value));

      void context.store.actions.COMMAND_SET_PITCH_EDIT_DATA({
        pitchArray: data,
        startFrame: context.previewPitchEdit.value.startFrame,
        trackId: this.targetTrackId,
      });
    }

    context.previewPitchEdit.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private previewDrawPitch(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "draw") {
      throw new Error("previewPitchEdit.value.type is not draw.");
    }
    const cursorFrame = this.currentCursorPos.frame;
    const cursorFrequency = this.currentCursorPos.frequency;
    const prevCursorFrame = this.innerContext.prevCursorPos.frame;
    const prevCursorFrequency = this.innerContext.prevCursorPos.frequency;
    if (cursorFrame < 0) {
      return;
    }
    const tempPitchEdit = {
      ...context.previewPitchEdit.value,
      data: [...context.previewPitchEdit.value.data],
    };

    if (cursorFrame < tempPitchEdit.startFrame) {
      const numOfFramesToUnshift = tempPitchEdit.startFrame - cursorFrame;
      tempPitchEdit.data = createArray(numOfFramesToUnshift, () => 0).concat(
        tempPitchEdit.data,
      );
      tempPitchEdit.startFrame = cursorFrame;
    }

    const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.data.length - 1;
    if (cursorFrame > lastFrame) {
      const numOfFramesToPush = cursorFrame - lastFrame;
      tempPitchEdit.data = tempPitchEdit.data.concat(
        createArray(numOfFramesToPush, () => 0),
      );
    }

    if (cursorFrame === prevCursorFrame) {
      const i = cursorFrame - tempPitchEdit.startFrame;
      tempPitchEdit.data[i] = cursorFrequency;
    } else if (cursorFrame < prevCursorFrame) {
      for (let i = cursorFrame; i <= prevCursorFrame; i++) {
        tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
          linearInterpolation(
            cursorFrame,
            Math.log(cursorFrequency),
            prevCursorFrame,
            Math.log(prevCursorFrequency),
            i,
          ),
        );
      }
    } else {
      for (let i = prevCursorFrame; i <= cursorFrame; i++) {
        tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
          linearInterpolation(
            prevCursorFrame,
            Math.log(prevCursorFrequency),
            cursorFrame,
            Math.log(cursorFrequency),
            i,
          ),
        );
      }
    }

    context.previewPitchEdit.value = tempPitchEdit;
    this.innerContext.prevCursorPos = this.currentCursorPos;
  }
}
