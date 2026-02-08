import { describe, test, expect } from "vitest";
import { calculateAudioLength } from "@/store/audioGenerate";
import type { EditorAudioQuery } from "@/store/type";

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

describe("audioGenerate", () => {
  describe("calculateAudioLength", () => {
    test("アクセント句がない場合は0を返すこと", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [],
      };

      expect(calculateAudioLength(audioQuery)).toBe(0);
    });

    test("アクセント句がある場合の計算が正しいこと", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: "a",
                consonantLength: 0.1,
              }, // 0.3
              {
                text: "い",
                vowel: "i",
                vowelLength: 0.2,
                pitch: 0,
                consonant: undefined,
                consonantLength: undefined,
              }, // 0.2
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
      };

      // 0.1(pre) + 0.3 + 0.2 + 0.1(post) = 0.7
      expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.7);
    });

    test("speedScaleが反映されること", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: "a",
                consonantLength: 0.1,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
        speedScale: 2, // 2倍速
      };

      // (0.1(pre) + 0.3 + 0.1(post)) / 2 = 0.25
      expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.25);
    });

    test("ポーズがある場合の計算が正しいこと", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: "a",
                consonantLength: 0.1,
              },
            ],
            accent: 1,
            pauseMora: {
              text: "、",
              vowel: "pau",
              vowelLength: 0.5,
              pitch: 0,
            }, // 0.5 * 1.5 = 0.75
          },
        ],
        pauseLengthScale: 1.5,
      };

      // 0.1 + 0.3 + 0.75 + 0.1 = 1.25
      expect(calculateAudioLength(audioQuery)).toBeCloseTo(1.25);
    });
    test("prePhonemeLengthが反映されること", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: "a",
                consonantLength: 0.1,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
        prePhonemeLength: 0.5,
      };

      // 0.5(pre) + 0.3 + 0.1(post) = 0.9
      expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.9);
    });

    test("postPhonemeLengthが反映されること", () => {
      const audioQuery: EditorAudioQuery = {
        ...baseEditorAudioQuery,
        accentPhrases: [
          {
            moras: [
              {
                text: "あ",
                vowel: "a",
                vowelLength: 0.2,
                pitch: 0,
                consonant: "a",
                consonantLength: 0.1,
              },
            ],
            accent: 1,
            pauseMora: undefined,
          },
        ],
        postPhonemeLength: 0.5,
      };

      // 0.1(pre) + 0.3 + 0.5(post) = 0.9
      expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.9);
    });
  });
});
