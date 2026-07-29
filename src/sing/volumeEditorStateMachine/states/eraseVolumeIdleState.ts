import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";
import { findVolumeEditableFrameRange } from "@/sing/volumeEditRanges";

export class EraseVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.tooltipData.value = undefined;
    context.highlightedEditableRange.value = undefined;
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
      context.highlightedEditableRange.value = undefined;
      return;
    }

    const { position } = pointerInfo;
    const editableRange = findVolumeEditableFrameRange(
      position.frame,
      context.getEditableFrameRanges(),
    );
    const isEditable = editableRange != undefined;
    context.cursorState.value = isEditable ? "ERASE" : "NOT_ALLOWED";
    context.highlightedEditableRange.value = editableRange;

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON" &&
      isEditable
    ) {
      setNextState("eraseVolume", {
        startPosition: position,
        targetTrackId: context.selectedTrackId.value,
        returnStateId: this.id,
      });
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.tooltipData.value = undefined;
    context.highlightedEditableRange.value = undefined;
  }
}
