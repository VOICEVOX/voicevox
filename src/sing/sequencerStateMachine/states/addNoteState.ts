import type { SetNextState, State } from "@/sing/stateMachine";
import {
  type Context,
  getGuideLineTicks,
  type IdleStateId,
  type Input,
  type PositionOnSequencer,
  type SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { NoteId, type TrackId } from "@/type/preload";
import type { Note } from "@/domain/project/type";
import { getButton, PREVIEW_SOUND_DURATION } from "@/sing/viewHelper";
import { clamp } from "@/sing/utility";
import { uuid4 } from "@/helpers/random";

export class AddNoteState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "addNote";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: PositionOnSequencer;
  private applyPreview: boolean;

  private innerContext:
    | {
        noteToAdd: Note;
        previewRequestId: number;
        executePreviewProcess: boolean;
      }
    | undefined;

  constructor(args: {
    cursorPosAtStart: PositionOnSequencer;
    targetTrackId: TrackId;
    returnStateId: IdleStateId;
  }) {
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;
    this.returnStateId = args.returnStateId;

    this.currentCursorPos = args.cursorPosAtStart;
    this.applyPreview = false;
  }

  onEnter(context: Context) {
    const guideLineTicks = getGuideLineTicks(this.cursorPosAtStart, context);
    const noteToAdd = {
      id: NoteId(uuid4()),
      position: Math.max(0, guideLineTicks),
      duration: context.snapTicks.value,
      noteNumber: clamp(this.cursorPosAtStart.noteNumber, 0, 127),
      lyric: undefined,
    };
    const noteEndPos = noteToAdd.position + noteToAdd.duration;

    context.previewNotes.value = [noteToAdd];
    context.cursorState.value = "DRAW";
    context.guideLineTicks.value = noteEndPos;
    context.previewMode.value = "ADD_NOTE";
    context.enableAutoScrollOnEdge.value = true;

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewAdd(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
      noteToAdd,
      executePreviewProcess: false,
      previewRequestId,
    };
  }

  process({
    input,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: SetNextState<SequencerStateDefinitions>;
  }) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);

      if (input.targetArea === "Window") {
        if (input.pointerEvent.type === "pointermove") {
          this.currentCursorPos = input.cursorPos;
          this.innerContext.executePreviewProcess = true;
        } else if (
          input.pointerEvent.type === "pointerup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = true;
          setNextState(this.returnStateId, undefined);
        }
      }
    }
  }

  onExit(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const previewNotes = context.previewNotes.value;
    const previewNoteIds = previewNotes.map((value) => value.id);

    cancelAnimationFrame(this.innerContext.previewRequestId);

    if (this.applyPreview) {
      void context.store.actions.COMMAND_ADD_NOTES({
        notes: context.previewNotes.value,
        trackId: this.targetTrackId,
      });
      void context.store.actions.SELECT_NOTES({ noteIds: previewNoteIds });

      if (previewNotes.length === 1) {
        void context.store.actions.PLAY_PREVIEW_SOUND({
          noteNumber: previewNotes[0].noteNumber,
          duration: PREVIEW_SOUND_DURATION,
        });
      }
    }

    context.previewNotes.value = [];
    context.cursorState.value = "UNSET";
    context.previewMode.value = "IDLE";
    context.enableAutoScrollOnEdge.value = false;
  }

  private previewAdd(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const noteToAdd = this.innerContext.noteToAdd;
    const snapTicks = context.snapTicks.value;
    const dragTicks = this.currentCursorPos.ticks - this.cursorPosAtStart.ticks;
    const noteDuration = Math.round(dragTicks / snapTicks) * snapTicks;
    const noteEndPos = noteToAdd.position + noteDuration;
    const previewNotes = context.previewNotes.value;

    const editedNotes = new Map<NoteId, Note>();
    for (const note of previewNotes) {
      const duration = Math.max(snapTicks, noteDuration);
      if (note.duration !== duration) {
        editedNotes.set(note.id, { ...note, duration });
      }
    }
    if (editedNotes.size !== 0) {
      context.previewNotes.value = previewNotes.map((value) => {
        return editedNotes.get(value.id) ?? value;
      });
    }
    context.guideLineTicks.value = noteEndPos;
  }
}
