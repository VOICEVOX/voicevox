import { describe, expect, it } from "vitest";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import {
  deriveVolumeEditableFrameRanges,
  findVolumeEditableFrameRange,
  getOverlappingVolumeEditableFrameRanges,
  isFrameInVolumeEditableRange,
  maskVolumeEditDataByEditableRanges,
  mergeVolumeEditableFrameRanges,
} from "@/sing/volumeEditRanges";

const phrase = (
  options: Partial<{
    trackId: string;
    queryKey: string;
    singingVolumeKey: string;
    startTime: number;
    minNonPauseStartFrame: number | undefined;
    maxNonPauseEndFrame: number | undefined;
  }>,
) => ({
  trackId: "track-1",
  queryKey: "query-1",
  singingVolumeKey: "volume-1",
  startTime: 0,
  minNonPauseStartFrame: undefined,
  maxNonPauseEndFrame: undefined,
  ...options,
});

describe("volumeEditRanges", () => {
  it("重なり・隣接する編集可能区間をマージする", () => {
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
      { values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], startFrame: 8 },
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

  it("フレームを含む編集可能区間を返す", () => {
    const ranges = [
      { startFrame: 5, endFrame: 10 },
      { startFrame: 20, endFrame: 25 },
    ];

    expect(findVolumeEditableFrameRange(4, ranges)).toBeUndefined();
    expect(findVolumeEditableFrameRange(5, ranges)).toEqual({
      startFrame: 5,
      endFrame: 10,
    });
    expect(findVolumeEditableFrameRange(10, ranges)).toBeUndefined();
    expect(findVolumeEditableFrameRange(24, ranges)).toEqual({
      startFrame: 20,
      endFrame: 25,
    });
  });

  it("空の区間リストをマージすると空が返る", () => {
    const actual = mergeVolumeEditableFrameRanges([]);

    expect(actual).toEqual([]);
  });

  it("操作範囲と編集可能区間が重ならない場合は空を返す", () => {
    const actual = getOverlappingVolumeEditableFrameRanges(0, 5, [
      { startFrame: 10, endFrame: 20 },
    ]);

    expect(actual).toEqual([]);
  });

  it("編集可能区間が空の場合は全データがマスクされる", () => {
    const actual = maskVolumeEditDataByEditableRanges(
      { values: [0.1, 0.2, 0.3], startFrame: 0 },
      [],
    );

    expect(actual).toEqual([
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
      VALUE_INDICATING_NO_DATA,
    ]);
  });

  it("startFrame=0でマスクするとpruneとして機能する", () => {
    const editData = [0.1, 0.2, VALUE_INDICATING_NO_DATA, 0.4, 0.5, 0.6, 0.7];
    const ranges = [
      { startFrame: 1, endFrame: 2 },
      { startFrame: 5, endFrame: 6 },
    ];

    const actual = maskVolumeEditDataByEditableRanges(
      { values: editData, startFrame: 0 },
      ranges,
    );

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

  it("フレーズの非pau区間から編集可能範囲を導出する", () => {
    const actual = deriveVolumeEditableFrameRanges({
      phrases: [
        phrase({
          startTime: 1,
          minNonPauseStartFrame: 2,
          maxNonPauseEndFrame: 6,
        }),
        phrase({
          trackId: "track-2",
          startTime: 3,
        }),
      ],
      phraseQueries: new Map([["query-1", { frameRate: 10 }]]),
      phraseSingingVolumes: new Map([["volume-1", new Array<number>(8)]]),
      trackId: "track-1",
      frameRate: 10,
    });

    expect(actual).toEqual([{ startFrame: 12, endFrame: 16 }]);
  });

  it("歌唱ボリュームが未生成のフレーズは編集可能範囲に含めない", () => {
    const actual = deriveVolumeEditableFrameRanges({
      phrases: [
        phrase({
          singingVolumeKey: undefined,
          queryKey: undefined,
        }),
      ],
      phraseQueries: new Map(),
      phraseSingingVolumes: new Map(),
      trackId: "track-1",
      frameRate: 10,
    });

    expect(actual).toEqual([]);
  });

  it("導出した編集可能範囲はマージされる", () => {
    const actual = deriveVolumeEditableFrameRanges({
      phrases: [
        phrase({
          startTime: 0,
          singingVolumeKey: "volume-1",
        }),
        phrase({
          startTime: 1,
          singingVolumeKey: "volume-2",
        }),
      ],
      phraseQueries: new Map([["query-1", { frameRate: 10 }]]),
      phraseSingingVolumes: new Map([
        ["volume-1", new Array<number>(10)],
        ["volume-2", new Array<number>(10)],
      ]),
      trackId: "track-1",
      frameRate: 10,
    });

    expect(actual).toEqual([{ startFrame: 0, endFrame: 20 }]);
  });

  it("歌唱ボリュームがあるフレーズにqueryKeyが無い場合はエラーにする", () => {
    expect(() =>
      deriveVolumeEditableFrameRanges({
        phrases: [phrase({ queryKey: undefined })],
        phraseQueries: new Map(),
        phraseSingingVolumes: new Map([["volume-1", new Array<number>(8)]]),
        trackId: "track-1",
        frameRate: 10,
      }),
    ).toThrow("phrase.queryKey is undefined.");
  });

  it("歌唱ガイドと編集のフレームレートが一致しない場合はエラーにする", () => {
    expect(() =>
      deriveVolumeEditableFrameRanges({
        phrases: [phrase({})],
        phraseQueries: new Map([["query-1", { frameRate: 20 }]]),
        phraseSingingVolumes: new Map([["volume-1", new Array<number>(8)]]),
        trackId: "track-1",
        frameRate: 10,
      }),
    ).toThrow(
      "The frame rate between the singing guide and the edit does not match.",
    );
  });
});
