import {
  ParameterPanelStateDefinitions,
  ParameterPanelInput,
  ParameterPanelContext,
} from "../common";
import { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class EraseVolumeIdleState
  implements
    State<
      ParameterPanelStateDefinitions,
      ParameterPanelInput,
      ParameterPanelContext
    >
{
  readonly id = "eraseVolumeIdle";

  onEnter(context: ParameterPanelContext) {
    context.cursorState.value = "ERASE";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: ParameterPanelInput;
    context: ParameterPanelContext;
    setNextState: SetNextState<ParameterPanelStateDefinitions>;
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

  onExit(context: ParameterPanelContext) {
    context.cursorState.value = "UNSET";
  }
}
