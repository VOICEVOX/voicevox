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
import {
  getButton,
  isSelfEventTarget,
  PREVIEW_SOUND_DURATION,
} from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import type { Note } from "@/domain/project/type";
import { NoteId } from "@/type/preload";
import { clamp } from "@/sing/utility";
import { uuid4 } from "@/helpers/random";

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
              setNextState("selectNotesWithRect", {
                cursorPosAtStart: input.cursorPos,
                returnStateId: this.id,
              });
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
          } else if (
            input.mouseEvent.type === "dblclick" &&
            input.targetArea === "SequencerBody"
          ) {
            void context.store.actions.DESELECT_ALL_NOTES();

            const guideLineTicks = getGuideLineTicks(input.cursorPos, context);
            const noteToAdd = {
              id: NoteId(uuid4()),
              position: Math.max(0, guideLineTicks),
              duration: context.snapTicks.value,
              noteNumber: clamp(input.cursorPos.noteNumber, 0, 127),
              lyric: undefined,
            };

            void context.store.actions.COMMAND_ADD_NOTES({
              notes: [noteToAdd],
              trackId: selectedTrackId,
            });
            void context.store.actions.SELECT_NOTES({
              noteIds: [noteToAdd.id],
            });

            void context.store.actions.PLAY_PREVIEW_SOUND({
              noteNumber: noteToAdd.noteNumber,
              duration: PREVIEW_SOUND_DURATION,
            });
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

  private updateCursorState(context: Context, isShiftKeyDown: boolean) {
    if (isShiftKeyDown) {
      context.cursorState.value = "CROSSHAIR";
    } else {
      context.cursorState.value = "UNSET";
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
