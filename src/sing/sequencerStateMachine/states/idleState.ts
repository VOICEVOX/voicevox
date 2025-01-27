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

export class IdleState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "idle";

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

    if (context.editTarget.value === "NOTE") {
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
            });
          } else {
            void context.store.actions.DESELECT_ALL_NOTES();
            setNextState("addNote", {
              cursorPosAtStart: input.cursorPos,
              targetTrackId: selectedTrackId,
            });
          }
        } else if (input.targetArea === "Note") {
          executeNotesSelectionProcess(context, input.mouseEvent, input.note);
          setNextState("moveNote", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
            targetNoteIds: context.selectedNoteIds.value,
            mouseDownNoteId: input.note.id,
          });
        } else if (input.targetArea === "NoteLeftEdge") {
          executeNotesSelectionProcess(context, input.mouseEvent, input.note);
          setNextState("resizeNoteLeft", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
            targetNoteIds: context.selectedNoteIds.value,
            mouseDownNoteId: input.note.id,
          });
        } else if (input.targetArea === "NoteRightEdge") {
          executeNotesSelectionProcess(context, input.mouseEvent, input.note);
          setNextState("resizeNoteRight", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
            targetNoteIds: context.selectedNoteIds.value,
            mouseDownNoteId: input.note.id,
          });
        }
      }
    } else if (context.editTarget.value === "PITCH") {
      if (
        input.mouseEvent.type === "mousedown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "SequencerBody"
      ) {
        // TODO: Ctrlが押されているときではなく、
        //       ピッチ削除ツールのときにErasePitchStateに遷移するようにする
        if (isOnCommandOrCtrlKeyDown(input.mouseEvent)) {
          setNextState("erasePitch", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
          });
        } else {
          setNextState("drawPitch", {
            cursorPosAtStart: input.cursorPos,
            targetTrackId: selectedTrackId,
          });
        }
      }
    }
  }

  onExit() {}
}
