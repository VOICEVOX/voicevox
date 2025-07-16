import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import type { TimeSignature } from "@/domain/project/type";

describe("useSequencerLayout", () => {
  const defaultOptions = {
    timeSignatures: ref<TimeSignature[]>([
      { measureNumber: 1, beats: 4, beatType: 4 },
    ]),
    tpqn: ref(480),
    playheadPosition: ref(0),
    sequencerZoomX: ref(1),
    offset: ref(0),
    numMeasures: ref(2), // 2小節分
  };

  it("基本的なレイアウト計算が行える", () => {
    const options = { ...defaultOptions };

    const { tsPositions, totalTicks, measureInfos, rulerWidth, playheadX } =
      useSequencerLayout(options);

    expect(tsPositions.value).toEqual([0]);

    // 2小節分 = 2 * 4 * 480 = 3840tick
    const expectedTotalTicks = 2 * 4 * 480;
    expect(totalTicks.value).toBe(expectedTotalTicks);

    // 2小節分
    expect(measureInfos.value).toHaveLength(2);
    // 1小節目
    expect(measureInfos.value[0]).toEqual({ number: 1, x: 0 });
    // 2小節目
    expect(measureInfos.value[1]).toEqual({ number: 2, x: 480 });

    const expectedWidth = Math.round((expectedTotalTicks / 480) * 120 * 1);
    expect(rulerWidth.value).toBe(expectedWidth);

    expect(playheadX.value).toBe(0);
  });

  it("拍子が途中で変更される場合のレイアウト計算", () => {
    const options = {
      ...defaultOptions,
      timeSignatures: ref<TimeSignature[]>([
        { measureNumber: 1, beats: 4, beatType: 4 },
        { measureNumber: 2, beats: 3, beatType: 4 }, // 2小節目から3/4拍子
      ]),
      numMeasures: ref(3), // 3小節分
    };

    const { tsPositions, measureInfos } = useSequencerLayout(options);

    const measure2StartTicks = 1 * 4 * 480; // 1小節目の終わり
    expect(tsPositions.value).toEqual([0, measure2StartTicks]);

    expect(measureInfos.value).toHaveLength(3);

    expect(measureInfos.value[0]).toEqual({ number: 1, x: 0 });
    expect(measureInfos.value[1]).toEqual({ number: 2, x: 480 });
    expect(measureInfos.value[2].number).toBe(3);
  });

  it("ズーム倍率が反映される", () => {
    const options = {
      ...defaultOptions,
      sequencerZoomX: ref(2),
    };

    const { measureInfos, rulerWidth } = useSequencerLayout(options);

    expect(measureInfos.value[0]).toEqual({ number: 1, x: 0 });
    expect(measureInfos.value[1]).toEqual({ number: 2, x: 960 });

    const expectedTotalTicks = 2 * 4 * 480;
    const expectedWidth = Math.round((expectedTotalTicks / 480) * 120 * 2);
    expect(rulerWidth.value).toBe(expectedWidth);
  });

  it("オフセットが再生ヘッド位置に反映される", () => {
    const options = {
      ...defaultOptions,
      playheadPosition: ref(480),
      offset: ref(100),
    };

    const { playheadX } = useSequencerLayout(options);

    // 再生ヘッド位置の計算: (480 / 480) * 120 * 1 = 120, 120 - 100 = 20
    expect(playheadX.value).toBe(20);
  });
});
