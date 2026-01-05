import { describe, test, expect } from "vitest";
import { audioStore } from "@/store/audio";
import { EditorAudioQuery, AudioStoreState, AudioItem } from "@/store/type";
import { AudioKey } from "@/type/preload";

const baseEditorAudioQuery: EditorAudioQuery = {
  accentPhrases: [],
  speedScale: 1,
  pitchScale: 0,
  intonationScale: 1,
  volumeScale: 1,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.1,
  pauseLengthScale: 1,
  outputSamplingRate: 24000,
  outputStereo: false,
  kana: "",
};

describe("audioStore", () => {
  describe("TOTAL_AUDIO_LENGTH", () => {
    test("オーディオアイテムがない場合は0を返すこと", () => {
      const state: Partial<AudioStoreState> = {
        audioKeys: [],
        audioItems: {},
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const total = (audioStore.getters as any).TOTAL_AUDIO_LENGTH(
        state,
        {},
        {},
        {},
      );
      expect(total).toBe(0);
    });

    test("複数のオーディオアイテムの合計時間を正しく計算すること", () => {
      const audioKey1 = "key1" as AudioKey;
      const audioKey2 = "key2" as AudioKey;

      const query1: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: undefined,
                consonantLength: undefined,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
      }; // 0.1 + 0.2 + 0.1 = 0.4

      const query2: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "い",
                vowel: "i",
                vowelLength: 0.3,
                pitch: 0,
                consonant: undefined,
                consonantLength: undefined,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
        speedScale: 2,
      }; // (0.1 + 0.3 + 0.1) / 2 = 0.25

      const state: Partial<AudioStoreState> = {
        audioKeys: [audioKey1, audioKey2],
        audioItems: {
          [audioKey1]: { query: query1 } as AudioItem,
          [audioKey2]: { query: query2 } as AudioItem,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const total = (audioStore.getters as any).TOTAL_AUDIO_LENGTH(
        state,
        {},
        {},
        {},
      );
      expect(total).toBeCloseTo(0.65);
    });

    test("クエリがないアイテムは無視されること", () => {
      const audioKey1 = "key1" as AudioKey;
      const audioKey2 = "key2" as AudioKey;

      const query1: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: undefined,
                consonantLength: undefined,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
      }; // 0.4

      const state: Partial<AudioStoreState> = {
        audioKeys: [audioKey1, audioKey2],
        audioItems: {
          [audioKey1]: { query: query1 } as AudioItem,
          [audioKey2]: { text: "hello" } as AudioItem, // No query
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const total = (audioStore.getters as any).TOTAL_AUDIO_LENGTH(
        state,
        {},
        {},
        {},
      );
      expect(total).toBeCloseTo(0.4);
    });
  });
});
