/**
 * このファイルのコードは実装中で、現在使われていません。
 * issue: https://github.com/VOICEVOX/voicevox/issues/2041
 */

import { computed, ComputedRef, ref, Ref } from "vue";
import { clamp } from "../utility";
import { IState, StateMachine } from "@/sing/stateMachine/stateMachineBase";
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

export type PositionOnSequencer = {
  readonly ticks: number;
  readonly noteNumber: number;
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
};

type Refs = {
  readonly nowPreviewing: Ref<boolean>;
  readonly previewNotes: Ref<Note[]>;
  readonly guideLineTicks: Ref<number>;
};

type StoreActions = {
  readonly deselectAllNotes: () => void;
  readonly deselectNotes: (noteIds: NoteId[]) => void;
  readonly commandAddNotes: (notes: Note[], trackId: TrackId) => void;
  readonly commandUpdateNotes: (notes: Note[], trackId: TrackId) => void;
  readonly selectNotes: (noteIds: NoteId[]) => void;
  readonly playPreviewSound: (noteNumber: number, duration?: number) => void;
};

type Context = ComputedRefs & Refs & { readonly storeActions: StoreActions };

type State = IdleState | AddNoteState | MoveNoteState | ResizeNoteLeftState;

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
  void context.storeActions.deselectAllNotes();
  void context.storeActions.selectNotes([note.id]);
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
    void context.storeActions.selectNotes(noteIdsToSelect);
  } else if (isOnCommandOrCtrlKeyDown(mouseEvent)) {
    // CommandキーかCtrlキーが押されている場合
    if (context.selectedNoteIds.value.has(mouseDownNote.id)) {
      // 選択中のノートなら選択解除
      void context.storeActions.deselectNotes([mouseDownNote.id]);
      return;
    }
    // 未選択のノートなら選択に追加
    void context.storeActions.selectNotes([mouseDownNote.id]);
  } else if (!context.selectedNoteIds.value.has(mouseDownNote.id)) {
    // 選択中のノートでない場合は選択状態にする
    void selectOnlyThisNote(context, mouseDownNote);
    void context.storeActions.playPreviewSound(
      mouseDownNote.noteNumber,
      PREVIEW_SOUND_DURATION,
    );
  }
};

class IdleState implements IState<State, Input, Context> {
  readonly id = "idle";

  onEnter() {}

  process({
    input,
    context,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: (nextState: State) => void;
  }) {
    const mouseButton = getButton(input.mouseEvent);
    const selectedTrackId = context.selectedTrackId.value;

    if (context.editTarget.value === "NOTE") {
      if (input.targetArea === "SequencerBody") {
        context.guideLineTicks.value = getGuideLineTicks(
          input.cursorPos,
          context,
        );
        if (input.mouseEvent.type === "mousedown") {
          if (!isSelfEventTarget(input.mouseEvent)) {
            return;
          }
          if (mouseButton === "LEFT_BUTTON") {
            context.storeActions.deselectAllNotes();
            const addNoteState = new AddNoteState(
              input.cursorPos,
              selectedTrackId,
            );
            setNextState(addNoteState);
          }
        }
      } else if (input.targetArea === "Note") {
        if (input.mouseEvent.type === "mousedown") {
          if (!isSelfEventTarget(input.mouseEvent)) {
            return;
          }
          if (mouseButton === "LEFT_BUTTON") {
            executeNotesSelectionProcess(context, input.mouseEvent, input.note);
            const moveNoteState = new MoveNoteState(
              input.cursorPos,
              selectedTrackId,
              context.selectedNoteIds.value,
              input.note.id,
            );
            setNextState(moveNoteState);
          }
        }
      }
    }
  }

  onExit() {}
}

class AddNoteState implements IState<State, Input, Context> {
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

  constructor(cursorPosAtStart: PositionOnSequencer, targetTrackId: TrackId) {
    this.cursorPosAtStart = cursorPosAtStart;
    this.targetTrackId = targetTrackId;

    this.currentCursorPos = cursorPosAtStart;
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
    setNextState: (nextState: State) => void;
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
          setNextState(new IdleState());
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

    context.storeActions.commandAddNotes(
      context.previewNotes.value,
      this.targetTrackId,
    );
    context.storeActions.selectNotes(previewNoteIds);

    if (previewNotes.length === 1) {
      context.storeActions.playPreviewSound(
        previewNotes[0].noteNumber,
        PREVIEW_SOUND_DURATION,
      );
    }
    context.previewNotes.value = [];
    context.nowPreviewing.value = false;
  }
}

class MoveNoteState implements IState<State, Input, Context> {
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

  constructor(
    cursorPosAtStart: PositionOnSequencer,
    targetTrackId: TrackId,
    targetNoteIds: Set<NoteId>,
    mouseDownNoteId: NoteId,
  ) {
    if (!targetNoteIds.has(mouseDownNoteId)) {
      throw new Error("mouseDownNoteId is not included in targetNoteIds.");
    }
    this.cursorPosAtStart = cursorPosAtStart;
    this.targetTrackId = targetTrackId;
    this.targetNoteIds = targetNoteIds;
    this.mouseDownNoteId = mouseDownNoteId;

    this.currentCursorPos = cursorPosAtStart;
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
    setNextState: (nextState: State) => void;
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
          setNextState(new IdleState());
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

    context.storeActions.commandUpdateNotes(previewNotes, this.targetTrackId);
    context.storeActions.selectNotes(previewNoteIds);

    if (previewNotes.length === 1) {
      context.storeActions.playPreviewSound(
        previewNotes[0].noteNumber,
        PREVIEW_SOUND_DURATION,
      );
    }
    context.previewNotes.value = [];
    context.nowPreviewing.value = false;
  }
}

class ResizeNoteLeftState implements IState<State, Input, Context> {
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

  constructor(
    cursorPosAtStart: PositionOnSequencer,
    targetTrackId: TrackId,
    targetNoteIds: Set<NoteId>,
    mouseDownNoteId: NoteId,
  ) {
    if (!targetNoteIds.has(mouseDownNoteId)) {
      throw new Error("mouseDownNoteId is not included in targetNoteIds.");
    }
    this.cursorPosAtStart = cursorPosAtStart;
    this.targetTrackId = targetTrackId;
    this.targetNoteIds = targetNoteIds;
    this.mouseDownNoteId = mouseDownNoteId;

    this.currentCursorPos = cursorPosAtStart;
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
    setNextState: (nextState: State) => void;
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
        setNextState(new IdleState());
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

    context.storeActions.commandUpdateNotes(previewNotes, this.targetTrackId);
    context.storeActions.selectNotes(previewNoteIds);

    if (previewNotes.length === 1) {
      context.storeActions.playPreviewSound(
        previewNotes[0].noteNumber,
        PREVIEW_SOUND_DURATION,
      );
    }
    context.previewNotes.value = [];
    context.nowPreviewing.value = false;
  }
}

export const useSequencerStateMachine = (
  computedRefs: ComputedRefs,
  storeActions: StoreActions,
) => {
  const refs: Refs = {
    nowPreviewing: ref(false),
    previewNotes: ref<Note[]>([]),
    guideLineTicks: ref(0),
  };
  const stateMachine = new StateMachine<State, Input, Context>(
    new IdleState(),
    {
      ...computedRefs,
      ...refs,
      storeActions,
    },
  );
  return {
    stateMachine,
    nowPreviewing: computed(() => refs.nowPreviewing.value),
    previewNotes: computed(() => refs.previewNotes.value),
    guideLineTicks: computed(() => refs.guideLineTicks.value),
  };
};
