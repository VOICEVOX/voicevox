import { describe, it, expect } from "vitest";
import {
  ticksToSnappedBeat,
  calculateEndTicks,
  calculateMeasureInfos,
} from "@/sing/rulerHelper";
import type { TimeSignature } from "@/store/type";

describe("rulerHelper", () => {
  describe("ticksToSnappedBeat", () => {
    const tpqn = 480;

    it("4/4拍子で拍にスナップする", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];

      // 0tickは1拍目にスナップ
      expect(ticksToSnappedBeat(0, timeSignatures, tpqn)).toBe(0);
      // 239tickは2拍目にスナップ（0に近い）
      expect(ticksToSnappedBeat(239, timeSignatures, tpqn)).toBe(0);
      // 240tickは2拍目にスナップ
      expect(ticksToSnappedBeat(240, timeSignatures, tpqn)).toBe(480);
    });

    it("拍子記号が途中から変更されていても適切にスナップする", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
        { measureNumber: 2, beats: 3, beatType: 4 },
      ];

      // 2小節目の開始位置は4拍後（4 * 480 = 1920tick）
      const measure2Start = 4 * tpqn;
      // 2小節目の1拍目近く
      const targetTick = measure2Start + 200;
      // 2小節目の1拍目にスナップするはず
      expect(ticksToSnappedBeat(targetTick, timeSignatures, tpqn)).toBe(
        measure2Start,
      );
    });
  });

  describe("calculateEndTicks", () => {
    const tpqn = 480;

    it("4/4拍子で8小節の終了位置を計算する", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];
      const tsPositions = [0];
      const numMeasures = 8;

      // 8小節分 = 8 * 4 * 480 = 15360tick
      const expected = 8 * 4 * tpqn;
      expect(
        calculateEndTicks(timeSignatures, tsPositions, numMeasures, tpqn),
      ).toBe(expected);
    });

    it("拍子が変更される場合の終了位置を計算する", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
        { measureNumber: 2, beats: 3, beatType: 4 },
      ];
      const tsPositions = [0, 1 * 4 * tpqn]; // 2小節目は1小節分後
      const numMeasures = 4;

      // 最後の拍子から: 4 - (2 - 1) = 3小節分
      // 3/4拍子の3小節分 = 3 * 3 * 480 = 4320tick
      const expected = tsPositions[1] + 3 * 3 * tpqn;
      expect(
        calculateEndTicks(timeSignatures, tsPositions, numMeasures, tpqn),
      ).toBe(expected);
    });
  });

  describe("calculateMeasureInfos", () => {
    const tpqn = 480;
    const sequencerZoomX = 1;

    it("4/4拍子で2小節分の小節情報を生成できる", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];
      const tsPositions = [0];
      const endTicks = 2 * 4 * tpqn;

      const result = calculateMeasureInfos(
        timeSignatures,
        tsPositions,
        endTicks,
        tpqn,
        sequencerZoomX,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ number: 1, x: 0 });
      expect(result[1]).toEqual({
        number: 2,
        x: Math.round(4 * 120 * sequencerZoomX),
      });
    });

    it("ズーム倍率が反映される", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];
      const tsPositions = [0];
      const endTicks = 2 * 4 * tpqn;
      const zoomX = 2;

      const result = calculateMeasureInfos(
        timeSignatures,
        tsPositions,
        endTicks,
        tpqn,
        zoomX,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ number: 1, x: 0 });
      expect(result[1]).toEqual({
        number: 2,
        x: Math.round(4 * 120 * zoomX),
      });
    });
  });
});
