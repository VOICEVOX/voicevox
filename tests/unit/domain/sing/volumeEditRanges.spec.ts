import { describe, expect, it } from "vitest";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import {
  countVolumeEditDataPoints,
  getOverlappingVolumeEditableFrameRanges,
  isFrameInVolumeEditableRange,
  maskVolumeEditDataByEditableRanges,
  mergeVolumeEditableFrameRanges,
} from "@/sing/volumeEditRanges";

describe("volumeEditRanges", () => {
  it("重なり合う編集可能区間をマージする", () => {
    const actual = mergeVolumeEditableFrameRanges([
      { startFrame: 20, endFrame: 30 },
      { startFrame: 5, endFrame: 10 },
      { startFrame: 10, endFrame: 15 },
      { startFrame: 28, endFrame: 40 },
    ]);

    expect(actual).toEqual([
      { startFrame: 5, endFrame: 15 },
      { startFrame: 20, endFrame: 40 },
    ]);
  });

  it("指定範囲と重なる編集可能区間だけを返す", () => {
    const actual = getOverlappingVolumeEditableFrameRanges(8, 20, [
      { startFrame: 0, endFrame: 6 },
      { startFrame: 10, endFrame: 18 },
      { startFrame: 24, endFrame: 40 },
    ]);

    expect(actual).toEqual([
      { startFrame: 10, endFrame: 18 },
      { startFrame: 24, endFrame: 28 },
    ]);
  });

  it("編集可能区間外のデータをマスクする", () => {
    const actual = maskVolumeEditDataByEditableRanges(
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
      8,
      [
        { startFrame: 9, endFrame: 11 },
        { startFrame: 13, endFrame: 14 },
      ],
    );

    expect(actual).toEqual([
      VALUE_INDICATING_NO_DATA,
      0.2,
      0.3,
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
      0.6,
    ]);
  });

  it("フレームが編集可能区間内にあるか判定できる", () => {
    const ranges = [
      { startFrame: 5, endFrame: 10 },
      { startFrame: 20, endFrame: 25 },
    ];

    expect(isFrameInVolumeEditableRange(4, ranges)).toBe(false);
    expect(isFrameInVolumeEditableRange(5, ranges)).toBe(true);
    expect(isFrameInVolumeEditableRange(10, ranges)).toBe(false);
    expect(isFrameInVolumeEditableRange(24, ranges)).toBe(true);
  });

  it("有効な編集データ点数を数える", () => {
    const actual = countVolumeEditDataPoints([
      0.1,
      VALUE_INDICATING_NO_DATA,
      0.2,
    ]);

    expect(actual).toBe(2);
  });

  it("startFrame=0でマスクするとpruneとして機能する", () => {
    const editData = [0.1, 0.2, VALUE_INDICATING_NO_DATA, 0.4, 0.5, 0.6, 0.7];
    const ranges = [
      { startFrame: 1, endFrame: 2 },
      { startFrame: 5, endFrame: 6 },
    ];

    const actual = maskVolumeEditDataByEditableRanges(editData, 0, ranges);

    expect(actual).toEqual([
      VALUE_INDICATING_NO_DATA,
      0.2,
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
      0.6,
      VALUE_INDICATING_NO_DATA,
    ]);
  });
});
