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
  applySmoothTransition,
  createArray,
  linearInterpolation,
} from "@/sing/utility";
import { getButton } from "@/sing/viewHelper";
import { getOrThrow } from "@/helpers/mapHelper";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";

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
      const editStartFrame = context.previewPitchEdit.value.startFrame;
      let data = context.previewPitchEdit.value.data;
      const editEndFrame = editStartFrame + data.length;

      // 平滑化を行う
      data = data.map((value) => Math.log(value));
      applyGaussianFilter(data, 0.7);
      data = data.map((value) => Math.exp(value));

      const targetTrack = getOrThrow(
        context.store.state.tracks,
        this.targetTrackId,
      );
      const pitchEditData = targetTrack.pitchEditData;

      // 前方にどこまで編集データが続いているか探す
      let contiguousRegionStartFrame = editStartFrame;
      if (editStartFrame - 1 < pitchEditData.length) {
        for (let i = editStartFrame - 1; i >= 0; i--) {
          if (pitchEditData[i] !== VALUE_INDICATING_NO_DATA) {
            contiguousRegionStartFrame = i;
          } else {
            break;
          }
        }
      }

      // 後方にどこまで編集データが続いているか探す
      let contiguousRegionEndFrame = editEndFrame;
      for (let i = editEndFrame; i < pitchEditData.length; i++) {
        if (pitchEditData[i] !== VALUE_INDICATING_NO_DATA) {
          contiguousRegionEndFrame = i + 1;
        } else {
          break;
        }
      }

      // 編集区間の前後に編集データがあれば、それらを結合する
      if (contiguousRegionStartFrame !== editStartFrame) {
        const frontData = pitchEditData.slice(
          contiguousRegionStartFrame,
          editStartFrame,
        );
        data = [...frontData, ...data];
      }
      if (contiguousRegionEndFrame !== editEndFrame) {
        const backData = pitchEditData.slice(
          editEndFrame,
          contiguousRegionEndFrame,
        );
        data = [...data, ...backData];
      }

      // 既存の編集データと新しい編集データの境界を不連続箇所として記録する
      const jumpIndices: number[] = [];
      if (contiguousRegionStartFrame !== editStartFrame) {
        jumpIndices.push(editStartFrame - contiguousRegionStartFrame);
      }
      if (contiguousRegionEndFrame !== editEndFrame) {
        jumpIndices.push(editEndFrame - contiguousRegionStartFrame);
      }

      // 不連続箇所を滑らかにつなぐ
      // NOTE: 最大6フレーム（左右各3フレーム）かけて滑らかにする
      if (jumpIndices.length !== 0) {
        data = data.map((value) => Math.log(value));
        applySmoothTransition(data, jumpIndices, {
          left: 3,
          right: 3,
        });
        data = data.map((value) => Math.exp(value));
      }

      void context.store.actions.COMMAND_SET_PITCH_EDIT_DATA({
        pitchArray: data,
        startFrame: contiguousRegionStartFrame,
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
