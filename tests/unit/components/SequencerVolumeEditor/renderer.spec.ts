import { describe, expect, it } from "vitest";
import {
  buildVolumeSegments,
  buildVolumeEndpointNodes,
  isVolumeEndpointInFeedbackRange,
  splitVolumeSegmentAtBaseline,
  filterVolumeSegmentsByBaseXRange,
} from "@/components/Song/SequencerVolumeEditor/renderer";
import {
  computeVisibleVolumePointRange,
  findFirstVolumePointAfter,
  findFirstVolumePointAtOrAfter,
  volumeNormalizedYToScreenY,
} from "@/song/graphics/volumeLine";
import { relativeVolumeEditMode } from "@/song/volumeEditMode";

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

describe("splitVolumeSegmentAtBaseline", () => {
  const point = (baseX: number, normalizedY: number) => ({
    baseX,
    normalizedY,
  });

  it("基準線を跨ぐ位置を補間し、増幅と減衰の面を分ける", () => {
    expect(
      splitVolumeSegmentAtBaseline([point(0, 0.75), point(30, 0)], 0.5),
    ).toEqual([
      [point(0, 0.75), point(10, 0.5)],
      [point(10, 0.5), point(30, 0)],
    ]);
  });

  it("0dBの平坦部は塗らず、前後の面をその端まで描く", () => {
    expect(
      splitVolumeSegmentAtBaseline(
        [point(0, 0.75), point(10, 0.5), point(20, 0.5), point(30, 0.25)],
        0.5,
      ),
    ).toEqual([
      [point(0, 0.75), point(10, 0.5)],
      [point(20, 0.5), point(30, 0.25)],
    ]);
    expect(
      splitVolumeSegmentAtBaseline([point(0, 0.5), point(10, 0.5)], 0.5),
    ).toEqual([]);
  });
});

describe("buildVolumeEndpointNodes", () => {
  const point = (baseX: number, normalizedY = 0.5) => ({ baseX, normalizedY });
  const viewInfo = {
    viewportWidth: 200,
    viewportHeight: 100,
    zoomX: 1,
    offsetX: 0,
    leftPadding: 48,
  };

  it("中間の編集位置に丸を付けず、区間の両端だけに配置する", () => {
    expect(
      buildVolumeEndpointNodes(
        [[point(0), point(20, 0.75), point(40)]],
        viewInfo,
      ),
    ).toEqual([
      { x: 48, y: 50, startBaseX: 0, endBaseX: 0 },
      { x: 88, y: 50, startBaseX: 40, endBaseX: 40 },
    ]);
  });

  it("横距離が8px未満の隣接端点を中間位置に統合する", () => {
    expect(
      buildVolumeEndpointNodes(
        [
          [point(0), point(20, 0.75)],
          [point(27, 0.25), point(50)],
        ],
        viewInfo,
      ),
    ).toEqual([
      { x: 48, y: 50, startBaseX: 0, endBaseX: 0 },
      { x: 71.5, y: 50, startBaseX: 20, endBaseX: 27 },
      { x: 98, y: 50, startBaseX: 50, endBaseX: 50 },
    ]);
  });

  it("8pxちょうどでは統合せず、判定にはズーム後の距離を使う", () => {
    expect(
      buildVolumeEndpointNodes([[point(0), point(4)]], {
        ...viewInfo,
        zoomX: 2,
      }),
    ).toEqual([
      { x: 48, y: 50, startBaseX: 0, endBaseX: 0 },
      { x: 56, y: 50, startBaseX: 4, endBaseX: 4 },
    ]);
    expect(buildVolumeEndpointNodes([[point(0), point(4)]], viewInfo)).toEqual([
      { x: 50, y: 50, startBaseX: 0, endBaseX: 4 },
    ]);
  });

  it("スクロール端に偽の端点を作らず、1点だけの区間も表示しない", () => {
    expect(
      buildVolumeEndpointNodes(
        [[point(0), point(40), point(300)], [point(320)]],
        { ...viewInfo, offsetX: 20 },
      ),
    ).toEqual([]);
  });
});

describe("isVolumeEndpointInFeedbackRange", () => {
  it("ホバー・描画の範囲だけ端点を強調する", () => {
    const feedbackRange = { startBaseX: 0, endBaseX: 25 };
    expect(
      isVolumeEndpointInFeedbackRange(
        { startBaseX: 20, endBaseX: 20 },
        feedbackRange,
      ),
    ).toBe(true);
    expect(
      isVolumeEndpointInFeedbackRange(
        { startBaseX: 30, endBaseX: 30 },
        feedbackRange,
      ),
    ).toBe(false);
  });

  it("統合した端点も片側の強調を引き継ぎ、範囲がなくなれば通常に戻る", () => {
    const merged = { startBaseX: 20, endBaseX: 27 };
    expect(
      isVolumeEndpointInFeedbackRange(merged, {
        startBaseX: 27,
        endBaseX: 50,
      }),
    ).toBe(true);
    expect(isVolumeEndpointInFeedbackRange(merged, undefined)).toBe(false);
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
