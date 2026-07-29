import { describe, expect, it } from "vitest";
import { buildVolumeSegments } from "@/components/Sing/SequencerVolumeEditor/renderer";
import {
  findFirstVolumePointAfter,
  findFirstVolumePointAtOrAfter,
  volumeNormalizedYToScreenY,
} from "@/sing/graphics/volumeLine";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";

describe("buildVolumeSegments", () => {
  it("データなし区間で線分を分け、2点未満の線分を除外する", () => {
    const actual = buildVolumeSegments([1, 2, null, 3, null, 4, 5], {
      frameToBaseX: (frame) => frame * 10,
      valueToNormalizedY: (value) => value / 10,
    });

    expect(actual).toEqual([
      [
        { baseX: 0, normalizedY: 0.1 },
        { baseX: 10, normalizedY: 0.2 },
      ],
      [
        { baseX: 50, normalizedY: 0.4 },
        { baseX: 60, normalizedY: 0.5 },
      ],
    ]);
  });

  it("変換後のbaseXが有限値でなければ失敗する", () => {
    expect(() =>
      buildVolumeSegments([1, 2], {
        frameToBaseX: () => Number.NaN,
        valueToNormalizedY: (value) => value,
      }),
    ).toThrow("baseX must be finite.");
  });

  it("高さが奇数でも0dBを表示領域の中心に配置する", () => {
    const normalizedY = relativeVolumeEditMode.valueScale.dbToNormalizedY(0);

    expect(volumeNormalizedYToScreenY(normalizedY, 101)).toBe(50.5);
  });

  it("baseXでソート済みの線分から表示範囲の境界位置を検索できる", () => {
    const segment = [
      { baseX: 0, normalizedY: 0 },
      { baseX: 10, normalizedY: 0 },
      { baseX: 20, normalizedY: 0 },
      { baseX: 30, normalizedY: 0 },
    ];

    expect(findFirstVolumePointAtOrAfter(segment, 20)).toBe(2);
    expect(findFirstVolumePointAtOrAfter(segment, 21)).toBe(3);
    expect(findFirstVolumePointAfter(segment, 20)).toBe(3);
    expect(findFirstVolumePointAfter(segment, 30)).toBe(4);
  });
});
