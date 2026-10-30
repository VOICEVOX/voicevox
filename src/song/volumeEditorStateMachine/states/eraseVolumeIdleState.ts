import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import type { SetNextState, State } from "@/song/stateMachine";
import { getButton } from "@/song/viewHelper";
import { findVolumeEditableFrameRange } from "@/song/volumeEditRanges";

export class EraseVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolumeIdle";

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
      context.highlightedFrame.value = undefined;
      context.hoverPointer.value = undefined;
      return;
    }

    const editableRange = findVolumeEditableFrameRange(
      cursorPos.frame,
      context.getEditableFrameRanges(),
    );
    const isEditable = editableRange != undefined;
    context.cursorState.value = "ERASE";
    context.highlightedFrame.value = isEditable ? cursorPos.frame : undefined;
    context.hoverPointer.value = isEditable
      ? { x: cursorPos.x, y: cursorPos.y }
      : undefined;

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON"
    ) {
      setNextState("eraseVolume", {
        cursorPosAtStart: cursorPos,
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
