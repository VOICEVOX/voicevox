import { describe, expect, it } from "vitest";
import { buildVolumeEditDisplayData } from "@/sing/volumeEditDisplay";

const buildDisplayData = (
  options: Partial<Parameters<typeof buildVolumeEditDisplayData>[0]>,
) =>
  buildVolumeEditDisplayData({
    volumeEditData: [],
    editableRanges: [],
    ...options,
  });

describe("buildVolumeEditDisplayData", () => {
  it("編集可能区間外を非表示にし、区間内の未編集フレームを0dB保存値で埋める", () => {
    const actual = buildDisplayData({
      volumeEditData: [2, null, 3, 4],
      editableRanges: [{ startFrame: 1, endFrame: 5 }],
    });

    expect(actual.effectiveFramewise).toEqual([null, 0, 3, 4, 0]);
    expect(actual.previewEraseRanges).toEqual([]);
  });

  it("描画プレビューを編集可能区間内だけに反映する", () => {
    const actual = buildDisplayData({
      volumeEditData: [null, null, null],
      previewEdit: { type: "draw", startFrame: 1, data: [9, 0.5, 0.75] },
      editableRanges: [{ startFrame: 2, endFrame: 4 }],
    });

    expect(actual.effectiveFramewise).toEqual([null, null, 0.5, 0.75]);
  });

  it("消去プレビューの重なった編集可能区間を返す", () => {
    const actual = buildDisplayData({
      volumeEditData: [2, 3, 4, 5],
      previewEdit: { type: "erase", startFrame: 1, frameLength: 3 },
      editableRanges: [{ startFrame: 2, endFrame: 4 }],
    });

    expect(actual.effectiveFramewise).toEqual([null, null, 0, 0]);
    expect(actual.previewEraseRanges).toEqual([{ startFrame: 2, endFrame: 4 }]);
  });

  it("元のボリューム編集データを変更しない", () => {
    const volumeEditData = [2, 3, 4];

    buildDisplayData({
      volumeEditData,
      previewEdit: { type: "erase", startFrame: 0, frameLength: 2 },
      editableRanges: [{ startFrame: 0, endFrame: 3 }],
    });

    expect(volumeEditData).toEqual([2, 3, 4]);
  });
});
