import { getOrThrow } from "@/helpers/mapHelper";
import { State, SetNextState } from "@/sing/stateMachine";
import { getButton, PREVIEW_SOUND_DURATION } from "@/sing/viewHelper";
import { Note } from "@/store/type";
import { TrackId, NoteId } from "@/type/preload";
import {
  Context,
  getGuideLineTicks,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
} from "@/components/Sing/sequencerStateMachine/common";
import { clamp } from "@/sing/utility";

export class ResizeNoteLeftState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "resizeNoteLeft";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly targetNoteIds: Set<NoteId>;
  private readonly mouseDownNoteId: NoteId;

  private currentCursorPos: PositionOnSequencer;

  private innerContext:
    | {
        targetNotesAtStart: Map<NoteId, Note>;
        previewRequestId: number;
        executePreviewProcess: boolean;
        edited: boolean;
        guideLineTicksAtStart: number;
      }
    | undefined;

  constructor(args: {
    cursorPosAtStart: PositionOnSequencer;
    targetTrackId: TrackId;
    targetNoteIds: Set<NoteId>;
    mouseDownNoteId: NoteId;
  }) {
    if (!args.targetNoteIds.has(args.mouseDownNoteId)) {
      throw new Error("mouseDownNoteId is not included in targetNoteIds.");
    }
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;
    this.targetNoteIds = args.targetNoteIds;
    this.mouseDownNoteId = args.mouseDownNoteId;

    this.currentCursorPos = args.cursorPosAtStart;
  }

  private previewResizeLeft(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const snapTicks = context.snapTicks.value;
    const previewNotes = context.previewNotes.value;
    const targetNotesAtStart = this.innerContext.targetNotesAtStart;
    const mouseDownNote = getOrThrow(targetNotesAtStart, this.mouseDownNoteId);
    const dragTicks = this.currentCursorPos.ticks - this.cursorPosAtStart.ticks;
    const notePos = mouseDownNote.position;
    const newNotePos =
      Math.round((notePos + dragTicks) / snapTicks) * snapTicks;
    const movingTicks = newNotePos - notePos;

    const editedNotes = new Map<NoteId, Note>();
    for (const note of previewNotes) {
      const targetNoteAtStart = getOrThrow(targetNotesAtStart, note.id);
      const notePos = targetNoteAtStart.position;
      const noteEndPos =
        targetNoteAtStart.position + targetNoteAtStart.duration;
      const position = clamp(notePos + movingTicks, 0, noteEndPos - snapTicks);
      const duration = noteEndPos - position;

      if (note.position !== position || note.duration !== duration) {
        editedNotes.set(note.id, { ...note, position, duration });
      }
    }
    if (editedNotes.size !== 0) {
      context.previewNotes.value = previewNotes.map((value) => {
        return editedNotes.get(value.id) ?? value;
      });
      this.innerContext.edited = true;
    }

    context.guideLineTicks.value = newNotePos;
  }

  onEnter(context: Context) {
    const guideLineTicks = getGuideLineTicks(this.cursorPosAtStart, context);
    const targetNotesArray = context.notesInSelectedTrack.value.filter(
      (value) => this.targetNoteIds.has(value.id),
    );
    const targetNotesMap = new Map<NoteId, Note>();
    for (const targetNote of targetNotesArray) {
      targetNotesMap.set(targetNote.id, targetNote);
    }

    context.previewNotes.value = [...targetNotesArray];
    context.nowPreviewing.value = true;

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewResizeLeft(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
      targetNotesAtStart: targetNotesMap,
      executePreviewProcess: false,
      previewRequestId,
      edited: false,
      guideLineTicksAtStart: guideLineTicks,
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
      } else if (
        input.mouseEvent.type === "mouseup" &&
        mouseButton === "LEFT_BUTTON"
      ) {
        setNextState("idle", undefined);
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

    void context.store.actions.COMMAND_UPDATE_NOTES({
      notes: previewNotes,
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
