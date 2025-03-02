import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton } from "@/sing/viewHelper";

export class ErasePitchToolIdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "erasePitchToolIdle";

  onEnter(context: Context) {
    context.cursorState.value = "UNSET";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: SetNextState<SequencerStateDefinitions>;
  }) {
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const selectedTrackId = context.selectedTrackId.value;

      if (
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "SequencerBody"
      ) {
        setNextState("erasePitch", {
          cursorPosAtStart: input.cursorPos,
          targetTrackId: selectedTrackId,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit(context: Context) {
    context.cursorState.value = "UNSET";
  }
}
