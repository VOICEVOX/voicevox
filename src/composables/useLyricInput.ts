import { computed, ref } from "vue";
import { splitLyricsByMoras } from "@/sing/domain";
import { useStore } from "@/store";
import { Note } from "@/store/type";

// 歌詞入力のロジック。
export const useLyricInput = () => {
  const store = useStore();
  const notes = computed(() => store.getters.SELECTED_TRACK.notes);

  // プレビュー中の歌詞。NoteID -> 歌詞のMap。
  const previewLyrics = ref<Map<string, string>>(new Map());
  // 入力中の歌詞を分割してプレビューに反映する。
  const splitAndUpdatePreview = (lyric: string, note: Note) => {
    // TODO: マルチトラック対応
    const inputNoteIndex = store.state.tracks[0].notes.findIndex(
      (value) => value.id === note.id,
    );
    if (inputNoteIndex === -1) {
      throw new Error("inputNoteIndex is -1.");
    }
    const newPreviewLyrics = new Map();

    const lyricPerNote = splitLyricsByMoras(
      lyric,
      store.state.tracks[0].notes.length - inputNoteIndex,
    );
    for (const [index, mora] of lyricPerNote.entries()) {
      const noteIndex = inputNoteIndex + index;
      if (noteIndex >= notes.value.length) {
        // splitLyricsByMorasで制限してるのでUnreachableのはず。
        throw new Error("noteIndex is out of range.");
      }
      const note = notes.value[noteIndex];
      newPreviewLyrics.set(note.id, mora);
    }
    previewLyrics.value = newPreviewLyrics;
  };
  // プレビューの歌詞を確定する。
  const commitPreviewLyrics = () => {
    const newNotes: Note[] = [];
    if (previewLyrics.value.size === 0) {
      return;
    }
    for (const [noteId, lyric] of previewLyrics.value) {
      const note = notes.value.find((value) => value.id === noteId);
      if (!note) {
        throw new Error("note is undefined.");
      }
      newNotes.push({ ...note, lyric });
    }
    previewLyrics.value = new Map();
    store.dispatch("COMMAND_UPDATE_NOTES", { notes: newNotes });
  };

  return { previewLyrics, splitAndUpdatePreview, commitPreviewLyrics };
};
