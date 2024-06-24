import { NoteId } from "@/type/preload";
import { Note } from "@/store/type";

/**
 * 頻繁に変更される値を保持します。
 * 値変更時に実行する関数を登録できます。
 */
export class FrequentlyUpdatedState<T> {
  private _value: T;
  private listeners = new Set<(newValue: T) => void>();

  get value() {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.listeners.forEach((listener) => listener(newValue));
  }

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  addValueChangeListener(listener: (newValue: T) => void) {
    if (this.listeners.has(listener)) {
      throw new Error("The listener already exists.");
    }
    this.listeners.add(listener);
    listener(this.value);
  }

  removeValueChangeListener(listener: (newValue: T) => void) {
    if (!this.listeners.has(listener)) {
      throw new Error("The listener does not exist.");
    }
    this.listeners.delete(listener);
  }
}

export function getOverlappingNoteIds(notes: Note[]): Set<NoteId> {
  const events: {
    type: "start" | "end";
    noteId: NoteId;
    tick: number;
  }[] = notes.flatMap((note) => [
    {
      type: "start",
      noteId: note.id,
      tick: note.position,
    },
    {
      type: "end",
      noteId: note.id,
      tick: note.position + note.duration,
    },
  ]);

  // tickが同じ値の時はノート終了 -> ノート開始の順にソート
  events.sort((a, b) => {
    if (a.tick !== b.tick) {
      return a.tick - b.tick;
    }
    if (a.type === "start" && b.type === "end") {
      return 1;
    }
    if (a.type === "end" && b.type === "start") {
      return -1;
    }
    return 0;
  });

  const overlappingNoteIds = new Set<NoteId>();
  const currentNotes = new Set<NoteId>();

  for (const event of events) {
    if (event.type === "start") {
      if (currentNotes.size === 1) {
        overlappingNoteIds.add(currentNotes.values().next().value);
        overlappingNoteIds.add(event.noteId);
      } else if (currentNotes.size > 1) {
        overlappingNoteIds.add(event.noteId);
      }
      currentNotes.add(event.noteId);
    } else {
      currentNotes.delete(event.noteId);
    }
  }

  return overlappingNoteIds;
}
