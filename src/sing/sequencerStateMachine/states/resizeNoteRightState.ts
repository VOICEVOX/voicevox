import { State, SetNextState } from "@/sing/stateMachine";
import { getButton, PREVIEW_SOUND_DURATION } from "@/sing/viewHelper";
import { NoteId, TrackId } from "@/type/preload";
import {
  Context,
  getGuideLineTicks,
  IdleStateId,
  Input,
  PositionOnSequencer,
  SequencerStateDefinitions,
  shouldStartDrag,
} from "@/sing/sequencerStateMachine/common";
import type { Note } from "@/domain/project/type";
import { getOrThrow } from "@/helpers/mapHelper";

export class ResizeNoteRightState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "resizeNoteRight";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly targetNoteIds: Set<NoteId>;
  private readonly mouseDownNoteId: NoteId;
  private readonly returnStateId: IdleStateId;

  private currentCursorPos: PositionOnSequencer;
  private dragging: boolean;
  private applyPreview: boolean;

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
    returnStateId: IdleStateId;
  }) {
    if (!args.targetNoteIds.has(args.mouseDownNoteId)) {
      throw new Error("mouseDownNoteId is not included in targetNoteIds.");
    }
    this.cursorPosAtStart = args.cursorPosAtStart;
    this.targetTrackId = args.targetTrackId;
    this.targetNoteIds = args.targetNoteIds;
    this.mouseDownNoteId = args.mouseDownNoteId;
    this.returnStateId = args.returnStateId;

    this.currentCursorPos = args.cursorPosAtStart;
    this.dragging = false;
    this.applyPreview = false;
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
    const mouseDownNote = getOrThrow(targetNotesMap, this.mouseDownNoteId);
    const noteEndPos = mouseDownNote.position + mouseDownNote.duration;

    context.previewNotes.value = [...targetNotesArray];
    context.cursorState.value = "EW_RESIZE";
    context.guideLineTicks.value = noteEndPos;
    context.previewMode.value = "RESIZE_NOTE_RIGHT";
    context.enableAutoScrollOnEdge.value = true;

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewResizeRight(context);
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
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);

      if (input.targetArea === "Window") {
        if (input.pointerEvent.type === "pointermove") {
          this.currentCursorPos = input.cursorPos;
          if (
            !this.dragging &&
            shouldStartDrag(this.cursorPosAtStart, this.currentCursorPos)
          ) {
            this.dragging = true;
          }
          if (this.dragging) {
            this.innerContext.executePreviewProcess = true;
          }
        } else if (
          input.pointerEvent.type === "pointerup" &&
          mouseButton === "LEFT_BUTTON"
        ) {
          this.applyPreview = this.innerContext.edited;
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
      void context.store.actions.COMMAND_UPDATE_NOTES({
        notes: previewNotes,
        trackId: this.targetTrackId,
      });
      void context.store.actions.SELECT_NOTES({
        noteIds: previewNoteIds,
      });

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

  private previewResizeRight(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const snapTicks = context.snapTicks.value;
    const previewNotes = context.previewNotes.value;
    const targetNotesAtStart = this.innerContext.targetNotesAtStart;
    const mouseDownNote = getOrThrow(targetNotesAtStart, this.mouseDownNoteId);
    const dragTicks = this.currentCursorPos.ticks - this.cursorPosAtStart.ticks;
    const noteEndPos = mouseDownNote.position + mouseDownNote.duration;
    const newNoteEndPos =
      Math.round((noteEndPos + dragTicks) / snapTicks) * snapTicks;
    const movingTicks = newNoteEndPos - noteEndPos;

    const editedNotes = new Map<NoteId, Note>();
    for (const note of previewNotes) {
      const targetNoteAtStart = getOrThrow(targetNotesAtStart, note.id);
      const notePos = targetNoteAtStart.position;
      const noteEndPos =
        targetNoteAtStart.position + targetNoteAtStart.duration;
      const duration = Math.max(snapTicks, noteEndPos + movingTicks - notePos);

      if (note.duration !== duration) {
        editedNotes.set(note.id, { ...note, duration });
      }
    }
    if (editedNotes.size !== 0) {
      context.previewNotes.value = previewNotes.map((value) => {
        return editedNotes.get(value.id) ?? value;
      });
      this.innerContext.edited = true;
    }

    context.guideLineTicks.value = newNoteEndPos;
  }
}
