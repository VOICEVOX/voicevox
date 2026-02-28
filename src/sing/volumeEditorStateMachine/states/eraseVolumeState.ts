import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  PositionOnVolumeEditor,
  VolumeEditorIdleStateId,
} from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import type { TrackId } from "@/type/preload";
import { getButton } from "@/sing/viewHelper";

export class EraseVolumeState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolume";

  private readonly cursorPosAtStart: PositionOnVolumeEditor;
  private readonly trackId: TrackId;
  private readonly returnStateId: VolumeEditorIdleStateId;

  private currentCursorPos: PositionOnVolumeEditor;
  private applyPreview: boolean;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
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
      type: "erase",
      startFrame: this.cursorPosAtStart.frame,
      frameLength: 1,
    };
    context.cursorState.value = "ERASE";
    context.previewMode.value = "VOLUME_ERASE";

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewEraseVolume(context);
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
    if (context.previewVolumeEdit.value.type !== "erase") {
      throw new Error("previewVolumeEdit.type is not erase.");
    }

    if (input.type === "mouseEvent") {
      const { mouseEvent, position, targetArea } = input;
      const mouseButton = getButton(mouseEvent);

      if (targetArea === "Window") {
        if (mouseEvent.type === "mousemove") {
          this.currentCursorPos = position;
          this.innerContext.executePreviewProcess = true;
        } else if (
          mouseEvent.type === "mouseup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = true;
          setNextState(this.returnStateId, undefined);
        }
      } else if (targetArea === "Editor" && mouseEvent.type === "mousemove") {
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
    if (context.previewVolumeEdit.value.type !== "erase") {
      throw new Error("previewVolumeEdit.type is not erase.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);
    this.innerContext = undefined;

    if (this.applyPreview) {
      void context.store.actions.COMMAND_ERASE_VOLUME_EDIT_DATA({
        startFrame: context.previewVolumeEdit.value.startFrame,
        frameLength: context.previewVolumeEdit.value.frameLength,
        trackId: this.trackId,
      });
    }

    context.previewVolumeEdit.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }

  private previewEraseVolume(context: VolumeEditorContext) {
    if (context.previewVolumeEdit.value == undefined) {
      throw new Error("previewVolumeEdit.value is undefined.");
    }
    if (context.previewVolumeEdit.value.type !== "erase") {
      throw new Error("previewVolumeEdit.value.type is not erase.");
    }

    const cursorFrame = Math.max(0, this.currentCursorPos.frame);
    const temp = { ...context.previewVolumeEdit.value };

    // 開始フレームがカーソルフレームより後ろの場合は、カーソルフレームまでの長さを追加する
    if (temp.startFrame > cursorFrame) {
      temp.frameLength += temp.startFrame - cursorFrame;
      temp.startFrame = cursorFrame;
    }

    // 最後のフレームがカーソルフレームより前の場合は、カーソルフレームまでの長さを追加する
    const lastFrame = temp.startFrame + temp.frameLength - 1;
    if (lastFrame < cursorFrame) {
      temp.frameLength += cursorFrame - lastFrame;
    }

    context.previewVolumeEdit.value = temp;
  }
}
