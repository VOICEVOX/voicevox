import { uuid4 } from "@/helpers/random";
import { FramePhoneme } from "@/openapi";
import {
  applyPhonemeTimingEditAndAdjust,
  PhonemeTimingEdit,
} from "@/sing/domain";
import { createArray } from "@/sing/utility";
import { EditorFrameAudioQuery } from "@/store/type";
import { NoteId } from "@/type/preload";

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
const phraseStartTimes = [1.5, 3.5]; // NOTE: phraseStartFramesは[141, 328]になる
const phraseQueries = [
  createQuery([
    { noteId: undefined, frameLength: 40, phoneme: "pau" },
    { noteId: noteIds[0], frameLength: 7, phoneme: "d" },
    { noteId: noteIds[0], frameLength: 40, phoneme: "o" },
    { noteId: noteIds[1], frameLength: 7, phoneme: "r" },
    { noteId: noteIds[1], frameLength: 40, phoneme: "e" },
    { noteId: noteIds[2], frameLength: 7, phoneme: "m" },
    { noteId: noteIds[2], frameLength: 40, phoneme: "i" },
    { noteId: undefined, frameLength: 47, phoneme: "pau" },
  ]),
  createQuery([
    { noteId: undefined, frameLength: 40, phoneme: "pau" },
    { noteId: noteIds[3], frameLength: 7, phoneme: "f" },
    { noteId: noteIds[3], frameLength: 40, phoneme: "a" },
    { noteId: noteIds[4], frameLength: 7, phoneme: "s" },
    { noteId: noteIds[4], frameLength: 40, phoneme: "o" },
    { noteId: noteIds[5], frameLength: 7, phoneme: "r" },
    { noteId: noteIds[5], frameLength: 40, phoneme: "a" },
    { noteId: undefined, frameLength: 47, phoneme: "pau" },
  ]),
];

describe("applyPhonemeTimingEditAndAdjust", () => {
  it("音素タイミング編集データが空のときは音素タイミングは変更されない", () => {
    const actualPhraseQueries = structuredClone(phraseQueries);
    applyPhonemeTimingEditAndAdjust(
      phraseStartTimes,
      actualPhraseQueries,
      new Map(),
      frameRate,
    );
    expect(actualPhraseQueries).toEqual(phraseQueries);
  });

  it("音素タイミング編集が適用される", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[1], [{ phonemeIndexInNote: 0, offsetSeconds: -3 / frameRate }]],
      [noteIds[4], [{ phonemeIndexInNote: 1, offsetSeconds: 6 / frameRate }]],
    ]);
    const expectedPhraseQueries = structuredClone(phraseQueries);
    expectedPhraseQueries[0].phonemes[2].frameLength -= 3;
    expectedPhraseQueries[0].phonemes[3].frameLength += 3;
    expectedPhraseQueries[1].phonemes[3].frameLength += 6;
    expectedPhraseQueries[1].phonemes[4].frameLength -= 6;
    const actualPhraseQueries = structuredClone(phraseQueries);
    applyPhonemeTimingEditAndAdjust(
      phraseStartTimes,
      actualPhraseQueries,
      phonemeTimingEditData,
      frameRate,
    );
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });

  it("音素が重ならないように音素タイミングが調整される", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[1], [{ phonemeIndexInNote: 1, offsetSeconds: -12 / frameRate }]],
      [noteIds[2], [{ phonemeIndexInNote: 2, offsetSeconds: 60 / frameRate }]],
    ]);
    const expectedPhraseQueries = structuredClone(phraseQueries);
    expectedPhraseQueries[0].phonemes[2].frameLength -= 6;
    expectedPhraseQueries[0].phonemes[3].frameLength -= 6;
    expectedPhraseQueries[0].phonemes[4].frameLength += 12;
    expectedPhraseQueries[0].phonemes[6].frameLength += 45;
    expectedPhraseQueries[0].phonemes[7].frameLength -= 45;
    const actualPhraseQueries = structuredClone(phraseQueries);
    applyPhonemeTimingEditAndAdjust(
      phraseStartTimes,
      actualPhraseQueries,
      phonemeTimingEditData,
      frameRate,
    );
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });

  it("pauseのフレーム長が1以上になるように音素タイミングが調整される", () => {
    const phonemeTimingEditData = new Map<NoteId, PhonemeTimingEdit[]>([
      [noteIds[3], [{ phonemeIndexInNote: 1, offsetSeconds: -60 / frameRate }]],
      [noteIds[5], [{ phonemeIndexInNote: 2, offsetSeconds: 60 / frameRate }]],
    ]);
    const expectedPhraseQueries = structuredClone(phraseQueries);
    expectedPhraseQueries[1].phonemes[0].frameLength -= 39;
    expectedPhraseQueries[1].phonemes[1].frameLength -= 6;
    expectedPhraseQueries[1].phonemes[2].frameLength += 45;
    expectedPhraseQueries[1].phonemes[6].frameLength += 60;
    expectedPhraseQueries[1].phonemes[7].frameLength -= 46;
    const actualPhraseQueries = structuredClone(phraseQueries);
    applyPhonemeTimingEditAndAdjust(
      phraseStartTimes,
      actualPhraseQueries,
      phonemeTimingEditData,
      frameRate,
    );
    expect(actualPhraseQueries).toEqual(expectedPhraseQueries);
  });
});
