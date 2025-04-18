import { it, expect } from "vitest";
import { PhraseKey } from "@/store/type";
import { DEFAULT_TPQN, PhraseRange, selectPriorPhrase } from "@/sing/domain";

const createPhraseRange = (start: number, end: number): PhraseRange => {
  return {
    startTicks: start * DEFAULT_TPQN,
    endTicks: end * DEFAULT_TPQN,
  };
};
const basePhraseRanges = new Map<PhraseKey, PhraseRange>([
  [PhraseKey("1"), createPhraseRange(0, 1)],
  [PhraseKey("2"), createPhraseRange(1, 2)],
  [PhraseKey("3"), createPhraseRange(2, 3)],
  [PhraseKey("4"), createPhraseRange(3, 4)],
  [PhraseKey("5"), createPhraseRange(4, 5)],
]);

it("しっかり優先順位に従って探している", () => {
  const phraseRanges = structuredClone(basePhraseRanges);
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
    const key = selectPriorPhrase(phraseRanges, position);
    expect(key).toEqual(expectation);
    phraseRanges.delete(key);
  }

  // もう再生可能なPhraseがないのでthrow
  expect(() => {
    selectPriorPhrase(phraseRanges, position);
  }).toThrow("phraseRanges.size is 0.");
});
