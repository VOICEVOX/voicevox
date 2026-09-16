import type { SetNextState, State } from "@/song/stateMachine";
import type {
  Context,
  Input,
  SequencerStateDefinitions,
} from "@/song/sequencerStateMachine/common";
import { getButton } from "@/song/viewHelper";

export class ErasePitchToolIdleState implements State<
  SequencerStateDefinitions,
  Input,
  Context
> {
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
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const selectedTrackId = context.selectedTrackId.value;

      if (
        input.pointerEvent.type === "pointerdown" &&
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
