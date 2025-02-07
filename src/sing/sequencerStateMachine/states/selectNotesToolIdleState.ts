import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  executeNotesSelectionProcess,
  getGuideLineTicks,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton, isSelfEventTarget } from "@/sing/viewHelper";

export class SelectNotesToolIdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "selectNotesToolIdle";

  onEnter(context: Context) {
    this.updateCursorState(context, context.isShiftKeyDown.value);
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
      this.updateCursorState(context, input.keyboardEvent.shiftKey);
    } else if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const selectedTrackId = context.selectedTrackId.value;

      if (input.targetArea === "SequencerBody") {
        context.guideLineTicks.value = getGuideLineTicks(
          input.cursorPos,
          context,
        );
      }

      if (
        mouseButton === "LEFT_BUTTON" &&
        isSelfEventTarget(input.mouseEvent)
      ) {
        if (input.mouseEvent.type === "mousedown") {
          if (input.targetArea === "SequencerBody") {
            setNextState("selectNotesWithRect", {
              cursorPosAtStart: input.cursorPos,
              returnStateId: this.id,
            });
          } else if (input.targetArea === "Note") {
            executeNotesSelectionProcess(context, input.mouseEvent, input.note);
            setNextState("moveNote", {
              cursorPosAtStart: input.cursorPos,
              targetTrackId: selectedTrackId,
              targetNoteIds: context.selectedNoteIds.value,
              mouseDownNoteId: input.note.id,
              returnStateId: this.id,
            });
          } else if (input.targetArea === "NoteLeftEdge") {
            executeNotesSelectionProcess(context, input.mouseEvent, input.note);
            setNextState("resizeNoteLeft", {
              cursorPosAtStart: input.cursorPos,
              targetTrackId: selectedTrackId,
              targetNoteIds: context.selectedNoteIds.value,
              mouseDownNoteId: input.note.id,
              returnStateId: this.id,
            });
          } else if (input.targetArea === "NoteRightEdge") {
            executeNotesSelectionProcess(context, input.mouseEvent, input.note);
            setNextState("resizeNoteRight", {
              cursorPosAtStart: input.cursorPos,
              targetTrackId: selectedTrackId,
              targetNoteIds: context.selectedNoteIds.value,
              mouseDownNoteId: input.note.id,
              returnStateId: this.id,
            });
          }
        } else if (input.mouseEvent.type === "dblclick") {
          void context.store.actions.DESELECT_ALL_NOTES();
          setNextState("addNote", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
            returnStateId: this.id,
          });
        }
      }
    }
  }

  onExit() {}

  private updateCursorState(context: Context, isShiftKeyDown: boolean) {
    if (isShiftKeyDown) {
      context.cursorState.value = "CROSSHAIR";
    } else {
      context.cursorState.value = "UNSET";
    }
  }
}
