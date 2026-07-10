import { describe, expect, it } from "vitest";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import { buildVolumeEditDisplayData } from "@/sing/volumeEditDisplay";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";

const NO_DATA = VALUE_INDICATING_NO_DATA;

const buildDisplayData = (
  options: Partial<Parameters<typeof buildVolumeEditDisplayData>[0]>,
) =>
  buildVolumeEditDisplayData({
    volumeEditData: [],
    editableRanges: [],
    volumeEditMode: relativeVolumeEditMode,
    ...options,
  });

describe("buildVolumeEditDisplayData", () => {
  it("編集可能区間外を非表示にし、区間内の未編集フレームを0dB保存値で埋める", () => {
    const actual = buildDisplayData({
      volumeEditData: [2, NO_DATA, 3, 4],
      editableRanges: [{ startFrame: 1, endFrame: 5 }],
    });

    expect(actual.effectiveFramewise).toEqual([NO_DATA, 1, 3, 4, 1]);
    expect(actual.previewEraseRanges).toEqual([]);
  });

  it("描画プレビューを編集可能区間内だけに反映する", () => {
    const actual = buildDisplayData({
      volumeEditData: [NO_DATA, NO_DATA, NO_DATA],
      previewEdit: { type: "draw", startFrame: 1, data: [9, 0.5, 0.75] },
      editableRanges: [{ startFrame: 2, endFrame: 4 }],
    });

    expect(actual.effectiveFramewise).toEqual([NO_DATA, NO_DATA, 0.5, 0.75]);
  });

  it("消去プレビューの重なった編集可能区間を返す", () => {
    const actual = buildDisplayData({
      volumeEditData: [2, 3, 4, 5],
      previewEdit: { type: "erase", startFrame: 1, frameLength: 3 },
      editableRanges: [{ startFrame: 2, endFrame: 4 }],
    });

    expect(actual.effectiveFramewise).toEqual([NO_DATA, NO_DATA, 1, 1]);
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
