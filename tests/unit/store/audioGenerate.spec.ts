import { describe, it, expect } from "vitest";
import { calculateAudioLength } from "@/store/audioGenerate";
import { EditorAudioQuery } from "@/store/type";

describe("audioGenerate", () => {
    describe("calculateAudioLength", () => {
        it("アクセント句がない場合は0を返すこと", () => {
            const audioQuery = {
                accentPhrases: [],
                prePhonemeLength: 0.1,
                postPhonemeLength: 0.1,
                speedScale: 1,
                pitchScale: 0,
                intonationScale: 1,
                volumeScale: 1,
                pauseLengthScale: 1,
                outputSamplingRate: 24000,
                outputStereo: false,
                kana: "",
            } as unknown as EditorAudioQuery;

            expect(calculateAudioLength(audioQuery)).toBe(0);
        });

        it("アクセント句がある場合の計算が正しいこと(speedScale=1)", () => {
            const audioQuery = {
                accentPhrases: [
                    {
                        moras: [
                            { consonantLength: 0.1, vowelLength: 0.2 }, // 0.3
                            { consonantLength: undefined, vowelLength: 0.2 }, // 0.2
                        ],
                        pauseMora: undefined,
                    },
                ],
                prePhonemeLength: 0.1,
                postPhonemeLength: 0.1,
                speedScale: 1,
                pauseLengthScale: 1,
            } as unknown as EditorAudioQuery;

            // 0.1(pre) + 0.3 + 0.2 + 0.1(post) = 0.7
            expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.7);
        });

        it("speedScaleが反映されること", () => {
            const audioQuery = {
                accentPhrases: [
                    {
                        moras: [{ consonantLength: 0.1, vowelLength: 0.2 }],
                        pauseMora: undefined,
                    },
                ],
                prePhonemeLength: 0.1,
                postPhonemeLength: 0.1,
                speedScale: 2, // 2倍速
                pauseLengthScale: 1,
            } as unknown as EditorAudioQuery;

            // (0.1(pre) + 0.3 + 0.1(post)) / 2 = 0.25
            expect(calculateAudioLength(audioQuery)).toBeCloseTo(0.25);
        });

        it("ポーズがある場合の計算が正しいこと", () => {
            const audioQuery = {
                accentPhrases: [
                    {
                        moras: [{ consonantLength: 0.1, vowelLength: 0.2 }],
                        pauseMora: { vowelLength: 0.5 }, // 0.5 * 1.5 = 0.75
                    },
                ],
                prePhonemeLength: 0.1,
                postPhonemeLength: 0.1,
                speedScale: 1,
                pauseLengthScale: 1.5,
            } as unknown as EditorAudioQuery;

            // 0.1 + 0.3 + 0.75 + 0.1 = 1.25
            expect(calculateAudioLength(audioQuery)).toBeCloseTo(1.25);
        });
    });
});
