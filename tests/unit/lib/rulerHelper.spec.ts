import { describe, it, expect } from "vitest";
import {
  snapTickToBeat,
  getTotalTicks,
  calculateMeasureInfos,
} from "@/sing/rulerHelper";
import type { TimeSignature } from "@/domain/project/type";

describe("rulerHelper", () => {
  describe("ticksToSnappedBeat", () => {
    const tpqn = 480;

    it("4/4拍子で拍にスナップする", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];

      // 0tickは1拍目にスナップ
      expect(snapTickToBeat(0, timeSignatures, tpqn)).toBe(0);
      // 239tickは1拍目にスナップ（0に近い）
      expect(snapTickToBeat(239, timeSignatures, tpqn)).toBe(0);
      // 240tickは2拍目にスナップ
      expect(snapTickToBeat(240, timeSignatures, tpqn)).toBe(480);
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
      expect(snapTickToBeat(targetTick, timeSignatures, tpqn)).toBe(
        measure2Start,
      );
    });

    it("beatTypeが7/3拍子に変更される場合に適切にスナップする", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
        { measureNumber: 2, beats: 7, beatType: 3 }, // 7/3拍子
      ];

      // 2小節目の開始位置は4拍後（4 * 480 = 1920tick）
      const measure2Start = 4 * tpqn;
      // 2小節目の3分音符1個分の位置近く（3分音符 = 640tick）
      const targetTick = measure2Start + 600;
      // 2小節目の3分音符にスナップするはず（640tick）
      const expected = measure2Start + 640; // 3分音符1個分
      expect(snapTickToBeat(targetTick, timeSignatures, tpqn)).toBe(expected);
    });
  });

  describe("getTotalTicks", () => {
    const tpqn = 480;

    it("4/4拍子で8小節の終了位置を計算する", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];
      const numMeasures = 8;

      // 8小節分 = 8 * 4 * 480 = 15360tick
      const expected = 8 * 4 * tpqn;
      expect(getTotalTicks(timeSignatures, numMeasures, tpqn)).toBe(expected);
    });

    it("拍子が4/4から3/4に変更される場合の終了位置を計算する", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
        { measureNumber: 2, beats: 3, beatType: 4 },
      ];
      const numMeasures = 4;

      // 最後の拍子から: 4 - (2 - 1) = 3小節分
      // 3/4拍子の3小節分 = 3 * 3 * 480 = 4320tick
      const measure2Start = 1 * 4 * tpqn; // 2小節目は1小節分後
      const expected = measure2Start + 3 * 3 * tpqn;
      expect(getTotalTicks(timeSignatures, numMeasures, tpqn)).toBe(expected);
    });

    it("拍子が4/4から7/3拍子に変更される場合の終了位置を計算する", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 }, // 4/4拍子
        { measureNumber: 2, beats: 7, beatType: 3 }, // 7/3拍子
      ];
      const numMeasures = 3;

      // 1小節目: 4/4拍子 = 4 * 480 = 1920tick
      // 2-3小節目: 7/3拍子 = 7 * (480 * 4 / 3) = 7 * 640 = 4480tick per measure
      // 最後の拍子から: 3 - (2 - 1) = 2小節分
      const measure2Start = 1 * 4 * tpqn; // 1920tick
      const measure3rdDuration = (tpqn * 4) / 3; // 3分音符 = 640tick
      const expected = measure2Start + 2 * 7 * measure3rdDuration; // 1920 + 8960 = 10880tick
      expect(getTotalTicks(timeSignatures, numMeasures, tpqn)).toBe(expected);
    });
  });

  describe("calculateMeasureInfos", () => {
    const tpqn = 480;
    const sequencerZoomX = 1;

    it("4/4拍子で2小節分の小節情報を生成できる", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 },
      ];
      const numMeasures = 2;

      const result = calculateMeasureInfos(
        timeSignatures,
        numMeasures,
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
      const numMeasures = 2;
      const zoomX = 2;

      const result = calculateMeasureInfos(
        timeSignatures,
        numMeasures,
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

    it("拍子が4/4から7/3に変更される場合の小節情報を生成できる", () => {
      const timeSignatures: TimeSignature[] = [
        { measureNumber: 1, beats: 4, beatType: 4 }, // 4/4拍子
        { measureNumber: 2, beats: 7, beatType: 3 }, // 7/3拍子
      ];
      const numMeasures = 3;

      const result = calculateMeasureInfos(
        timeSignatures,
        numMeasures,
        tpqn,
        sequencerZoomX,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ number: 1, x: 0 });

      // 2小節目: 4/4拍子の1小節分後 = 4 * 120 = 480
      expect(result[1]).toEqual({
        number: 2,
        x: Math.round(4 * 120 * sequencerZoomX),
      });

      // 3小節目: 2小節目の開始位置 + 7/3拍子1小節分
      // 7/3拍子 = 7 * (480 * 4 / 3) / 480 * 120 = 7 * 160 = 1120
      const measure3X = Math.round((4 * 120 + 7 * 160) * sequencerZoomX);
      expect(result[2]).toEqual({
        number: 3,
        x: measure3X,
      });
    });
  });
});
