import { describe, expect, it } from "vitest";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import {
  computeVolumeEditableFrameRanges,
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

  it("空の区間リストをマージすると空が返る", () => {
    const actual = mergeVolumeEditableFrameRanges([]);

    expect(actual).toEqual([]);
  });

  it("隣接する区間を1つにマージする", () => {
    const actual = mergeVolumeEditableFrameRanges([
      { startFrame: 5, endFrame: 10 },
      { startFrame: 10, endFrame: 15 },
    ]);

    expect(actual).toEqual([{ startFrame: 5, endFrame: 15 }]);
  });

  it("操作範囲と編集可能区間が重ならない場合は空を返す", () => {
    const actual = getOverlappingVolumeEditableFrameRanges(0, 5, [
      { startFrame: 10, endFrame: 20 },
    ]);

    expect(actual).toEqual([]);
  });

  it("編集可能区間が空の場合は全データがマスクされる", () => {
    const actual = maskVolumeEditDataByEditableRanges([0.1, 0.2, 0.3], 0, []);

    expect(actual).toEqual([
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
    ]);
  });

  it("解決済みフレーズ情報から編集可能区間を計算しマージする", () => {
    const actual = computeVolumeEditableFrameRanges(
      [
        {
          startTime: 1.0,
          volumeLength: 100,
          minNonPauseStartFrame: 10,
          maxNonPauseEndFrame: 80,
        },
        {
          startTime: 2.0,
          volumeLength: 50,
          // minNonPauseStartFrame/maxNonPauseEndFrame が未設定の場合は
          // フレーズ全体が編集可能
        },
      ],
      100, // frameRate
    );

    // phrase1: phraseStart=100, startFrame=100+10=110, endFrame=min(200, 100+80)=180
    // phrase2: phraseStart=200, startFrame=200+0=200, endFrame=min(250, 200+50)=250
    expect(actual).toEqual([
      { startFrame: 110, endFrame: 180 },
      { startFrame: 200, endFrame: 250 },
    ]);
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
