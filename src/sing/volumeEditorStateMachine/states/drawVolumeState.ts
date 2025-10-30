import {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  VolumeEditorPosition,
  IdleStateId,
} from "../common";
import { SetNextState, State } from "@/sing/stateMachine";
import { TrackId } from "@/type/preload";
import { createArray } from "@/sing/utility";

export class DrawVolumeState
  implements
    State<VolumeEditorStateDefinitions, VolumeEditorInput, VolumeEditorContext>
{
  readonly id = "drawVolume";

  private readonly cursorPosAtStart: VolumeEditorPosition;
  private readonly trackId: TrackId;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: VolumeEditorPosition;
  private applyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
        prevCursorPos: VolumeEditorPosition;
      }
    | undefined;

  constructor(args: {
    startPosition: VolumeEditorPosition;
    trackId: TrackId;
    returnStateId: IdleStateId;
  }) {
    this.cursorPosAtStart = args.startPosition;
    this.trackId = args.trackId;
    this.returnStateId = args.returnStateId;
    this.currentCursorPos = this.cursorPosAtStart;
    this.applyPreview = false;
  }

  onEnter(context: VolumeEditorContext) {
    context.previewVolumeEdit.value = {
      type: "draw",
      data: [this.cursorPosAtStart.amplitude],
      startFrame: this.cursorPosAtStart.frame,
    };
    context.cursorState.value = "DRAW";
    context.previewMode.value = "DRAW_VOLUME";

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

    if (input.type != "mouseEvent") {
      return;
    }

    const { mouseEvent, position, targetArea } = input;

    // 対象がWindow
    if (targetArea === "Window") {
      if (mouseEvent.type === "mousemove") {
        this.currentCursorPos = position;
        this.innerContext.executePreviewProcess = true;
      } else if (mouseEvent.type === "mouseup" && mouseEvent.button === 0) {
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
      if (mouseEvent.type === "mousemove") {
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
      // TODO: 平滑化を行う...特にdBスケールにするのであれば他も見直す必要がある
      void context.setVolumeEditData({
        volumeArray: context.previewVolumeEdit.value.data,
        startFrame: context.previewVolumeEdit.value.startFrame,
        trackId: this.trackId,
      });
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

    // TODO: 補間処理を実装する...表示含めスケールを先に決める必要ありそう
    // まずはUIが動くようにのみする
    const cursorFrame = this.currentCursorPos.frame;
    const cursorAmplitude = this.currentCursorPos.amplitude;

    const temp = {
      ...context.previewVolumeEdit.value,
      data: [...context.previewVolumeEdit.value.data],
    };

    // TODO: 以下の補間は最低限...UIにあわせ修正する予定

    // 開始フレームがカーソルフレームより後ろの場合は、カーソルフレームまで前方拡張
    if (temp.startFrame > cursorFrame) {
      const prependLength = temp.startFrame - cursorFrame;
      const prepend = createArray(
        prependLength,
        () => temp.data[0] ?? cursorAmplitude,
      );
      temp.data = prepend.concat(temp.data);
      temp.startFrame = cursorFrame;
    }

    // 最後のフレームがカーソルフレームより前の場合は、カーソルフレームまで後方拡張
    const lastFrame = temp.startFrame + temp.data.length - 1;
    if (lastFrame < cursorFrame) {
      const appendLength = cursorFrame - lastFrame;
      const append = createArray(
        appendLength,
        () => temp.data[temp.data.length - 1] ?? cursorAmplitude,
      );
      temp.data = temp.data.concat(append);
    }

    temp.data[cursorFrame - temp.startFrame] = cursorAmplitude;

    context.previewVolumeEdit.value = temp;
    this.innerContext.prevCursorPos = this.currentCursorPos;
  }
}
