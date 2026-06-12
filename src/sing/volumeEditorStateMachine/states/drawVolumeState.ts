import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  PositionOnVolumeEditor,
  VolumeEditorIdleStateId,
} from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import type { TrackId } from "@/type/preload";
import { decibelToLinear, linearToDecibel } from "@/sing/audio";
import { createArray, linearInterpolation } from "@/sing/utility";
import { getButton } from "@/sing/viewHelper";
import {
  countVolumeEditDataPoints,
  maskVolumeEditDataByEditableRanges,
} from "@/sing/volumeEditRanges";

export class DrawVolumeState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "drawVolume";

  private readonly cursorPosAtStart: PositionOnVolumeEditor;
  private readonly trackId: TrackId;
  private readonly returnStateId: VolumeEditorIdleStateId;

  private currentCursorPos: PositionOnVolumeEditor;
  private applyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
        prevCursorPos: PositionOnVolumeEditor;
      }
    | undefined;

  constructor(args: {
    startPosition: PositionOnVolumeEditor;
    targetTrackId: TrackId;
    returnStateId: VolumeEditorIdleStateId;
  }) {
    this.cursorPosAtStart = args.startPosition;
    this.trackId = args.targetTrackId;
    this.returnStateId = args.returnStateId;
    this.currentCursorPos = this.cursorPosAtStart;
    this.applyPreview = false;
  }

  onEnter(context: VolumeEditorContext) {
    context.previewVolumeEdit.value = {
      type: "draw",
      data: [this.cursorPosAtStart.value],
      startFrame: this.cursorPosAtStart.frame,
    };
    context.cursorState.value = "UNSET";
    context.previewMode.value = "VOLUME_DRAW";

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewDrawVolume(context);
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
    input: VolumeEditorInput;
    context: VolumeEditorContext;
    setNextState: SetNextState<VolumeEditorStateDefinitions>;
  }) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewVolumeEdit.value == undefined) {
      throw new Error("previewVolumeEdit is undefined.");
    }
    if (context.previewVolumeEdit.value.type !== "draw") {
      throw new Error("previewVolumeEdit.type is not draw.");
    }

    if (input.type != "pointerEvent") {
      return;
    }

    const { pointerEvent, position, targetArea } = input;
    const mouseButton = getButton(pointerEvent);

    // 対象がWindow
    if (targetArea === "Window") {
      if (pointerEvent.type === "pointermove") {
        this.currentCursorPos = position;
        this.innerContext.executePreviewProcess = true;
      } else if (
        (pointerEvent.type === "pointerup" && mouseButton === "LEFT_BUTTON") ||
        pointerEvent.type === "pointercancel"
      ) {
        // NOTE: ピッチと同様
        // カーソルを動かさずにマウスのボタンを離したときに1フレームのみの変更になり、
        // 1フレームの変更はピッチ編集ラインとして表示されないので、無視する
        const len = context.previewVolumeEdit.value.data.length;
        this.applyPreview = len >= 2;
        setNextState(this.returnStateId, undefined);
      }
    }

    // 対象がEditor
    if (targetArea === "Editor") {
      if (pointerEvent.type === "pointermove") {
        this.currentCursorPos = position;
        this.innerContext.executePreviewProcess = true;
      }
    }
  }

  onExit(context: VolumeEditorContext) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewVolumeEdit.value == undefined) {
      throw new Error("previewVolumeEdit is undefined.");
    }
    if (context.previewVolumeEdit.value.type !== "draw") {
      throw new Error("previewVolumeEdit.type is not draw.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);
    this.innerContext = undefined;

    if (this.applyPreview) {
      const maskedPreviewData = maskVolumeEditDataByEditableRanges(
        context.previewVolumeEdit.value.data,
        context.previewVolumeEdit.value.startFrame,
        context.getEditableFrameRanges(),
      );
      if (countVolumeEditDataPoints(maskedPreviewData) >= 2) {
        // TODO: 平滑化を行う...特にdBスケールにするのであれば他も見直す必要がある
        void context.store.actions.COMMAND_SET_VOLUME_EDIT_DATA({
          volumeArray: maskedPreviewData,
          startFrame: context.previewVolumeEdit.value.startFrame,
          trackId: this.trackId,
        });
      }
    }

    context.previewVolumeEdit.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private previewDrawVolume(context: VolumeEditorContext) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewVolumeEdit.value == undefined) {
      throw new Error("previewVolumeEdit.value is undefined.");
    }
    if (context.previewVolumeEdit.value.type !== "draw") {
      throw new Error("previewVolumeEdit.value.type is not draw.");
    }

    const cursorFrame = this.currentCursorPos.frame;
    const cursorValue = this.currentCursorPos.value;
    const prevCursorFrame = this.innerContext.prevCursorPos.frame;
    const prevCursorValue = this.innerContext.prevCursorPos.value;
    const tempPreviewEdit = {
      ...context.previewVolumeEdit.value,
      data: [...context.previewVolumeEdit.value.data],
    };

    // 開始フレームがカーソルフレームより後ろの場合は、カーソルフレームまで前方拡張
    if (tempPreviewEdit.startFrame > cursorFrame) {
      const prependLength = tempPreviewEdit.startFrame - cursorFrame;
      const fillValue = tempPreviewEdit.data.at(0) ?? cursorValue;
      const prepend = createArray(prependLength, () => fillValue);
      tempPreviewEdit.data = prepend.concat(tempPreviewEdit.data);
      tempPreviewEdit.startFrame = cursorFrame;
    }

    // 最後のフレームがカーソルフレームより前の場合は、カーソルフレームまで後方拡張
    const lastFrame =
      tempPreviewEdit.startFrame + tempPreviewEdit.data.length - 1;
    if (lastFrame < cursorFrame) {
      const appendLength = cursorFrame - lastFrame;
      const fillValue = tempPreviewEdit.data.at(-1) ?? cursorValue;
      tempPreviewEdit.data = tempPreviewEdit.data.concat(
        createArray(appendLength, () => fillValue),
      );
    }

    // NOTE: カーソル入力はrequestAnimationFrame単位で処理されるため、
    // 前回位置との間をdBスケールで補間してフレーム抜けによるギザつきを防ぐ。
    if (cursorFrame === prevCursorFrame) {
      const i = cursorFrame - tempPreviewEdit.startFrame;
      tempPreviewEdit.data[i] = cursorValue;
    } else if (cursorFrame < prevCursorFrame) {
      const cursorDb = linearToDecibel(cursorValue);
      const prevCursorDb = linearToDecibel(prevCursorValue);
      for (let i = cursorFrame; i <= prevCursorFrame; i++) {
        tempPreviewEdit.data[i - tempPreviewEdit.startFrame] = decibelToLinear(
          linearInterpolation(
            cursorFrame,
            cursorDb,
            prevCursorFrame,
            prevCursorDb,
            i,
          ),
        );
      }
    } else {
      const prevCursorDb = linearToDecibel(prevCursorValue);
      const cursorDb = linearToDecibel(cursorValue);
      for (let i = prevCursorFrame; i <= cursorFrame; i++) {
        tempPreviewEdit.data[i - tempPreviewEdit.startFrame] = decibelToLinear(
          linearInterpolation(
            prevCursorFrame,
            prevCursorDb,
            cursorFrame,
            cursorDb,
            i,
          ),
        );
      }
    }
    context.previewVolumeEdit.value = tempPreviewEdit;
    this.innerContext.prevCursorPos = this.currentCursorPos;
  }
}
