import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";
import { isFrameInVolumeEditableRange } from "@/sing/volumeEditRanges";

export class EraseVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
    context.tooltipData.value = undefined;
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
      return;
    }

    const { position } = pointerInfo;
    const isEditable = isFrameInVolumeEditableRange(
      position.frame,
      context.getEditableFrameRanges(),
    );
    context.cursorState.value = isEditable ? "ERASE" : "NOT_ALLOWED";

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
  }
}
