import {
  ParameterPanelVolumeStateDefinitions,
  ParameterPanelVolumeInput,
  ParameterPanelVolumeContext,
} from "../common";
import { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class DrawVolumeIdleState
  implements
    State<
      ParameterPanelVolumeStateDefinitions,
      ParameterPanelVolumeInput,
      ParameterPanelVolumeContext
    >
{
  readonly id = "drawVolumeIdle";

  onEnter(context: ParameterPanelVolumeContext) {
    context.cursorState.value = "DRAW";
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
        setNextState("drawVolume", {
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
