import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

export class DrawPitchToolIdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "drawPitchToolIdle";

  onEnter() {}

  process({
    input,
    context,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: SetNextState<SequencerStateDefinitions>;
  }) {
    const mouseButton = getButton(input.mouseEvent);
    const selectedTrackId = context.selectedTrackId.value;

    if (
      input.mouseEvent.type === "mousedown" &&
      mouseButton === "LEFT_BUTTON" &&
      input.targetArea === "SequencerBody"
    ) {
      if (isOnCommandOrCtrlKeyDown(input.mouseEvent)) {
        setNextState("erasePitch", {
          cursorPosAtStart: input.cursorPos,
          targetTrackId: selectedTrackId,
          returnStateId: this.id,
        });
      } else {
        setNextState("drawPitch", {
          cursorPosAtStart: input.cursorPos,
          targetTrackId: selectedTrackId,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit() {}
}
