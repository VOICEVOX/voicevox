import { describe, it, expect } from "vitest";
import { uuid4 } from "@/helpers/random";
import type { FramePhoneme } from "@/openapi";
import { NoteId } from "@/type/preload";
import type { Note } from "@/domain/project/type";
import { assignSeedingToPhonemes } from "@/sing/domain";

const createNote = (
  position: number,
  lyric: string,
  phonemeSeedSource: number,
): Note => ({
  id: NoteId(uuid4()),
  position,
  duration: 480,
  noteNumber: 60,
  lyric,
  phonemeSeedSource,
});

const createPhoneme = (
  phoneme: string,
  note: Note | undefined,
): FramePhoneme => ({
  phoneme,
  frameLength: 10,
  noteId: note?.id,
});

const getSeeds = (phonemes: FramePhoneme[]) =>
  phonemes.map((phoneme) => phoneme.seeding?.seed);

describe("assignSeedingToPhonemes", () => {
  it("フレーズの各音素に割り当てるシード値は記録した値になる", () => {
    const notes = [
      createNote(0, "ka", -2147483648),
      createNote(480, "a", 2147483647),
    ];
    const phonemes = [
      createPhoneme("pau", undefined),
      createPhoneme("k", notes[0]),
      createPhoneme("a", notes[0]),
      createPhoneme("a", notes[1]),
      createPhoneme("pau", undefined),
    ];

    assignSeedingToPhonemes(phonemes, notes);

    expect(getSeeds(phonemes)).toEqual([
      -936229137, 1832674720, -1122851478, -104067416, 1449607079,
    ]);
  });

  it("1つのノートに属する音素と、そのノートから求めたpauのシード値は、互いに異なる", () => {
    const note = createNote(0, "ka", 123456789);
    const phonemes = [
      createPhoneme("pau", undefined),
      createPhoneme("k", note),
      createPhoneme("a", note),
      createPhoneme("pau", undefined),
    ];

    assignSeedingToPhonemes(phonemes, [note]);

    expect(new Set(getSeeds(phonemes)).size).toBe(phonemes.length);
  });

  it("フレーズ先頭のpauにはフレーズ先頭のノートから、フレーズ末尾のpauにはフレーズ末尾のノートから求めたシード値を割り当てる", () => {
    const firstNote = createNote(0, "a", 123456789);
    const lastNote = createNote(480, "a", 987654321);
    const phrasePhonemes = [
      createPhoneme("pau", undefined),
      createPhoneme("a", firstNote),
      createPhoneme("a", lastNote),
      createPhoneme("pau", undefined),
    ];
    const firstNoteOnlyPhonemes = [
      createPhoneme("pau", undefined),
      createPhoneme("a", firstNote),
      createPhoneme("pau", undefined),
    ];
    const lastNoteOnlyPhonemes = [
      createPhoneme("pau", undefined),
      createPhoneme("a", lastNote),
      createPhoneme("pau", undefined),
    ];

    assignSeedingToPhonemes(phrasePhonemes, [firstNote, lastNote]);
    assignSeedingToPhonemes(firstNoteOnlyPhonemes, [firstNote]);
    assignSeedingToPhonemes(lastNoteOnlyPhonemes, [lastNote]);

    const phraseSeeds = getSeeds(phrasePhonemes);
    expect(phraseSeeds[0]).toBe(getSeeds(firstNoteOnlyPhonemes)[0]);
    expect(phraseSeeds.at(-1)).toBe(getSeeds(lastNoteOnlyPhonemes).at(-1));
  });

  it("ノートの音素の数が歌詞の変更で増減しても、pauのシード値は変わらない", () => {
    const noteBeforeEdit = createNote(0, "a", 123456789);
    const phonemesBeforeEdit = [
      createPhoneme("pau", undefined),
      createPhoneme("a", noteBeforeEdit),
      createPhoneme("pau", undefined),
    ];
    const noteAfterEdit = { ...noteBeforeEdit, lyric: "ka" };
    const phonemesAfterEdit = [
      createPhoneme("pau", undefined),
      createPhoneme("k", noteAfterEdit),
      createPhoneme("a", noteAfterEdit),
      createPhoneme("pau", undefined),
    ];

    assignSeedingToPhonemes(phonemesBeforeEdit, [noteBeforeEdit]);
    assignSeedingToPhonemes(phonemesAfterEdit, [noteAfterEdit]);

    const seedsBeforeEdit = getSeeds(phonemesBeforeEdit);
    const seedsAfterEdit = getSeeds(phonemesAfterEdit);
    expect(seedsAfterEdit[0]).toBe(seedsBeforeEdit[0]);
    expect(seedsAfterEdit.at(-1)).toBe(seedsBeforeEdit.at(-1));
  });
});
