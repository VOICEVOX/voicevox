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

// TODO: 後続PRのdBオフセット適用への変更にあわせて、
// フレーズ開始位置・非pau区間などのテストを追加する。
describe("applyVolumeEdit", () => {
  it("dB変更量をクエリのボリュームへ適用する", () => {
    const query = createQuery([0.1, 0.2, 0.3]);

    applyVolumeEdit(query, 0, [-6, null, 6], frameRate, undefined, undefined);

    expect(query.volume[0]).toBeCloseTo(0.1 * decibelToLinear(-6));
    expect(query.volume[1]).toBe(0.2);
    expect(query.volume[2]).toBeCloseTo(0.3 * decibelToLinear(6));
  });
});
