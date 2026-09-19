import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import type { SetNextState, State } from "@/song/stateMachine";
import { getButton } from "@/song/viewHelper";
import { findVolumeEditableFrameRange } from "@/song/volumeEditRanges";

export class DrawVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "drawVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.tooltipData.value = undefined;
    context.highlightedFrame.value = undefined;
    context.hoverPointer.value = undefined;
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
    if (input.type !== "pointerEvent") {
      return;
    }
    if (input.targetArea !== "VolumeEditorArea") {
      return;
    }

    const { pointerEvent, pointerInfo } = input;

    if (pointerEvent.type === "pointerleave") {
      context.cursorState.value = "UNSET";
      context.highlightedFrame.value = undefined;
      context.hoverPointer.value = undefined;
      return;
    }

    const { position } = pointerInfo;
    const editableRange = findVolumeEditableFrameRange(
      position.frame,
      context.getEditableFrameRanges(),
    );
    const isEditable = editableRange != undefined;
    context.cursorState.value = isEditable ? "DRAW" : "NOT_ALLOWED";
    context.highlightedFrame.value = isEditable ? position.frame : undefined;
    context.hoverPointer.value = isEditable
      ? { x: pointerInfo.x, y: pointerInfo.y }
      : undefined;

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON" &&
      isEditable
    ) {
      setNextState("drawVolume", {
        startPosition: position,
        startTooltipData: {
          db: pointerInfo.db,
          pointerX: pointerInfo.x,
          pointerY: pointerInfo.y,
        },
        targetTrackId: context.selectedTrackId.value,
        returnStateId: this.id,
      });
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.tooltipData.value = undefined;
    context.highlightedFrame.value = undefined;
    context.hoverPointer.value = undefined;
  }
}
