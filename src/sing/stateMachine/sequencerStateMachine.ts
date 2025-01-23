/**
 * このファイルのコードは実装中で、現在使われていません。
 * issue: https://github.com/VOICEVOX/voicevox/issues/2041
 */

import { computed, ComputedRef, ref, Ref } from "vue";
import {
  applyGaussianFilter,
  clamp,
  createArray,
  linearInterpolation,
  Rect,
} from "@/sing/utility";
import {
  State,
  SetNextState,
  StateMachine,
  StateDefinitions,
} from "@/sing/stateMachine/stateMachineBase";
import {
  getButton,
  getDoremiFromNoteNumber,
  isSelfEventTarget,
  PREVIEW_SOUND_DURATION,
} from "@/sing/viewHelper";
import { Note, SequencerEditTarget } from "@/store/type";
import { NoteId, TrackId } from "@/type/preload";
import { getOrThrow } from "@/helpers/mapHelper";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { getNoteDuration } from "@/sing/domain";
import { Store } from "@/store";

export type PositionOnSequencer = {
  readonly x: number;
  readonly y: number;
  readonly ticks: number;
  readonly noteNumber: number;
  readonly frame: number;
  readonly frequency: number;
};

type Input =
  | {
      readonly targetArea: "SequencerBody";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
    }
  | {
      readonly targetArea: "Note";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly targetArea: "NoteLeftEdge";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly targetArea: "NoteRightEdge";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    };

type ComputedRefs = {
  readonly snapTicks: ComputedRef<number>;
  readonly editTarget: ComputedRef<SequencerEditTarget>;
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly notesInSelectedTrack: ComputedRef<Note[]>;
  readonly selectedNoteIds: ComputedRef<Set<NoteId>>;
  readonly editorFrameRate: ComputedRef<number>;
};

type Refs = {
  readonly nowPreviewing: Ref<boolean>;
  readonly previewNotes: Ref<Note[]>;
  readonly previewRectForRectSelect: Ref<Rect | undefined>;
  readonly previewPitchEdit: Ref<
    | { type: "draw"; data: number[]; startFrame: number }
    | { type: "erase"; startFrame: number; frameLength: number }
    | undefined
  >;
  readonly guideLineTicks: Ref<number>;
};

type PartialStore = {
  state: Pick<
    Store["state"],
    "tpqn" | "sequencerSnapType" | "sequencerEditTarget" | "editorFrameRate"
  >;
  getters: Pick<
    Store["getters"],
    "SELECTED_TRACK_ID" | "SELECTED_TRACK" | "SELECTED_NOTE_IDS"
  >;
  actions: Pick<
    Store["actions"],
    | "SELECT_NOTES"
    | "DESELECT_NOTES"
    | "DESELECT_ALL_NOTES"
    | "PLAY_PREVIEW_SOUND"
    | "COMMAND_ADD_NOTES"
    | "COMMAND_UPDATE_NOTES"
    | "COMMAND_SET_PITCH_EDIT_DATA"
    | "COMMAND_ERASE_PITCH_EDIT_DATA"
  >;
};

type Context = ComputedRefs & Refs & { readonly store: PartialStore };

type SequencerStateDefinitions = StateDefinitions<
  [
    {
      id: "idle";
      factoryArgs: undefined;
    },
    {
      id: "addNote";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
      };
    },
    {
      id: "moveNote";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
      };
    },
    {
      id: "resizeNoteLeft";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
      };
    },
    {
      id: "resizeNoteRight";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
      };
    },
    {
      id: "selectNotesWithRect";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
      };
    },
    {
      id: "drawPitch";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
      };
    },
    {
      id: "erasePitch";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
      };
    },
  ]
>;

const getGuideLineTicks = (
  cursorPos: PositionOnSequencer,
  context: Context,
) => {
  const cursorTicks = cursorPos.ticks;
  const snapTicks = context.snapTicks.value;
  // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
  return Math.round(cursorTicks / snapTicks - 0.25) * snapTicks;
};

const selectOnlyThisNote = (context: Context, note: Note) => {
  void context.store.actions.DESELECT_ALL_NOTES();
  void context.store.actions.SELECT_NOTES({ noteIds: [note.id] });
};

/**
 * mousedown時のノート選択・選択解除の処理を実行する。
 */
const executeNotesSelectionProcess = (
  context: Context,
  mouseEvent: MouseEvent,
  mouseDownNote: Note,
) => {
  if (mouseEvent.shiftKey) {
    // Shiftキーが押されている場合は選択ノートまでの範囲選択
    let minIndex = context.notesInSelectedTrack.value.length - 1;
    let maxIndex = 0;
    for (let i = 0; i < context.notesInSelectedTrack.value.length; i++) {
      const noteId = context.notesInSelectedTrack.value[i].id;
      if (
        context.selectedNoteIds.value.has(noteId) ||
        noteId === mouseDownNote.id
      ) {
        minIndex = Math.min(minIndex, i);
        maxIndex = Math.max(maxIndex, i);
      }
    }
    const noteIdsToSelect: NoteId[] = [];
    for (let i = minIndex; i <= maxIndex; i++) {
      const noteId = context.notesInSelectedTrack.value[i].id;
      if (!context.selectedNoteIds.value.has(noteId)) {
        noteIdsToSelect.push(noteId);
      }
    }
    void context.store.actions.SELECT_NOTES({ noteIds: noteIdsToSelect });
  } else if (isOnCommandOrCtrlKeyDown(mouseEvent)) {
    // CommandキーかCtrlキーが押されている場合
    if (context.selectedNoteIds.value.has(mouseDownNote.id)) {
      // 選択中のノートなら選択解除
      void context.store.actions.DESELECT_NOTES({
        noteIds: [mouseDownNote.id],
      });
      return;
    }
    // 未選択のノートなら選択に追加
    void context.store.actions.SELECT_NOTES({ noteIds: [mouseDownNote.id] });
  } else if (!context.selectedNoteIds.value.has(mouseDownNote.id)) {
    // 選択中のノートでない場合は選択状態にする
    void selectOnlyThisNote(context, mouseDownNote);
    void context.store.actions.PLAY_PREVIEW_SOUND({
      noteNumber: mouseDownNote.noteNumber,
      duration: PREVIEW_SOUND_DURATION,
    });
  }
};

class IdleState implements State<SequencerStateDefinitions, Input, Context> {
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

class AddNoteState implements State<SequencerStateDefinitions, Input, Context> {
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

class MoveNoteState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "moveNote";

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

  private previewMove(context: Context) {
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
    const movingSemitones =
      this.currentCursorPos.noteNumber - this.cursorPosAtStart.noteNumber;

    const editedNotes = new Map<NoteId, Note>();
    for (const note of previewNotes) {
      const targetNoteAtStart = getOrThrow(targetNotesAtStart, note.id);
      const position = Math.max(0, targetNoteAtStart.position + movingTicks);
      const noteNumber = clamp(
        targetNoteAtStart.noteNumber + movingSemitones,
        0,
        127,
      );

      if (note.position !== position || note.noteNumber !== noteNumber) {
        editedNotes.set(note.id, { ...note, noteNumber, position });
      }
    }

    if (editedNotes.size !== 0) {
      context.previewNotes.value = previewNotes.map((value) => {
        return editedNotes.get(value.id) ?? value;
      });
      this.innerContext.edited = true;
    }

    context.guideLineTicks.value =
      this.innerContext.guideLineTicksAtStart + movingTicks;
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
        this.previewMove(context);
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
    context.previewNotes.value = [];
    context.nowPreviewing.value = false;
  }
}

class ResizeNoteLeftState
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

class ResizeNoteRightState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "resizeNoteRight";

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
    void context.store.actions.SELECT_NOTES({
      noteIds: previewNoteIds,
    });

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

class SelectNotesWithRectState
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

class DrawPitchState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "drawPitch";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;

  private currentCursorPos: PositionOnSequencer;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
        prevCursorPos: PositionOnSequencer;
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

  private previewDrawPitch(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "draw") {
      throw new Error("previewPitchEdit.value.type is not draw.");
    }
    const cursorFrame = this.currentCursorPos.frame;
    const cursorFrequency = this.currentCursorPos.frequency;
    const prevCursorFrame = this.innerContext.prevCursorPos.frame;
    const prevCursorFrequency = this.innerContext.prevCursorPos.frequency;
    if (cursorFrame < 0) {
      return;
    }
    const tempPitchEdit = {
      ...context.previewPitchEdit.value,
      data: [...context.previewPitchEdit.value.data],
    };

    if (cursorFrame < tempPitchEdit.startFrame) {
      const numOfFramesToUnshift = tempPitchEdit.startFrame - cursorFrame;
      tempPitchEdit.data = createArray(numOfFramesToUnshift, () => 0).concat(
        tempPitchEdit.data,
      );
      tempPitchEdit.startFrame = cursorFrame;
    }

    const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.data.length - 1;
    if (cursorFrame > lastFrame) {
      const numOfFramesToPush = cursorFrame - lastFrame;
      tempPitchEdit.data = tempPitchEdit.data.concat(
        createArray(numOfFramesToPush, () => 0),
      );
    }

    if (cursorFrame === prevCursorFrame) {
      const i = cursorFrame - tempPitchEdit.startFrame;
      tempPitchEdit.data[i] = cursorFrequency;
    } else if (cursorFrame < prevCursorFrame) {
      for (let i = cursorFrame; i <= prevCursorFrame; i++) {
        tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
          linearInterpolation(
            cursorFrame,
            Math.log(cursorFrequency),
            prevCursorFrame,
            Math.log(prevCursorFrequency),
            i,
          ),
        );
      }
    } else {
      for (let i = prevCursorFrame; i <= cursorFrame; i++) {
        tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
          linearInterpolation(
            prevCursorFrame,
            Math.log(prevCursorFrequency),
            cursorFrame,
            Math.log(cursorFrequency),
            i,
          ),
        );
      }
    }

    context.previewPitchEdit.value = tempPitchEdit;
    this.innerContext.prevCursorPos = this.currentCursorPos;
  }

  onEnter(context: Context) {
    context.previewPitchEdit.value = {
      type: "draw",
      data: [this.cursorPosAtStart.frequency],
      startFrame: this.cursorPosAtStart.frame,
    };
    context.nowPreviewing.value = true;

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewDrawPitch(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
      executePreviewProcess: false,
      previewRequestId,
      prevCursorPos: this.cursorPosAtStart,
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
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "draw") {
      throw new Error("previewPitchEdit.type is not draw.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);

    // カーソルを動かさずにマウスのボタンを離したときに1フレームのみの変更になり、
    // 1フレームの変更はピッチ編集ラインとして表示されないので、無視する
    if (context.previewPitchEdit.value.data.length >= 2) {
      // 平滑化を行う
      let data = context.previewPitchEdit.value.data;
      data = data.map((value) => Math.log(value));
      applyGaussianFilter(data, 0.7);
      data = data.map((value) => Math.exp(value));

      void context.store.actions.COMMAND_SET_PITCH_EDIT_DATA({
        pitchArray: data,
        startFrame: context.previewPitchEdit.value.startFrame,
        trackId: this.targetTrackId,
      });
    }

    context.previewPitchEdit.value = undefined;
    context.nowPreviewing.value = false;
  }
}

class ErasePitchState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "erasePitch";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;

  private currentCursorPos: PositionOnSequencer;

  private innerContext:
    | {
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

  private previewErasePitch(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "erase") {
      throw new Error("previewPitchEdit.value.type is not erase.");
    }
    const cursorFrame = Math.max(0, this.currentCursorPos.frame);
    const tempPitchEdit = { ...context.previewPitchEdit.value };

    if (tempPitchEdit.startFrame > cursorFrame) {
      tempPitchEdit.frameLength += tempPitchEdit.startFrame - cursorFrame;
      tempPitchEdit.startFrame = cursorFrame;
    }

    const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.frameLength - 1;
    if (lastFrame < cursorFrame) {
      tempPitchEdit.frameLength += cursorFrame - lastFrame;
    }

    context.previewPitchEdit.value = tempPitchEdit;
  }

  onEnter(context: Context) {
    context.previewPitchEdit.value = {
      type: "erase",
      startFrame: this.cursorPosAtStart.frame,
      frameLength: 1,
    };
    context.nowPreviewing.value = true;

    const previewIfNeeded = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewErasePitch(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId =
        requestAnimationFrame(previewIfNeeded);
    };
    const previewRequestId = requestAnimationFrame(previewIfNeeded);

    this.innerContext = {
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
    if (context.previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit is undefined.");
    }
    if (context.previewPitchEdit.value.type !== "erase") {
      throw new Error("previewPitchEdit.type is not erase.");
    }

    cancelAnimationFrame(this.innerContext.previewRequestId);

    void context.store.actions.COMMAND_ERASE_PITCH_EDIT_DATA({
      startFrame: context.previewPitchEdit.value.startFrame,
      frameLength: context.previewPitchEdit.value.frameLength,
      trackId: this.targetTrackId,
    });

    context.previewPitchEdit.value = undefined;
    context.nowPreviewing.value = false;
  }
}

export const useSequencerStateMachine = (store: PartialStore) => {
  const computedRefs: ComputedRefs = {
    snapTicks: computed(() =>
      getNoteDuration(store.state.sequencerSnapType, store.state.tpqn),
    ),
    editTarget: computed(() => store.state.sequencerEditTarget),
    selectedTrackId: computed(() => store.getters.SELECTED_TRACK_ID),
    notesInSelectedTrack: computed(() => store.getters.SELECTED_TRACK.notes),
    selectedNoteIds: computed(() => store.getters.SELECTED_NOTE_IDS),
    editorFrameRate: computed(() => store.state.editorFrameRate),
  };
  const refs: Refs = {
    nowPreviewing: ref(false),
    previewNotes: ref([]),
    previewRectForRectSelect: ref(undefined),
    previewPitchEdit: ref(undefined),
    guideLineTicks: ref(0),
  };
  const stateMachine = new StateMachine<
    SequencerStateDefinitions,
    Input,
    Context
  >(
    {
      idle: () => new IdleState(),
      addNote: (args) => new AddNoteState(args),
      moveNote: (args) => new MoveNoteState(args),
      resizeNoteLeft: (args) => new ResizeNoteLeftState(args),
      resizeNoteRight: (args) => new ResizeNoteRightState(args),
      selectNotesWithRect: (args) => new SelectNotesWithRectState(args),
      drawPitch: (args) => new DrawPitchState(args),
      erasePitch: (args) => new ErasePitchState(args),
    },
    new IdleState(),
    {
      ...computedRefs,
      ...refs,
      store,
    },
  );
  return {
    stateMachine,
    nowPreviewing: computed(() => refs.nowPreviewing.value),
    previewNotes: computed(() => refs.previewNotes.value),
    previewRectForRectSelect: computed(
      () => refs.previewRectForRectSelect.value,
    ),
    guideLineTicks: computed(() => refs.guideLineTicks.value),
  };
};
