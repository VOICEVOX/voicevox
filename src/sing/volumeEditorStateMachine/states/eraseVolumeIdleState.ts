import {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  IdleStateId,
} from "../common";
import { SetNextState, State } from "@/sing/stateMachine";
import { TrackId } from "@/type/preload";
import { getButton } from "@/sing/viewHelper";

export class EraseVolumeIdleState
  implements
    State<VolumeEditorStateDefinitions, VolumeEditorInput, VolumeEditorContext>
{
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
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const trackId: TrackId = context.getSelectedTrackId();

      if (
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "Editor"
      ) {
        setNextState("eraseVolume", {
          startPosition: input.position,
          trackId,
          returnStateId: this.id as IdleStateId,
        });
      }
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
