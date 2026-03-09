import type {
  ParameterPanelStateDefinitions,
  ParameterPanelInput,
  ParameterPanelContext,
} from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";

export class DrawVolumeIdleState implements State<
  ParameterPanelStateDefinitions,
  ParameterPanelInput,
  ParameterPanelContext
> {
  readonly id = "drawVolumeIdle";

  onEnter(context: ParameterPanelContext) {
    context.cursorState.value = "DRAW";
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
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const trackId = context.selectedTrackId.value;

      if (
        input.pointerEvent.type === "pointerdown" &&
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

  onExit(context: ParameterPanelContext) {
    context.cursorState.value = "UNSET";
  }
}
