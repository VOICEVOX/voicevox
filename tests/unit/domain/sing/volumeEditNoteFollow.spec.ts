import { describe, expect, it } from "vitest";
import { decibelToLinear } from "@/sing/audio";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import {
  eraseVolumeEditRanges,
  getVolumeEditFrameRangeSymmetricDifference,
  moveVolumeEditData,
  noteToVolumeEditFrameRange,
  remapVolumeEditDataForTempoChange,
  resampleVolumeEditValues,
  sliceVolumeEditData,
  writeVolumeEditSlice,
} from "@/sing/volumeEditNoteFollow";

const NO_DATA = VALUE_INDICATING_NO_DATA;
const TPQN = 480;
const FRAME_RATE = 93.75;
// 120BPM: 1拍=0.5秒、四分音符(480tick)=46.875フレーム
const TEMPOS = [{ position: 0, bpm: 120 }];

describe("noteToVolumeEditFrameRange", () => {
  it("ノートのtick範囲を現在のテンポでフレーム範囲に変換する", () => {
    const range = noteToVolumeEditFrameRange(
      { position: 480, duration: 480 },
      TEMPOS,
      TPQN,
      FRAME_RATE,
    );
    expect(range.startFrame).toBe(47);
    expect(range.endFrame).toBe(94);
  });

  it("開始フレームは0未満にならない", () => {
    const range = noteToVolumeEditFrameRange(
      { position: 0, duration: 480 },
      TEMPOS,
      TPQN,
      FRAME_RATE,
    );
    expect(range.startFrame).toBe(0);
  });
});

describe("sliceVolumeEditData", () => {
  it("範囲の編集値を切り出す", () => {
    expect(
      sliceVolumeEditData([1, 2, 3, 4], { startFrame: 1, endFrame: 3 }),
    ).toEqual([2, 3]);
  });

  it("データ範囲外はデータなしで埋める", () => {
    expect(sliceVolumeEditData([1, 2], { startFrame: 1, endFrame: 4 })).toEqual(
      [2, NO_DATA, NO_DATA],
    );
  });
});

describe("eraseVolumeEditRanges", () => {
  it("指定範囲をデータなしにする", () => {
    expect(
      eraseVolumeEditRanges([1, 2, 3, 4], [{ startFrame: 1, endFrame: 3 }]),
    ).toEqual([1, NO_DATA, NO_DATA, 4]);
  });

  it("元の配列は変更しない", () => {
    const data = [1, 2, 3];
    eraseVolumeEditRanges(data, [{ startFrame: 0, endFrame: 3 }]);
    expect(data).toEqual([1, 2, 3]);
  });
});

describe("getVolumeEditFrameRangeSymmetricDifference", () => {
  it("重なる2範囲の共通部分を除いた区間を返す", () => {
    expect(
      getVolumeEditFrameRangeSymmetricDifference(
        { startFrame: 0, endFrame: 4 },
        { startFrame: 2, endFrame: 6 },
      ),
    ).toEqual([
      { startFrame: 0, endFrame: 2 },
      { startFrame: 4, endFrame: 6 },
    ]);
  });

  it("範囲が重ならない場合は両方を返す", () => {
    expect(
      getVolumeEditFrameRangeSymmetricDifference(
        { startFrame: 0, endFrame: 2 },
        { startFrame: 4, endFrame: 6 },
      ),
    ).toEqual([
      { startFrame: 0, endFrame: 2 },
      { startFrame: 4, endFrame: 6 },
    ]);
  });
});

describe("writeVolumeEditSlice", () => {
  it("編集値列を指定位置に書き込む", () => {
    expect(writeVolumeEditSlice([1, 2, 3, 4], 1, [9, 8])).toEqual([1, 9, 8, 4]);
  });

  it("データなしも含めて範囲を置き換える", () => {
    expect(writeVolumeEditSlice([1, 2, 3], 1, [NO_DATA])).toEqual([
      1,
      NO_DATA,
      3,
    ]);
  });

  it("配列が足りない場合は伸長し、隙間はデータなしで埋める", () => {
    expect(writeVolumeEditSlice([1], 3, [9])).toEqual([1, NO_DATA, NO_DATA, 9]);
  });
});

describe("resampleVolumeEditValues", () => {
  it("長さが同じ場合はそのまま返す", () => {
    expect(resampleVolumeEditValues([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it("dB空間で線形補間してリサンプルする", () => {
    const low = decibelToLinear(-6);
    const high = decibelToLinear(0);
    const result = resampleVolumeEditValues([low, high], 3);
    expect(result[0]).toBeCloseTo(low);
    expect(result[1]).toBeCloseTo(decibelToLinear(-3));
    expect(result[2]).toBeCloseTo(high);
  });

  it("データなしに隣接する位置は最近傍の値を使う", () => {
    const result = resampleVolumeEditValues([1, NO_DATA], 3);
    expect(result[0]).toBe(1);
    expect(result[2]).toBe(NO_DATA);
  });

  it("新しい長さが0以下の場合は空を返す", () => {
    expect(resampleVolumeEditValues([1, 2], 0)).toEqual([]);
  });
});

describe("remapVolumeEditDataForTempoChange", () => {
  it("同じtick位置へ編集値を再配置する", () => {
    const result = remapVolumeEditDataForTempoChange(
      [1, 2, 3, 4],
      [{ position: 0, bpm: 120 }],
      [{ position: 0, bpm: 60 }],
      TPQN,
      4,
    );

    expect(result).toHaveLength(8);
    expect(result[0]).toBe(1);
    expect(result[2]).toBe(2);
    expect(result[4]).toBe(3);
    expect(result[6]).toBe(4);
  });

  it("テンポが変わらない場合は値を変えない", () => {
    expect(
      remapVolumeEditDataForTempoChange(
        [1, NO_DATA, 2],
        TEMPOS,
        TEMPOS,
        TPQN,
        FRAME_RATE,
      ),
    ).toEqual([1, NO_DATA, 2]);
  });
});

describe("moveVolumeEditData", () => {
  it("移動元をクリアし移動先に書き込む", () => {
    const result = moveVolumeEditData(
      [1, 2, NO_DATA, NO_DATA],
      [
        {
          srcRange: { startFrame: 0, endFrame: 2 },
          destRange: { startFrame: 2, endFrame: 4 },
        },
      ],
    );
    expect(result).toEqual([NO_DATA, NO_DATA, 1, 2]);
  });

  it("移動先の既存データは範囲内で置き換えられる", () => {
    const result = moveVolumeEditData(
      [1, 2, 9, 9],
      [
        {
          srcRange: { startFrame: 0, endFrame: 2 },
          destRange: { startFrame: 2, endFrame: 4 },
        },
      ],
    );
    expect(result).toEqual([NO_DATA, NO_DATA, 1, 2]);
  });

  it("移動元と移動先が重なっても値が消えない", () => {
    const result = moveVolumeEditData(
      [1, 2, 3, NO_DATA],
      [
        {
          srcRange: { startFrame: 0, endFrame: 3 },
          destRange: { startFrame: 1, endFrame: 4 },
        },
      ],
    );
    expect(result).toEqual([NO_DATA, 1, 2, 3]);
  });

  it("範囲長が変わる場合はリサンプルされる", () => {
    const result = moveVolumeEditData(
      [1, 1, 1, 1],
      [
        {
          srcRange: { startFrame: 0, endFrame: 4 },
          destRange: { startFrame: 0, endFrame: 2 },
        },
      ],
    );
    expect(result.slice(0, 2)).toEqual([1, 1]);
    expect(result.slice(2)).toEqual([NO_DATA, NO_DATA]);
  });
});
