import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
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
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const trackId = context.selectedTrackId.value;

      if (
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "Editor"
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
}
