import { it, expect } from "vitest";
import { Phrase, PhraseState } from "@/store/type";
import { DEFAULT_TPQN } from "@/sing/storeHelper";
import { selectPriorPhrase } from "@/sing/domain";
import { EngineId, StyleId } from "@/type/preload";

const tempos = [
  {
    position: 0,
    bpm: 60,
  },
];
const createPhrase = (
  start: number,
  end: number,
  state: PhraseState
): Phrase => {
  return {
    notes: [],
    startTicks: start * DEFAULT_TPQN,
    endTicks: end * DEFAULT_TPQN,
    keyRangeAdjustment: 0,
    volumeRangeAdjustment: 0,
    state,
    tempos,
    tpqn: DEFAULT_TPQN,
    singer: {
      engineId: EngineId("00000000-0000-0000-0000-000000000000"),
      styleId: StyleId(0),
    },
  };
};
const basePhrases = new Map<string, Phrase>([
  ["1", createPhrase(0, 1, "WAITING_TO_BE_RENDERED")],
  ["2", createPhrase(1, 2, "WAITING_TO_BE_RENDERED")],
  ["3", createPhrase(2, 3, "WAITING_TO_BE_RENDERED")],
  ["4", createPhrase(3, 4, "WAITING_TO_BE_RENDERED")],
  ["5", createPhrase(4, 5, "WAITING_TO_BE_RENDERED")],
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
