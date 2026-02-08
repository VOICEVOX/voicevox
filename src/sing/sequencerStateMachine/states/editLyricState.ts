import type { SetNextState, State } from "@/sing/stateMachine";
import type {
  Context,
  IdleStateId,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import type { NoteId, TrackId } from "@/type/preload";
import type { Note } from "@/domain/project/type";
import { splitLyricsByMoras } from "@/sing/domain";

export class EditLyricState
  implements State<SequencerStateDefinitions, Input, Context>
{
  readonly id = "editNoteLyric";

  private readonly targetTrackId: TrackId;
  private readonly editStartNoteId: NoteId;
  private readonly returnStateId: IdleStateId;

  private applyPreview: boolean;

  private innerContext:
    | {
        targetTrackNotesAtStart: Note[];
      }
    | undefined;

  constructor(args: {
    targetTrackId: TrackId;
    editStartNoteId: NoteId;
    returnStateId: IdleStateId;
  }) {
    this.targetTrackId = args.targetTrackId;
    this.editStartNoteId = args.editStartNoteId;
    this.returnStateId = args.returnStateId;

    this.applyPreview = false;
  }

  onEnter(context: Context) {
    const targetTrackNotes = context.notesInSelectedTrack.value;

    context.previewLyrics.value = new Map();
    context.previewMode.value = "EDIT_NOTE_LYRIC";
    void context.store.actions.SET_EDITING_LYRIC_NOTE_ID({
      noteId: this.editStartNoteId,
    });

    this.innerContext = {
      targetTrackNotesAtStart: targetTrackNotes,
    };
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
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const previewLyrics = context.previewLyrics.value;

    if (input.targetArea === "LyricInput") {
      const editingLyricNoteId = context.editingLyricNoteId.value;
      if (editingLyricNoteId == undefined) {
        throw new Error("Editing lyric note ID is undefined.");
      }

      if (input.type === "inputEvent") {
        if (!(input.inputEvent.target instanceof HTMLInputElement)) {
          throw new Error("Invalid event target.");
        }
        const inputLyric = input.inputEvent.target.value;
        this.splitAndUpdatePreview(context, inputLyric);
      } else if (input.type === "keyboardEvent") {
        // NOTE: IME変換中のキー入力は無視する
        if (
          input.keyboardEvent.type === "keydown" &&
          !input.keyboardEvent.isComposing
        ) {
          // タブキーで次のノート入力に移動
          // Enterキーで入力を確定
          // Escキーで入力を破棄
          if (input.keyboardEvent.key === "Tab") {
            input.keyboardEvent.preventDefault();

            const targetTrackNotesAtStart =
              this.innerContext.targetTrackNotesAtStart;
            const index = this.findNoteIndexOrThrow(
              targetTrackNotesAtStart,
              editingLyricNoteId,
            );
            const nextNoteIndex =
              index + (input.keyboardEvent.shiftKey ? -1 : 1);
            if (
              nextNoteIndex < 0 ||
              nextNoteIndex >= targetTrackNotesAtStart.length
            ) {
              return;
            }
            const nextNoteId = targetTrackNotesAtStart[nextNoteIndex].id;

            this.applyPreview = previewLyrics.size !== 0;
            setNextState("editNoteLyric", {
              targetTrackId: this.targetTrackId,
              editStartNoteId: nextNoteId,
              returnStateId: this.returnStateId,
            });
          } else if (input.keyboardEvent.key === "Enter") {
            this.applyPreview = previewLyrics.size !== 0;
            setNextState(this.returnStateId, undefined);
          } else if (input.keyboardEvent.key === "Escape") {
            this.applyPreview = false;
            setNextState(this.returnStateId, undefined);
          }
        }
      } else if (input.type === "blurEvent") {
        this.applyPreview = previewLyrics.size !== 0;
        setNextState(this.returnStateId, undefined);
      }
    }
  }

  onExit(context: Context) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const targetTrackNotesAtStart = this.innerContext.targetTrackNotesAtStart;
    const previewLyrics = context.previewLyrics.value;

    if (this.applyPreview) {
      const newNotes: Note[] = [];
      for (const [noteId, lyric] of previewLyrics) {
        const noteAtStart = this.findNoteOrThrow(
          targetTrackNotesAtStart,
          noteId,
        );
        newNotes.push({ ...noteAtStart, lyric });
      }
      void context.store.actions.COMMAND_UPDATE_NOTES({
        notes: newNotes,
        trackId: this.targetTrackId,
      });
    }

    context.previewLyrics.value = new Map();
    context.previewMode.value = "IDLE";
    void context.store.actions.SET_EDITING_LYRIC_NOTE_ID({ noteId: undefined });
  }

  private findNoteOrThrow(notes: Note[], noteId: NoteId) {
    const note = notes.find((note) => note.id === noteId);
    if (note == undefined) {
      throw new Error(`Note with id ${noteId} not found.`);
    }
    return note;
  }

  private findNoteIndexOrThrow(notes: Note[], noteId: NoteId) {
    const index = notes.findIndex((note) => note.id === noteId);
    if (index === -1) {
      throw new Error(`Note with id ${noteId} not found.`);
    }
    return index;
  }

  private splitAndUpdatePreview(context: Context, lyric: string) {
    if (this.innerContext == undefined) {
      throw new Error("innerContext is undefined.");
    }
    const targetTrackNotesAtStart = this.innerContext.targetTrackNotesAtStart;
    const editingLyricNoteIndex = this.findNoteIndexOrThrow(
      targetTrackNotesAtStart,
      this.editStartNoteId,
    );

    const lyricPerNote = splitLyricsByMoras(
      lyric,
      targetTrackNotesAtStart.length - editingLyricNoteIndex,
    );

    const newPreviewLyrics = new Map<NoteId, string>();
    for (const [index, mora] of lyricPerNote.entries()) {
      const noteIndex = editingLyricNoteIndex + index;
      if (noteIndex >= targetTrackNotesAtStart.length) {
        // splitLyricsByMorasで制限してるのでUnreachableのはず。
        throw new Error("noteIndex is out of range.");
      }
      const note = targetTrackNotesAtStart[noteIndex];
      newPreviewLyrics.set(note.id, mora);
    }

    context.previewLyrics.value = newPreviewLyrics;
  }
}
