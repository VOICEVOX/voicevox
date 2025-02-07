import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  executeNotesSelectionProcess,
  getGuideLineTicks,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton, isSelfEventTarget } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

export class EditNotesToolIdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "editNotesToolIdle";

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
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        isSelfEventTarget(input.mouseEvent)
      ) {
        if (input.targetArea === "SequencerBody") {
          if (input.mouseEvent.shiftKey) {
            setNextState("selectNotesWithRect", {
              cursorPosAtStart: input.cursorPos,
              returnStateId: this.id,
            });
          } else if (isOnCommandOrCtrlKeyDown(input.mouseEvent)) {
            void context.store.actions.DESELECT_ALL_NOTES();
          } else {
            void context.store.actions.DESELECT_ALL_NOTES();
            setNextState("addNote", {
              cursorPosAtStart: input.cursorPos,
              targetTrackId: selectedTrackId,
              returnStateId: this.id,
            });
          }
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
      }
    }
  }

  onExit() {}

  private updateCursorState(context: Context, isCommandOrCtrlKeyDown: boolean) {
    if (isCommandOrCtrlKeyDown) {
      context.cursorState.value = "UNSET";
    } else {
      context.cursorState.value = "DRAW";
    }
  }
}
