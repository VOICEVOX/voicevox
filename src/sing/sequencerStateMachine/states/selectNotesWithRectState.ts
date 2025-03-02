import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  IdleStateId,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { NoteId } from "@/type/preload";

export class SelectNotesWithRectState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "selectNotesWithRect";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: PositionOnSequencer;
  private applyPreview: boolean;
  private additive: boolean;

  constructor(args: {
    cursorPosAtStart: PositionOnSequencer;
    returnStateId: IdleStateId;
  }) {
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.returnStateId = args.returnStateId;

    this.currentCursorPos = args.cursorPosAtStart;
    this.applyPreview = false;
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

    context.cursorState.value = "CROSSHAIR";
    // TODO: ScoreSequencer.vueのコードをnowPreview == trueを考慮したコードにする
    context.previewMode.value = "SELECT_NOTES_WITH_RECT";
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
    if (input.type === "mouseEvent") {
      const mouseButton = getButton(input.mouseEvent);

      if (input.targetArea === "Window") {
        if (input.mouseEvent.type === "mousemove") {
          this.currentCursorPos = input.cursorPos;
          this.updatePreviewRect(context);
        } else if (
          input.mouseEvent.type === "mouseup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = true;
          this.additive = isOnCommandOrCtrlKeyDown(input.mouseEvent);
          setNextState(this.returnStateId, undefined);
        }
      }
    }
  }

  onExit(context: Context) {
    if (this.applyPreview) {
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

    context.previewRectForRectSelect.value = undefined;
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
  }
}
