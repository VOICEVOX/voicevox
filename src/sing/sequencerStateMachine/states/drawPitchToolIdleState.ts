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

  onEnter(context: Context) {
    this.updateCursorState(context, context.isCommandOrCtrlKeyDown.value);
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
    if (input.type === "keyboardEvent") {
      this.updateCursorState(
        context,
        isOnCommandOrCtrlKeyDown(input.keyboardEvent),
      );
    } else if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const selectedTrackId = context.selectedTrackId.value;

      if (
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "SequencerBody"
      ) {
        if (isOnCommandOrCtrlKeyDown(input.pointerEvent)) {
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
  }

  onExit(context: Context) {
    context.cursorState.value = "UNSET";
  }

  private updateCursorState(context: Context, isCommandOrCtrlKeyDown: boolean) {
    if (isCommandOrCtrlKeyDown) {
      context.cursorState.value = "ERASE";
    } else {
      context.cursorState.value = "DRAW";
    }
  }
}
