import { it, expect } from "vitest";
import {
  Phrase,
  PhraseSourceHash,
  PhraseState,
  phraseSourceHashSchema,
} from "@/store/type";
import { DEFAULT_TPQN, selectPriorPhrase } from "@/sing/domain";
import { NoteId } from "@/type/preload";

const createPhrase = (
  firstRestDuration: number,
  start: number,
  end: number,
  state: PhraseState,
): Phrase => {
  return {
    firstRestDuration: firstRestDuration * DEFAULT_TPQN,
    notes: [
      {
        id: NoteId(crypto.randomUUID()),
        position: start * DEFAULT_TPQN,
        duration: (end - start) * DEFAULT_TPQN,
        noteNumber: 60,
        lyric: "ド",
      },
    ],
    state,
  };
};
const basePhrases = new Map<PhraseSourceHash, Phrase>([
  [
    phraseSourceHashSchema.parse("1"),
    createPhrase(0, 0, 1, "WAITING_TO_BE_RENDERED"),
  ],
  [
    phraseSourceHashSchema.parse("2"),
    createPhrase(0, 1, 2, "WAITING_TO_BE_RENDERED"),
  ],
  [
    phraseSourceHashSchema.parse("3"),
    createPhrase(0, 2, 3, "WAITING_TO_BE_RENDERED"),
  ],
  [
    phraseSourceHashSchema.parse("4"),
    createPhrase(0, 3, 4, "WAITING_TO_BE_RENDERED"),
  ],
  [
    phraseSourceHashSchema.parse("5"),
    createPhrase(0, 4, 5, "WAITING_TO_BE_RENDERED"),
  ],
]);

it("しっかり優先順位に従って探している", () => {
  const phrases = structuredClone(basePhrases);
  const position = 2.5 * DEFAULT_TPQN;
  for (const expectation of [
    // 再生位置が含まれるPhrase
    "3",
    // 再生位置より後のPhrase
    "4", // 早い方
    "5", // 遅い方
    // 再生位置より前のPhrase
    "1", // 早い方
    "2", // 遅い方
  ]) {
    const [key] = selectPriorPhrase(phrases, position);
    expect(key).toEqual(expectation);
    if (key == undefined) {
      // 型アサーションのためにthrowを使う
      throw new Error("key is undefined");
    }
    phrases.delete(key);
  }

  // もう再生可能なPhraseがないのでthrow
  expect(() => {
    selectPriorPhrase(phrases, position);
  }).toThrow("Received empty phrases");
});
