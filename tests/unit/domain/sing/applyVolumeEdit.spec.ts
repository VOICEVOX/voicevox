import { describe, expect, it } from "vitest";
import type { EditorFrameAudioQuery } from "@/store/type";
import { applyVolumeEdit, VALUE_INDICATING_NO_DATA } from "@/sing/domain";

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
  it("絶対値の編集データをクエリのボリュームへ適用する", () => {
    const query = createQuery([0.1, 0.2, 0.3]);

    applyVolumeEdit(
      query,
      0,
      [0.5, VALUE_INDICATING_NO_DATA, 0.7],
      frameRate,
      undefined,
      undefined,
    );

    expect(query.volume).toEqual([0.5, 0.2, 0.7]);
  });

  it("負の編集値は0にクランプする", () => {
    const query = createQuery([0.1]);

    applyVolumeEdit(query, 0, [-0.1], frameRate, undefined, undefined);

    expect(query.volume).toEqual([0]);
  });
});
