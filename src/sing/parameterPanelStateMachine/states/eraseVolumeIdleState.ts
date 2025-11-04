import {
  ParameterPanelVolumeStateDefinitions,
  ParameterPanelVolumeInput,
  ParameterPanelVolumeContext,
} from "../common";
import { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class EraseVolumeIdleState
  implements
    State<
      ParameterPanelVolumeStateDefinitions,
      ParameterPanelVolumeInput,
      ParameterPanelVolumeContext
    >
{
  readonly id = "eraseVolumeIdle";

  onEnter(context: ParameterPanelVolumeContext) {
    context.cursorState.value = "ERASE";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: ParameterPanelVolumeInput;
    context: ParameterPanelVolumeContext;
    setNextState: SetNextState<ParameterPanelVolumeStateDefinitions>;
  }) {
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const trackId = context.selectedTrackId.value;

      if (
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "Editor"
      ) {
        setNextState("eraseVolume", {
          startPosition: input.position,
          targetTrackId: trackId,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit(context: ParameterPanelVolumeContext) {
    context.cursorState.value = "UNSET";
  }
}
