import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  PositionOnVolumeEditor,
} from "../common";
import { updateCursorStateForEditableRange } from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class DrawVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "drawVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "DRAW";
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
        context.cursorState.value = "DRAW";
      }

      if (
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "Editor" &&
        isEditable
      ) {
        setNextState("drawVolume", {
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
    return updateCursorStateForEditableRange(context, position, "DRAW");
  }
}
