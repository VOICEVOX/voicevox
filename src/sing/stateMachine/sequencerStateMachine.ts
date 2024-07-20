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
  PREVIEW_SOUND_DURATION,
} from "@/sing/viewHelper";
import { Note, SequencerEditTarget } from "@/store/type";
import { NoteId } from "@/type/preload";

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
};

type Refs = {
  readonly nowPreviewing: Ref<boolean>;
  readonly previewNotes: Ref<Note[]>;
  readonly guideLineTicks: Ref<number>;
};

type StoreActions = {
  readonly deselectAllNotes: () => void;
  readonly commandAddNotes: (notes: Note[]) => void;
  readonly selectNotes: (noteIds: NoteId[]) => void;
  readonly playPreviewSound: (noteNumber: number, duration?: number) => void;
};

type Context = ComputedRefs & Refs & { readonly storeActions: StoreActions };

type State = IdleState | AddNoteState;

const getGuideLineTicks = (
  cursorPos: PositionOnSequencer,
  context: Context,
) => {
  const cursorTicks = cursorPos.ticks;
  const snapTicks = context.snapTicks.value;
  // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
  return Math.round(cursorTicks / snapTicks - 0.25) * snapTicks;
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
    if (input.targetArea === "SequencerBody") {
      context.guideLineTicks.value = getGuideLineTicks(
        input.cursorPos,
        context,
      );
      if (input.mouseEvent.type === "mousedown") {
        // TODO: メニューが表示されている場合はメニュー非表示のみ行いたい
        if (context.editTarget.value === "NOTE") {
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
            setNextState(new AddNoteState(input.cursorPos));
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

  private noteToAdd?: Note;
  private previewRequestId = 0;
  private executePreviewProcess = false;
  private currentCursorPos: PositionOnSequencer;

  constructor(cursorPosAtStart: PositionOnSequencer) {
    this.cursorPosAtStart = cursorPosAtStart;
    this.currentCursorPos = cursorPosAtStart;
  }

  private previewAdd(context: Context) {
    if (this.noteToAdd == undefined) {
      throw new Error("noteToAdd is undefined.");
    }
    const snapTicks = context.snapTicks.value;
    const dragTicks = this.currentCursorPos.ticks - this.cursorPosAtStart.ticks;
    const noteDuration = Math.round(dragTicks / snapTicks) * snapTicks;
    const noteEndPos = this.noteToAdd.position + noteDuration;
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
    context.storeActions.deselectAllNotes();

    const guideLineTicks = getGuideLineTicks(this.cursorPosAtStart, context);
    const noteToAdd = {
      id: NoteId(crypto.randomUUID()),
      position: guideLineTicks,
      duration: context.snapTicks.value,
      noteNumber: this.cursorPosAtStart.noteNumber,
      lyric: getDoremiFromNoteNumber(this.cursorPosAtStart.noteNumber),
    };

    this.noteToAdd = noteToAdd;
    context.previewNotes.value = [noteToAdd];
    context.nowPreviewing.value = true;

    this.executePreviewProcess = true;
    const preview = () => {
      if (this.executePreviewProcess) {
        this.previewAdd(context);
        this.executePreviewProcess = false;
      }
      this.previewRequestId = requestAnimationFrame(preview);
    };
    this.previewRequestId = requestAnimationFrame(preview);
  }

  process({
    input,
    setNextState,
  }: {
    input: Input;
    context: Context;
    setNextState: (nextState: State) => void;
  }) {
    const mouseButton = getButton(input.mouseEvent);
    if (input.targetArea === "SequencerBody") {
      if (input.mouseEvent.type === "mousemove") {
        this.currentCursorPos = input.cursorPos;
        this.executePreviewProcess = true;
      } else if (input.mouseEvent.type === "mouseup") {
        if (mouseButton === "LEFT_BUTTON") {
          setNextState(new IdleState());
        }
      }
    }
  }

  onExit(context: Context) {
    const previewNotes = context.previewNotes.value;
    const previewNoteIds = previewNotes.map((value) => value.id);

    cancelAnimationFrame(this.previewRequestId);
    context.storeActions.commandAddNotes(context.previewNotes.value);
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
