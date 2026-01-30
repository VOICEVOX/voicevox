import { ComputedRef, Ref } from "vue";
import { StateDefinitions } from "@/sing/stateMachine";
import { Rect } from "@/sing/utility";
import {
  CursorState,
  PREVIEW_SOUND_DURATION,
  PreviewMode,
} from "@/sing/viewHelper";
import { Store } from "@/store";
import { SequencerEditTarget } from "@/store/type";
import { NoteId, TrackId } from "@/type/preload";
import type { Note, Tempo } from "@/domain/project/type";

export type PositionOnSequencer = {
  readonly x: number;
  readonly y: number;
  readonly ticks: number;
  readonly noteNumber: number;
  readonly frame: number;
  readonly frequency: number;
};

export type ViewportInfo = {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

export type Input =
  | {
      readonly type: "keyboardEvent";
      readonly targetArea: "Document";
      readonly keyboardEvent: KeyboardEvent;
    }
  | {
      readonly type: "keyboardEvent";
      readonly targetArea: "LyricInput";
      readonly keyboardEvent: KeyboardEvent;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "Window";
      readonly pointerEvent: PointerEvent;
      readonly cursorPos: PositionOnSequencer;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "SequencerBody";
      readonly pointerEvent: PointerEvent;
      readonly cursorPos: PositionOnSequencer;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "Note";
      readonly pointerEvent: PointerEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "NoteLeftEdge";
      readonly pointerEvent: PointerEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "NoteRightEdge";
      readonly pointerEvent: PointerEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Note";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
      readonly note: Note;
    }
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "SequencerBody";
      readonly mouseEvent: MouseEvent;
      readonly cursorPos: PositionOnSequencer;
    }
  | {
      readonly type: "scrollEvent";
      readonly targetArea: "SequencerBody";
    }
  | {
      readonly type: "inputEvent";
      readonly targetArea: "LyricInput";
      readonly inputEvent: Event;
    }
  | {
      readonly type: "blurEvent";
      readonly targetArea: "LyricInput";
    };

export type ComputedRefs = {
  readonly viewportInfo: ComputedRef<ViewportInfo>;
  readonly tpqn: ComputedRef<number>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly snapTicks: ComputedRef<number>;
  readonly editTarget: ComputedRef<SequencerEditTarget>;
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly notesInSelectedTrack: ComputedRef<Note[]>;
  readonly selectedNoteIds: ComputedRef<Set<NoteId>>;
  readonly editingLyricNoteId: ComputedRef<NoteId | undefined>;
  readonly editorFrameRate: ComputedRef<number>;
  readonly isShiftKeyDown: ComputedRef<boolean>;
  readonly isCommandOrCtrlKeyDown: ComputedRef<boolean>;
};

export type Refs = {
  readonly previewMode: Ref<PreviewMode>;
  readonly previewNotes: Ref<Note[]>;
  readonly previewLyrics: Ref<Map<NoteId, string>>;
  readonly previewRectForRectSelect: Ref<Rect | undefined>;
  readonly previewPitchEdit: Ref<
    | { type: "draw"; data: number[]; startFrame: number }
    | { type: "erase"; startFrame: number; frameLength: number }
    | undefined
  >;
  readonly cursorState: Ref<CursorState>;
  readonly guideLineTicks: Ref<number>;
  readonly enableAutoScrollOnEdge: Ref<boolean>;
};

export type PartialStore = {
  state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "tracks"
    | "sequencerSnapType"
    | "sequencerEditTarget"
    | "sequencerNoteTool"
    | "sequencerPitchTool"
    | "editingLyricNoteId"
    | "editorFrameRate"
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
    | "SET_EDITING_LYRIC_NOTE_ID"
  >;
};

export type Context = ComputedRefs & Refs & { readonly store: PartialStore };

export type IdleStateId =
  | "selectNotesToolIdle"
  | "editNotesToolIdle"
  | "drawPitchToolIdle"
  | "erasePitchToolIdle";

export type SequencerStateDefinitions = StateDefinitions<
  [
    {
      id: "selectNotesToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "editNotesToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "drawPitchToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "erasePitchToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "addNote";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "moveNote";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "resizeNoteLeft";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "resizeNoteRight";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        targetNoteIds: Set<NoteId>;
        mouseDownNoteId: NoteId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "editNoteLyric";
      factoryArgs: {
        targetTrackId: TrackId;
        editStartNoteId: NoteId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "selectNotesWithRect";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "drawPitch";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "erasePitch";
      factoryArgs: {
        cursorPosAtStart: PositionOnSequencer;
        targetTrackId: TrackId;
        returnStateId: IdleStateId;
      };
    },
  ]
>;

const DRAG_START_THRESHOLD_X = 2;
const DRAG_START_THRESHOLD_Y = 2;

export const shouldStartDrag = (
  cursorPosAtStart: PositionOnSequencer,
  currentCursorPos: PositionOnSequencer,
) => {
  const dragDistanceX = Math.abs(currentCursorPos.x - cursorPosAtStart.x);
  const dragDistanceY = Math.abs(currentCursorPos.y - cursorPosAtStart.y);
  return (
    dragDistanceX >= DRAG_START_THRESHOLD_X ||
    dragDistanceY >= DRAG_START_THRESHOLD_Y
  );
};

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
 * 指定されたノートとすでに選択されているノートの間にある全てのノートを選択状態にする。
 * @param context シーケンサーのコンテキスト
 * @param mouseDownNote マウスでクリックされたノート
 */
export const selectNotesInRange = (context: Context, mouseDownNote: Note) => {
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
};

/**
 * 指定されたノートの選択状態を切り替える。
 * 選択されている場合は選択解除し、選択されていない場合は選択状態にする。
 * @param context シーケンサーのコンテキスト
 * @param note 選択状態を切り替えるノート
 */
export const toggleNoteSelection = (context: Context, note: Note) => {
  if (context.selectedNoteIds.value.has(note.id)) {
    void context.store.actions.DESELECT_NOTES({
      noteIds: [note.id],
    });
  } else {
    void context.store.actions.SELECT_NOTES({ noteIds: [note.id] });
  }
};

/**
 * 指定されたノートのみを選択状態にし、そのノートのプレビュー音を再生する。
 * 他のノートの選択状態は全て解除される。
 * @param context シーケンサーのコンテキスト
 * @param note 選択してプレビュー音を再生するノート
 */
export const selectOnlyThisNoteAndPlayPreviewSound = (
  context: Context,
  note: Note,
) => {
  void context.store.actions.DESELECT_ALL_NOTES();
  void context.store.actions.SELECT_NOTES({ noteIds: [note.id] });
  void context.store.actions.PLAY_PREVIEW_SOUND({
    noteNumber: note.noteNumber,
    duration: PREVIEW_SOUND_DURATION,
  });
};
