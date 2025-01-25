import { ComputedRef, Ref } from "vue";
import { StateDefinitions } from "@/sing/stateMachine";
import { Rect } from "@/sing/utility";
import { PREVIEW_SOUND_DURATION } from "@/sing/viewHelper";
import { Store } from "@/store";
import { Note, SequencerEditTarget } from "@/store/type";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { NoteId, TrackId } from "@/type/preload";

export type PositionOnSequencer = {
  readonly x: number;
  readonly y: number;
  readonly ticks: number;
  readonly noteNumber: number;
  readonly frame: number;
  readonly frequency: number;
};

export type Input =
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

export type ComputedRefs = {
  readonly snapTicks: ComputedRef<number>;
  readonly editTarget: ComputedRef<SequencerEditTarget>;
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly notesInSelectedTrack: ComputedRef<Note[]>;
  readonly selectedNoteIds: ComputedRef<Set<NoteId>>;
  readonly editorFrameRate: ComputedRef<number>;
};

export type Refs = {
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

export type PartialStore = {
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

export type Context = ComputedRefs & Refs & { readonly store: PartialStore };

export type SequencerStateDefinitions = StateDefinitions<
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

/**
 * カーソル位置に対応する補助線の位置を取得する。
 */
export const getGuideLineTicks = (
  cursorPos: PositionOnSequencer,
  context: Context,
) => {
  const cursorTicks = cursorPos.ticks;
  const snapTicks = context.snapTicks.value;
  // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
  return Math.round(cursorTicks / snapTicks - 0.25) * snapTicks;
};

/**
 * 指定されたノートのみを選択状態にする。
 */
export const selectOnlyThisNote = (context: Context, note: Note) => {
  void context.store.actions.DESELECT_ALL_NOTES();
  void context.store.actions.SELECT_NOTES({ noteIds: [note.id] });
};

/**
 * mousedown時のノート選択・選択解除の処理を実行する。
 */
export const executeNotesSelectionProcess = (
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
