import { watch, WatchHandle } from "vue";
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

  private watchHandle: WatchHandle | undefined;

  onEnter(context: Context) {
    this.watchHandle = watch(context.isCommandOrCtrlKeyDown, (value) => {
      if (value) {
        context.cursorState.value = "ERASE";
      } else {
        context.cursorState.value = "DRAW";
      }
    });
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

  onExit() {
    if (this.watchHandle == undefined) {
      throw new Error("unwatch is undefined.");
    }
    this.watchHandle.stop();
  }
}
