import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  PositionOnVolumeEditor,
} from "../common";
import { updateCursorStateForEditableRange } from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class EraseVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "ERASE";
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
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const trackId = context.selectedTrackId.value;
      const isEditable =
        input.targetArea === "Editor" &&
        input.pointerEvent.type !== "pointerleave"
          ? this.updateCursorState(context, input.position)
          : false;

      if (
        input.targetArea === "Editor" &&
        input.pointerEvent.type === "pointerleave"
      ) {
        context.cursorState.value = "ERASE";
      }

      if (
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "Editor" &&
        isEditable
      ) {
        setNextState("eraseVolume", {
          startPosition: input.position,
          targetTrackId: trackId,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
  }

  private updateCursorState(
    context: VolumeEditorContext,
    position: PositionOnVolumeEditor,
  ) {
    return updateCursorStateForEditableRange(context, position, "ERASE");
  }
}
