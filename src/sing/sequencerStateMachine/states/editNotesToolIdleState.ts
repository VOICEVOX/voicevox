import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  getGuideLineTicks,
  Input,
  selectNotesInRange,
  selectOnlyThisNoteAndPlayPreviewSound,
  SequencerStateDefinitions,
  toggleNoteSelection,
} from "@/sing/sequencerStateMachine/common";
import { getButton, isSelfEventTarget } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import type { Note } from "@/domain/project/type";

export class EditNotesToolIdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "editNotesToolIdle";

  onEnter(context: Context) {
    this.updateCursorState(
      context,
      context.isCommandOrCtrlKeyDown.value,
      context.isShiftKeyDown.value,
    );
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
        input.keyboardEvent.shiftKey,
      );
    } else if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);
      const selectedTrackId = context.selectedTrackId.value;

      if (
        input.targetArea === "Window" &&
        input.mouseEvent.type === "mousemove"
      ) {
        context.guideLineTicks.value = getGuideLineTicks(
          input.cursorPos,
          context,
        );
      }

      if (mouseButton === "LEFT_BUTTON") {
        if (isSelfEventTarget(input.mouseEvent)) {
          if (input.mouseEvent.type === "mousedown") {
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
              this.executeNotesSelectionProcess(
                context,
                input.mouseEvent,
                input.note,
              );
              setNextState("moveNote", {
                cursorPosAtStart: input.cursorPos,
                targetTrackId: selectedTrackId,
                targetNoteIds: context.selectedNoteIds.value,
                mouseDownNoteId: input.note.id,
                returnStateId: this.id,
              });
            } else if (input.targetArea === "NoteLeftEdge") {
              this.executeNotesSelectionProcess(
                context,
                input.mouseEvent,
                input.note,
              );
              setNextState("resizeNoteLeft", {
                cursorPosAtStart: input.cursorPos,
                targetTrackId: selectedTrackId,
                targetNoteIds: context.selectedNoteIds.value,
                mouseDownNoteId: input.note.id,
                returnStateId: this.id,
              });
            } else if (input.targetArea === "NoteRightEdge") {
              this.executeNotesSelectionProcess(
                context,
                input.mouseEvent,
                input.note,
              );
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

        if (
          input.mouseEvent.type === "dblclick" &&
          input.targetArea === "Note"
        ) {
          setNextState("editNoteLyric", {
            targetTrackId: selectedTrackId,
            editStartNoteId: input.note.id,
            returnStateId: this.id,
          });
        }
      }
    }
  }

  onExit(context: Context) {
    context.cursorState.value = "UNSET";
  }

  private updateCursorState(
    context: Context,
    isCommandOrCtrlKeyDown: boolean,
    isShiftKeyDown: boolean,
  ) {
    if (isShiftKeyDown) {
      context.cursorState.value = "CROSSHAIR";
    } else if (isCommandOrCtrlKeyDown) {
      context.cursorState.value = "UNSET";
    } else {
      context.cursorState.value = "DRAW";
    }
  }

  private executeNotesSelectionProcess(
    context: Context,
    mouseEvent: MouseEvent,
    mouseDownNote: Note,
  ) {
    if (mouseEvent.shiftKey) {
      selectNotesInRange(context, mouseDownNote);
    } else if (isOnCommandOrCtrlKeyDown(mouseEvent)) {
      toggleNoteSelection(context, mouseDownNote);
    } else if (!context.selectedNoteIds.value.has(mouseDownNote.id)) {
      selectOnlyThisNoteAndPlayPreviewSound(context, mouseDownNote);
    }
  }
}
