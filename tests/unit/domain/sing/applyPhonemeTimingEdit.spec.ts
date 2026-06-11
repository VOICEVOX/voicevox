import { it, expect, describe } from "vitest";
import { uuid4 } from "@/helpers/random";
import type { FramePhoneme } from "@/openapi";
import { createArray } from "@/sing/utility";
import type { EditorFrameAudioQuery } from "@/store/type";
import { NoteId } from "@/type/preload";
import type { PhonemeTimingEdit } from "@/domain/project/type";
import {
  adjustPhonemeTimings,
  applyPhonemeTimingEdit,
  toPhonemes,
  toPhonemeTimings,
} from "@/sing/domain";

const frameRate = 93.75;

const createQuery = (phonemes: FramePhoneme[]): EditorFrameAudioQuery => {
  // NOTE: f0とvolumeは音素タイミング編集に関係ないので空
  return {
    f0: [],
    volume: [],
    phonemes,
    volumeScale: 1,
    outputSamplingRate: 24000,
    outputStereo: false,
    frameRate,
  };
};

const noteIds = createArray(6, () => NoteId(uuid4()));

const phrases = [
  {
    startTime: 1.5,
    minNonPauseStartFrame: undefined,
    maxNonPauseEndFrame: 204,
    query: createQuery([
      { noteId: undefined, frameLength: 40, phoneme: "pau" },
      { noteId: noteIds[0], frameLength: 7, phoneme: "d" },
      { noteId: noteIds[0], frameLength: 40, phoneme: "o" },
      { noteId: noteIds[1], frameLength: 7, phoneme: "r" },
      { noteId: noteIds[1], frameLength: 40, phoneme: "e" },
      { noteId: noteIds[2], frameLength: 7, phoneme: "m" },
      { noteId: noteIds[2], frameLength: 40, phoneme: "i" },
      { noteId: undefined, frameLength: 47, phoneme: "pau" },
    ]),
  },
  {
    startTime: 3.5,
    minNonPauseStartFrame: 17,
    maxNonPauseEndFrame: undefined,
    query: createQuery([
      { noteId: undefined, frameLength: 40, phoneme: "pau" },
      { noteId: noteIds[3], frameLength: 7, phoneme: "f" },
      { noteId: noteIds[3], frameLength: 40, phoneme: "a" },
      { noteId: noteIds[4], frameLength: 7, phoneme: "s" },
      { noteId: noteIds[4], frameLength: 40, phoneme: "o" },
      { noteId: noteIds[5], frameLength: 7, phoneme: "r" },
      { noteId: noteIds[5], frameLength: 40, phoneme: "a" },
      { noteId: undefined, frameLength: 47, phoneme: "pau" },
    ]),
  },
];

describe("applyPhonemeTimingEditAndAdjust", () => {
  it("音素タイミング編集データが空のときは音素タイミングは変更されない", () => {
    const actualPhrases = structuredClone(phrases);

    for (const actualPhrase of actualPhrases) {
      const phonemeTimings = toPhonemeTimings(actualPhrase.query.phonemes);
      applyPhonemeTimingEdit(
        phonemeTimings,
        new Map(),
        actualPhrase.query.frameRate,
      );
      adjustPhonemeTimings(
        phonemeTimings,
        actualPhrase.minNonPauseStartFrame,
        actualPhrase.maxNonPauseEndFrame,
      );
      actualPhrase.query.phonemes = toPhonemes(phonemeTimings);
    }

    const actualPhraseQueries = actualPhrases.map((phrase) => phrase.query);
    const phraseQueries = phrases.map((phrase) => phrase.query);
    expect(actualPhraseQueries).toEqual(phraseQueries);
  });

  it("音素タイミング編集が適用される", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[1], [{ phonemeIndexInNote: 0, offsetSeconds: -3 / frameRate }]],
      [noteIds[4], [{ phonemeIndexInNote: 1, offsetSeconds: 6 / frameRate }]],
    ]);

    const expectedPhrases = structuredClone(phrases);
    expectedPhrases[0].query.phonemes[2].frameLength -= 3;
    expectedPhrases[0].query.phonemes[3].frameLength += 3;
    expectedPhrases[1].query.phonemes[3].frameLength += 6;
    expectedPhrases[1].query.phonemes[4].frameLength -= 6;

    const actualPhrases = structuredClone(phrases);
    for (const actualPhrase of actualPhrases) {
      const phonemeTimings = toPhonemeTimings(actualPhrase.query.phonemes);
      applyPhonemeTimingEdit(
        phonemeTimings,
        phonemeTimingEditData,
        actualPhrase.query.frameRate,
      );
      adjustPhonemeTimings(
        phonemeTimings,
        actualPhrase.minNonPauseStartFrame,
        actualPhrase.maxNonPauseEndFrame,
      );
      actualPhrase.query.phonemes = toPhonemes(phonemeTimings);
    }

    const actualPhraseQueries = actualPhrases.map((phrase) => phrase.query);
    const expectedPhraseQueries = expectedPhrases.map((phrase) => phrase.query);
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });

  it("音素が重ならないように音素タイミングが調整される", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[1], [{ phonemeIndexInNote: 1, offsetSeconds: -12 / frameRate }]],
      [noteIds[3], [{ phonemeIndexInNote: 1, offsetSeconds: 60 / frameRate }]],
    ]);

    const expectedPhrases = structuredClone(phrases);
    expectedPhrases[0].query.phonemes[2].frameLength -= 6;
    expectedPhrases[0].query.phonemes[3].frameLength -= 6;
    expectedPhrases[0].query.phonemes[4].frameLength += 12;
    expectedPhrases[1].query.phonemes[1].frameLength += 39;
    expectedPhrases[1].query.phonemes[2].frameLength -= 39;

    const actualPhrases = structuredClone(phrases);
    for (const actualPhrase of actualPhrases) {
      const phonemeTimings = toPhonemeTimings(actualPhrase.query.phonemes);
      applyPhonemeTimingEdit(
        phonemeTimings,
        phonemeTimingEditData,
        actualPhrase.query.frameRate,
      );
      adjustPhonemeTimings(
        phonemeTimings,
        actualPhrase.minNonPauseStartFrame,
        actualPhrase.maxNonPauseEndFrame,
      );
      actualPhrase.query.phonemes = toPhonemes(phonemeTimings);
    }

    const actualPhraseQueries = actualPhrases.map((phrase) => phrase.query);
    const expectedPhraseQueries = expectedPhrases.map((phrase) => phrase.query);
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });

  it("pauを除く音素の開始フレームが最小開始フレーム以上、終了フレームが最大終了フレーム以下になる", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[2], [{ phonemeIndexInNote: 2, offsetSeconds: 60 / frameRate }]],
      [noteIds[3], [{ phonemeIndexInNote: 0, offsetSeconds: -60 / frameRate }]],
    ]);

    const expectedPhrases = structuredClone(phrases);
    expectedPhrases[0].query.phonemes[6].frameLength += 23;
    expectedPhrases[0].query.phonemes[7].frameLength -= 23;
    expectedPhrases[1].query.phonemes[0].frameLength -= 23;
    expectedPhrases[1].query.phonemes[1].frameLength += 23;

    const actualPhrases = structuredClone(phrases);
    for (const actualPhrase of actualPhrases) {
      const phonemeTimings = toPhonemeTimings(actualPhrase.query.phonemes);
      applyPhonemeTimingEdit(
        phonemeTimings,
        phonemeTimingEditData,
        actualPhrase.query.frameRate,
      );
      adjustPhonemeTimings(
        phonemeTimings,
        actualPhrase.minNonPauseStartFrame,
        actualPhrase.maxNonPauseEndFrame,
      );
      actualPhrase.query.phonemes = toPhonemes(phonemeTimings);
    }

    const actualPhraseQueries = actualPhrases.map((phrase) => phrase.query);
    const expectedPhraseQueries = expectedPhrases.map((phrase) => phrase.query);
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });
});
