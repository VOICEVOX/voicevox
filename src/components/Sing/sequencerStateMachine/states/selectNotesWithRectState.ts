import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/components/Sing/sequencerStateMachine/common";
import { getButton } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { NoteId } from "@/type/preload";

export class SelectNotesWithRectState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "selectNotesWithRect";

  private readonly cursorPosAtStart: PositionOnSequencer;

  private currentCursorPos: PositionOnSequencer;
  private additive: boolean;

  constructor(args: { cursorPosAtStart: PositionOnSequencer }) {
    this.cursorPosAtStart = args.cursorPosAtStart;

    this.currentCursorPos = args.cursorPosAtStart;
    this.additive = false;
  }

  private updatePreviewRect(context: Context) {
    const startX = Math.min(this.cursorPosAtStart.x, this.currentCursorPos.x);
    const endX = Math.max(this.cursorPosAtStart.x, this.currentCursorPos.x);
    const startY = Math.min(this.cursorPosAtStart.y, this.currentCursorPos.y);
    const endY = Math.max(this.cursorPosAtStart.y, this.currentCursorPos.y);

    context.previewRectForRectSelect.value = {
      x: startX,
      y: startY,
      width: Math.max(1, endX - startX),
      height: Math.max(1, endY - startY),
    };
  }

  onEnter(context: Context) {
    this.updatePreviewRect(context);
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
    if (input.targetArea === "SequencerBody") {
      if (input.mouseEvent.type === "mousemove") {
        this.currentCursorPos = input.cursorPos;
        this.updatePreviewRect(context);
      } else if (
        input.mouseEvent.type === "mouseup" &&
        mouseButton === "LEFT_BUTTON"
      ) {
        this.additive = isOnCommandOrCtrlKeyDown(input.mouseEvent);
        setNextState("idle", undefined);
      }
    }
  }

  onExit(context: Context) {
    context.previewRectForRectSelect.value = undefined;

    const startTicks = Math.min(
      this.cursorPosAtStart.ticks,
      this.currentCursorPos.ticks,
    );
    const endTicks = Math.max(
      this.cursorPosAtStart.ticks,
      this.currentCursorPos.ticks,
    );
    const startNoteNumber = Math.min(
      this.cursorPosAtStart.noteNumber,
      this.currentCursorPos.noteNumber,
    );
    const endNoteNumber = Math.max(
      this.cursorPosAtStart.noteNumber,
      this.currentCursorPos.noteNumber,
    );

    const noteIdsToSelect: NoteId[] = [];
    for (const note of context.notesInSelectedTrack.value) {
      if (
        note.position + note.duration >= startTicks &&
        note.position <= endTicks &&
        note.noteNumber >= startNoteNumber &&
        note.noteNumber <= endNoteNumber
      ) {
        noteIdsToSelect.push(note.id);
      }
    }
    if (!this.additive) {
      void context.store.actions.DESELECT_ALL_NOTES();
    }
    void context.store.actions.SELECT_NOTES({ noteIds: noteIdsToSelect });
  }
}
