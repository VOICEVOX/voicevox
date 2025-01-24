import { SetNextState, State } from "@/sing/stateMachine";
import {
  Context,
  getGuideLineTicks,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/components/Sing/sequencerStateMachine/common";
import { NoteId, TrackId } from "@/type/preload";
import { Note } from "@/store/type";
import {
  getButton,
  getDoremiFromNoteNumber,
  PREVIEW_SOUND_DURATION,
} from "@/sing/viewHelper";
import { clamp } from "@/sing/utility";

export class AddNoteState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "addNote";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;

  private currentCursorPos: PositionOnSequencer;
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
  }) {
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;

    this.currentCursorPos = args.cursorPosAtStart;
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

  onEnter(context: Context) {
    const guideLineTicks = getGuideLineTicks(this.cursorPosAtStart, context);
    const noteToAdd = {
      id: NoteId(crypto.randomUUID()),
      position: Math.max(0, guideLineTicks),
      duration: context.snapTicks.value,
      noteNumber: clamp(this.cursorPosAtStart.noteNumber, 0, 127),
      lyric: getDoremiFromNoteNumber(this.cursorPosAtStart.noteNumber),
    };

    context.previewNotes.value = [noteToAdd];
    context.nowPreviewing.value = true;

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
    const mouseButton = getButton(input.mouseEvent);
    if (input.targetArea === "SequencerBody") {
      if (input.mouseEvent.type === "mousemove") {
        this.currentCursorPos = input.cursorPos;
        this.innerContext.executePreviewProcess = true;
      } else if (input.mouseEvent.type === "mouseup") {
        if (mouseButton === "LEFT_BUTTON") {
          setNextState("idle", undefined);
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
    context.previewNotes.value = [];
    context.nowPreviewing.value = false;
  }
}
