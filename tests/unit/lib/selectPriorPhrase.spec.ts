import { it, expect } from "vitest";
import { Phrase, PhraseKey, PhraseState } from "@/store/type";
import {
  DEFAULT_BPM,
  DEFAULT_TPQN,
  selectPriorPhrase,
  tickToSecond,
} from "@/sing/domain";
import { NoteId, TrackId } from "@/type/preload";
import { uuid4 } from "@/helpers/random";

const trackId = TrackId("00000000-0000-0000-0000-000000000000");

const createPhrase = (
  firstRestDuration: number,
  start: number,
  end: number,
  state: PhraseState,
): Phrase => {
  return {
    trackId,
    firstRestDuration: firstRestDuration * DEFAULT_TPQN,
    notes: [
      {
        id: NoteId(uuid4()),
        position: start * DEFAULT_TPQN,
        duration: (end - start) * DEFAULT_TPQN,
        noteNumber: 60,
        lyric: "ド",
      },
    ],
    startTime: tickToSecond(
      start * DEFAULT_TPQN - firstRestDuration * DEFAULT_TPQN,
      [{ position: 0, bpm: DEFAULT_BPM }],
      DEFAULT_TPQN,
    ),
    state,
  };
};
const basePhrases = new Map<PhraseKey, Phrase>([
  [PhraseKey("1"), createPhrase(0, 0, 1, "WAITING_TO_BE_RENDERED")],
  [PhraseKey("2"), createPhrase(0, 1, 2, "WAITING_TO_BE_RENDERED")],
  [PhraseKey("3"), createPhrase(0, 2, 3, "WAITING_TO_BE_RENDERED")],
  [PhraseKey("4"), createPhrase(0, 3, 4, "WAITING_TO_BE_RENDERED")],
  [PhraseKey("5"), createPhrase(0, 4, 5, "WAITING_TO_BE_RENDERED")],
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
