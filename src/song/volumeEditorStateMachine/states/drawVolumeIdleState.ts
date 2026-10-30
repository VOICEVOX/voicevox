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
    context.showDrawFeedback.value = false;
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

    const { pointerEvent, cursorPos } = input;

    if (pointerEvent.type === "pointerleave") {
      context.cursorState.value = "UNSET";
      context.showDrawFeedback.value = false;
      context.highlightedFrame.value = undefined;
      context.hoverPointer.value = undefined;
      return;
    }

    const editableRange = findVolumeEditableFrameRange(
      cursorPos.frame,
      context.getEditableFrameRanges(),
    );
    const isEditable = editableRange != undefined;
    context.cursorState.value = isEditable ? "DRAW" : "NOT_ALLOWED";
    context.showDrawFeedback.value = isEditable;
    context.highlightedFrame.value = isEditable ? cursorPos.frame : undefined;
    context.hoverPointer.value = isEditable
      ? { x: cursorPos.x, y: cursorPos.y }
      : undefined;

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON" &&
      isEditable
    ) {
      setNextState("drawVolume", {
        cursorPosAtStart: cursorPos,
        startTooltipData: {
          db: cursorPos.db,
          pointerX: cursorPos.x,
          pointerY: cursorPos.y,
        },
        targetTrackId: context.selectedTrackId.value,
        returnStateId: this.id,
      });
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.showDrawFeedback.value = false;
    context.tooltipData.value = undefined;
    context.highlightedFrame.value = undefined;
    context.hoverPointer.value = undefined;
  }
}
