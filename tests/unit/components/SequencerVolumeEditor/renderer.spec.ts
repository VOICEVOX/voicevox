import { describe, expect, it } from "vitest";
import {
  buildVolumeSegments,
  filterVolumeSegmentsByBaseXRange,
} from "@/components/Sing/SequencerVolumeEditor/renderer";
import {
  computeVisibleVolumePointRange,
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

describe("filterVolumeSegmentsByBaseXRange", () => {
  const point = (baseX: number) => ({ baseX, normalizedY: 0 });
  const segment = [point(0), point(10), point(20), point(30)];

  it("範囲が未指定なら空を返す", () => {
    expect(filterVolumeSegmentsByBaseXRange([segment], undefined)).toEqual([]);
  });

  it("範囲に完全に含まれる線分はそのまま返す", () => {
    const actual = filterVolumeSegmentsByBaseXRange([segment], {
      startBaseX: 0,
      endBaseX: 30,
    });

    expect(actual).toEqual([segment]);
  });

  it("部分的に重なる線分は範囲内の点だけに切り出す", () => {
    const actual = filterVolumeSegmentsByBaseXRange([segment], {
      startBaseX: 5,
      endBaseX: 25,
    });

    expect(actual).toEqual([[point(10), point(20)]]);
  });

  it("範囲の境界上にある点は含める", () => {
    const actual = filterVolumeSegmentsByBaseXRange([segment], {
      startBaseX: 10,
      endBaseX: 20,
    });

    expect(actual).toEqual([[point(10), point(20)]]);
  });

  it("範囲と重ならない線分は除外する", () => {
    const actual = filterVolumeSegmentsByBaseXRange([segment], {
      startBaseX: 40,
      endBaseX: 50,
    });

    expect(actual).toEqual([]);
  });

  it("切り出し後に2点未満になる線分は除外する", () => {
    const actual = filterVolumeSegmentsByBaseXRange([segment], {
      startBaseX: 12,
      endBaseX: 25,
    });

    expect(actual).toEqual([]);
  });
});

describe("computeVisibleVolumePointRange", () => {
  const point = (baseX: number) => ({ baseX, normalizedY: 0 });
  const segment = [point(0), point(10), point(20), point(30)];
  const viewInfo = {
    viewportHeight: 100,
    zoomX: 1,
    leftPadding: 0,
  };

  it("可視範囲の前後1点を含むインデックス範囲を返す", () => {
    // 可視範囲はbaseX 12〜22
    const actual = computeVisibleVolumePointRange(segment, {
      ...viewInfo,
      viewportWidth: 10,
      offsetX: 12,
    });

    expect(actual).toEqual({ startIndex: 1, endIndex: 4 });
  });

  it("線分全体が可視範囲に収まる場合は全点を返す", () => {
    const actual = computeVisibleVolumePointRange(segment, {
      ...viewInfo,
      viewportWidth: 40,
      offsetX: -5,
    });

    expect(actual).toEqual({ startIndex: 0, endIndex: 4 });
  });

  it("可視範囲が線分より後ろの場合は末尾1点のみの範囲を返す", () => {
    const actual = computeVisibleVolumePointRange(segment, {
      ...viewInfo,
      viewportWidth: 10,
      offsetX: 100,
    });

    expect(actual).toEqual({ startIndex: 3, endIndex: 4 });
  });
});
