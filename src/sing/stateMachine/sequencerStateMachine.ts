/**
 * このファイルのコードは実装中で、現在使われていません。
 * issue: https://github.com/VOICEVOX/voicevox/issues/2041
 */

import { computed, ComputedRef, ref, Ref } from "vue";
import { IState, StateMachine } from "@/sing/stateMachine/stateMachineBase";
import {
  getButton,
  getDoremiFromNoteNumber,
  isSelfEventTarget,
  keyInfos,
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

type State = IdleState | AddNoteState | MoveNoteState;

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
  void context.storeActions.playPreviewSound(
    note.noteNumber,
    PREVIEW_SOUND_DURATION,
  );
};

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
  }
};

const getSelectedNotes = (context: Context) => {
  return context.notesInSelectedTrack.value.filter((value) =>
    context.selectedNoteIds.value.has(value.id),
  );
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
            if (
              input.cursorPos.ticks < 0 ||
              input.cursorPos.noteNumber < 0 ||
              input.cursorPos.noteNumber > 127
            ) {
              return;
            }
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
            const selectedNotes = getSelectedNotes(context);
            const moveNoteState = new MoveNoteState(
              input.cursorPos,
              selectedTrackId,
              selectedNotes,
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
      position: guideLineTicks,
      duration: context.snapTicks.value,
      noteNumber: this.cursorPosAtStart.noteNumber,
      lyric: getDoremiFromNoteNumber(this.cursorPosAtStart.noteNumber),
    };

    context.previewNotes.value = [noteToAdd];
    context.nowPreviewing.value = true;

    const preview = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewAdd(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId = requestAnimationFrame(preview);
    };
    const previewRequestId = requestAnimationFrame(preview);

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
    context.nowPreviewing.value = false;
  }
}

class MoveNoteState implements IState<State, Input, Context> {
  readonly id = "moveNote";

  private readonly cursorPosAtStart: PositionOnSequencer;
  private readonly targetTrackId: TrackId;
  private readonly clonedTargetNotes: Map<NoteId, Note>;
  private readonly mouseDownNoteId: NoteId;

  private currentCursorPos: PositionOnSequencer;

  private innerContext:
    | {
        previewRequestId: number;
        executePreviewProcess: boolean;
        edited: boolean;
        guideLineTicksAtStart: number;
      }
    | undefined;

  constructor(
    cursorPosAtStart: PositionOnSequencer,
    targetTrackId: TrackId,
    targetNotes: Note[],
    mouseDownNoteId: NoteId,
  ) {
    if (!targetNotes.some((value) => value.id === mouseDownNoteId)) {
      throw new Error("mouseDownNote is not included in targetNotes.");
    }
    this.cursorPosAtStart = cursorPosAtStart;
    this.targetTrackId = targetTrackId;
    this.clonedTargetNotes = new Map();
    for (const targetNote of targetNotes) {
      this.clonedTargetNotes.set(targetNote.id, { ...targetNote });
    }
    this.mouseDownNoteId = mouseDownNoteId;

    this.currentCursorPos = cursorPosAtStart;
  }

  private previewMove(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const snapTicks = context.snapTicks.value;
    const previewNotes = context.previewNotes.value;
    const clonedTargetNotes = this.clonedTargetNotes;
    const mouseDownNote = getOrThrow(clonedTargetNotes, this.mouseDownNoteId);
    const dragTicks = this.currentCursorPos.ticks - this.cursorPosAtStart.ticks;
    const notePos = mouseDownNote.position;
    const newNotePos =
      Math.round((notePos + dragTicks) / snapTicks) * snapTicks;
    const movingTicks = newNotePos - notePos;
    const movingSemitones =
      this.currentCursorPos.noteNumber - this.cursorPosAtStart.noteNumber;

    const editedNotes = new Map<NoteId, Note>();
    for (const note of previewNotes) {
      const clonedTargetNote = clonedTargetNotes.get(note.id);
      if (!clonedTargetNote) {
        throw new Error("clonedTargetNote is undefined.");
      }
      const position = clonedTargetNote.position + movingTicks;
      const noteNumber = clonedTargetNote.noteNumber + movingSemitones;
      if (note.position !== position || note.noteNumber !== noteNumber) {
        editedNotes.set(note.id, { ...note, noteNumber, position });
      }
    }

    for (const note of editedNotes.values()) {
      if (note.noteNumber < 0 || note.noteNumber >= keyInfos.length) {
        // MIDIキー範囲外へはドラッグしない
        return;
      }
      if (note.position < 0) {
        // 左端より前はドラッグしない
        return;
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

    context.previewNotes.value = [...this.clonedTargetNotes.values()];
    context.nowPreviewing.value = true;

    const preview = () => {
      if (this.innerContext == undefined) {
        throw new Error("innerContext is undefined.");
      }
      if (this.innerContext.executePreviewProcess) {
        this.previewMove(context);
        this.innerContext.executePreviewProcess = false;
      }
      this.innerContext.previewRequestId = requestAnimationFrame(preview);
    };
    const previewRequestId = requestAnimationFrame(preview);

    this.innerContext = {
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
