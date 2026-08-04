import { describe, expect, it } from "vitest";
import type { EditorFrameAudioQuery } from "@/store/type";
import { decibelToLinear } from "@/sing/audio";
import { applyVolumeEdit } from "@/sing/domain";

const frameRate = 100;

const createQuery = (volume: number[]): EditorFrameAudioQuery => ({
  f0: Array.from({ length: volume.length }, () => 0),
  volume,
  phonemes: [],
  volumeScale: 1,
  outputSamplingRate: 24000,
  outputStereo: false,
  frameRate,
});

describe("applyVolumeEdit", () => {
  it("dB変更量をクエリのボリュームへ適用する", () => {
    const query = createQuery([0.1, 0.2, 0.3]);

    applyVolumeEdit(query, 0, [-6, null, 6], frameRate, undefined, undefined);

    expect(query.volume[0]).toBeCloseTo(0.1 * decibelToLinear(-6));
    expect(query.volume[1]).toBe(0.2);
    expect(query.volume[2]).toBeCloseTo(0.3 * decibelToLinear(6));
  });

  it("フレーズ開始位置に対応するフレームから適用する", () => {
    const query = createQuery([0.1, 0.2, 0.3]);

    applyVolumeEdit(
      query,
      0.02,
      [12, 12, -6, 6, null],
      frameRate,
      undefined,
      undefined,
    );

    expect(query.volume[0]).toBeCloseTo(0.1 * decibelToLinear(-6));
    expect(query.volume[1]).toBeCloseTo(0.2 * decibelToLinear(6));
    expect(query.volume[2]).toBe(0.3);
  });

  it("非pau区間にだけ適用する", () => {
    const query = createQuery([0.1, 0.2, 0.3, 0.4]);

    applyVolumeEdit(query, 0, [6, 6, 6, 6], frameRate, 1, 3);

    expect(query.volume[0]).toBe(0.1);
    expect(query.volume[1]).toBeCloseTo(0.2 * decibelToLinear(6));
    expect(query.volume[2]).toBeCloseTo(0.3 * decibelToLinear(6));
    expect(query.volume[3]).toBe(0.4);
  });
});
