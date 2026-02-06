import type { SetNextState, State } from "@/sing/stateMachine";
import type {
  Context,
  IdleStateId,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { getButton, noteNumberToBaseY, tickToBaseX } from "@/sing/viewHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import type { NoteId } from "@/type/preload";
import { frequencyToNoteNumber } from "@/sing/music";

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

  onEnter(context: Context) {
    this.updatePreviewRect(context);

    context.cursorState.value = "CROSSHAIR";
    // TODO: ScoreSequencer.vueのコードをnowPreview == trueを考慮したコードにする
    context.previewMode.value = "SELECT_NOTES_WITH_RECT";
    context.enableAutoScrollOnEdge.value = true;
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

      if (input.targetArea === "Window") {
        if (input.pointerEvent.type === "pointermove") {
          this.currentCursorPos = input.cursorPos;
          this.updatePreviewRect(context);
        } else if (
          input.pointerEvent.type === "pointerup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = true;
          this.additive = isOnCommandOrCtrlKeyDown(input.pointerEvent);
          setNextState(this.returnStateId, undefined);
        }
      }
    } else if (input.type === "scrollEvent") {
      this.updatePreviewRect(context);
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
    context.enableAutoScrollOnEdge.value = false;
  }

  private updatePreviewRect(context: Context) {
    const cursorNoteNumberAtStart = frequencyToNoteNumber(
      this.cursorPosAtStart.frequency,
    );
    const cursorBaseXAtStart = tickToBaseX(
      this.cursorPosAtStart.ticks,
      context.tpqn.value,
    );
    const cursorBaseYAtStart = noteNumberToBaseY(cursorNoteNumberAtStart);

    const viewportInfo = context.viewportInfo.value;
    const cursorXAtStart =
      cursorBaseXAtStart * viewportInfo.scaleX - viewportInfo.offsetX;
    const cursorYAtStart =
      cursorBaseYAtStart * viewportInfo.scaleY - viewportInfo.offsetY;

    const startX = Math.min(cursorXAtStart, this.currentCursorPos.x);
    const endX = Math.max(cursorXAtStart, this.currentCursorPos.x);
    const startY = Math.min(cursorYAtStart, this.currentCursorPos.y);
    const endY = Math.max(cursorYAtStart, this.currentCursorPos.y);

    context.previewRectForRectSelect.value = {
      x: startX,
      y: startY,
      width: Math.max(1, endX - startX),
      height: Math.max(1, endY - startY),
    };
  }
}
