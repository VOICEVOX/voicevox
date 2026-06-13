import { describe, it, expect } from "vitest";
import { generateWaveformPeaks, resamplePeaks } from "@/sing/waveformPeaks";
import { createArray } from "@/sing/utility";

function makeAudioBuffer(samples: number[], sampleRate = 24000): AudioBuffer {
  const channel = new Float32Array(samples);
  return {
    length: channel.length,
    sampleRate,
    numberOfChannels: 1,
    duration: channel.length / sampleRate,
    getChannelData: (ch: number) => {
      if (ch !== 0) {
        throw new Error("only ch0 supported in test");
      }
      return channel;
    },
  } as unknown as AudioBuffer;
}

/**
 * レベル0のバケツ（16サンプル）ごとにmin/maxを指定してサンプル配列を作る。
 * 各バケツは先頭サンプルがmin、2番目のサンプルがmax、残り14サンプルが0になる。
 * 0埋め部分がそのバケツのmin/maxに影響しないよう、min <= 0 <= max でなければならない。
 */
function makeBucketSamples(
  bucketMinMaxList: [min: number, max: number][],
): number[] {
  const samples: number[] = [];
  for (const [min, max] of bucketMinMaxList) {
    if (min > 0 || max < 0) {
      throw new Error("min <= 0 <= max でなければなりません。");
    }
    samples.push(min, max, ...createArray(14, () => 0));
  }
  return samples;
}

function expectFloat32ArrayCloseTo(actual: Float32Array, expected: number[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i]);
  }
}

describe("generateWaveformPeaks", () => {
  it("16サンプル以下ならバケツ1個のレベルが1つだけできる", () => {
    const peaks = generateWaveformPeaks(makeAudioBuffer([0.1, -0.2, 0.3]));
    expect(peaks.length).toBe(1);
    expect(peaks[0].bucketSize).toBe(16);
    expectFloat32ArrayCloseTo(peaks[0].minBuckets, [-0.2]);
    expectFloat32ArrayCloseTo(peaks[0].maxBuckets, [0.3]);
  });

  it("レベル0は16サンプルごとのバケツになり、各バケツがその範囲のmin/maxを持つ", () => {
    // バケツ0（[0, 16)）: min -0.4（i=3）, max 0.6（i=10）
    // バケツ1（[16, 32)）: min -0.7（i=25）, max 0.8（i=20）
    const samples = createArray(32, (i) => {
      if (i === 3) {
        return -0.4;
      }
      if (i === 10) {
        return 0.6;
      }
      if (i === 20) {
        return 0.8;
      }
      if (i === 25) {
        return -0.7;
      }
      return 0;
    });
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    expect(peaks[0].bucketSize).toBe(16);
    expectFloat32ArrayCloseTo(peaks[0].minBuckets, [-0.4, -0.7]);
    expectFloat32ArrayCloseTo(peaks[0].maxBuckets, [0.6, 0.8]);
  });

  it("サンプル数が16の倍数でないとき、最後のバケツは端数サンプルのみで計算される", () => {
    // 16サンプルの0埋めバケツ + 端数4サンプル
    const samples = [...createArray(16, () => 0), 0.1, -0.3, 0.5, 0.2];
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // ceil(20 / 16) = 2バケツで、バケツ1は [16, 20) の4サンプルのみ
    expectFloat32ArrayCloseTo(peaks[0].minBuckets, [0, -0.3]);
    expectFloat32ArrayCloseTo(peaks[0].maxBuckets, [0, 0.5]);
  });

  it("バケツ数が1になるまで、隣接2バケツをmin/max統合したレベルが積まれる", () => {
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.4, 0.2],
      [-0.2, 0.8],
      [-0.3, 0.3],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    expect(peaks.length).toBe(3);

    // レベル0: 入力そのままの4バケツ
    expect(peaks[0].bucketSize).toBe(16);
    expectFloat32ArrayCloseTo(peaks[0].minBuckets, [-0.1, -0.4, -0.2, -0.3]);
    expectFloat32ArrayCloseTo(peaks[0].maxBuckets, [0.1, 0.2, 0.8, 0.3]);

    // レベル1: 隣接2バケツの統合
    expect(peaks[1].bucketSize).toBe(32);
    expectFloat32ArrayCloseTo(peaks[1].minBuckets, [-0.4, -0.3]);
    expectFloat32ArrayCloseTo(peaks[1].maxBuckets, [0.2, 0.8]);

    // レベル2: 全体のmin/max
    expect(peaks[2].bucketSize).toBe(64);
    expectFloat32ArrayCloseTo(peaks[2].minBuckets, [-0.4]);
    expectFloat32ArrayCloseTo(peaks[2].maxBuckets, [0.8]);
  });

  it("バケツ数が奇数のとき、最後のバケツは単独で上位レベルに引き継がれる", () => {
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.2, 0.2],
      [-0.5, 0.6],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // レベル1: バケツ0と1の統合 + バケツ2の単独引き継ぎ
    expectFloat32ArrayCloseTo(peaks[1].minBuckets, [-0.2, -0.5]);
    expectFloat32ArrayCloseTo(peaks[1].maxBuckets, [0.2, 0.6]);
  });
});

describe("resamplePeaks", () => {
  it("不正なpeaksを渡すとエラーになる", () => {
    // 空のpeaks
    expect(() => resamplePeaks([], [0, 16, 32])).toThrow();

    // バケツが0個のレベルを含む
    const emptyBucketsPeaks = [
      {
        bucketSize: 16,
        minBuckets: new Float32Array(0),
        maxBuckets: new Float32Array(0),
      },
    ];
    expect(() => resamplePeaks(emptyBucketsPeaks, [0, 16, 32])).toThrow();

    // minBucketsとmaxBucketsの長さが一致しない
    const mismatchedLengthPeaks = [
      {
        bucketSize: 16,
        minBuckets: new Float32Array(2),
        maxBuckets: new Float32Array(1),
      },
    ];
    expect(() => resamplePeaks(mismatchedLengthPeaks, [0, 16, 32])).toThrow();

    // レベルがバケツサイズの昇順に並んでいない
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.2, 0.2],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));
    const reversedPeaks = [...peaks].reverse();
    expect(() => resamplePeaks(reversedPeaks, [0, 16, 32])).toThrow();
  });

  it("不正なbinBoundarySamplesを渡すとエラーになる", () => {
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.2, 0.2],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 長さが2未満
    expect(() => resamplePeaks(peaks, [])).toThrow();
    expect(() => resamplePeaks(peaks, [0])).toThrow();

    // 減少している
    expect(() => resamplePeaks(peaks, [0, 32, 16])).toThrow();
  });

  it("幅0の区間は点として扱われ、その位置のサンプルを含むバケツの値になる", () => {
    const samples = makeBucketSamples([
      [-0.3, 0.3],
      [-0.5, 0.5],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 区間1はバケツ境界ちょうど（位置16）の幅0区間で、サンプル16を含むバケツ1の値になる
    // 区間3はバケツ1の内部（位置24）の幅0区間で、バケツ1の値になる
    const result = resamplePeaks(peaks, [0, 16, 16, 24, 24, 32]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.3, -0.5, -0.5, -0.5, -0.5]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.3, 0.5, 0.5, 0.5, 0.5]);
  });

  it("音声データ範囲外にある幅0の区間はゼロ埋めのままになる", () => {
    const samples = makeBucketSamples([[-0.3, 0.3]]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 区間0は先頭より前（位置-8）、区間2は末尾（位置16）の幅0区間で、どちらもゼロ埋めになる
    const result = resamplePeaks(peaks, [-8, -8, 16, 16]);
    expectFloat32ArrayCloseTo(result.minValues, [0, -0.3, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.3, 0]);
  });

  it("区間のサンプル幅が16未満のときは最も細かいレベル0が使われる", () => {
    // バケツ0にだけ非ゼロ値、バケツ1は全ゼロ
    const samples = makeBucketSamples([
      [-0.4, 0.4],
      [0, 0],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 8サンプル幅の区間3つにはレベル0（bucketSize 16）が使われるため、
    // バケツ0に属する区間0と1は -0.4/0.4、バケツ1に属する区間2は 0/0 になる
    // もし粗いレベル1（bucketSize 32、全体で1バケツ）が使われると区間2にも -0.4/0.4 が現れる
    const result = resamplePeaks(peaks, [0, 8, 16, 24]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.4, -0.4, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.4, 0.4, 0]);
  });

  it("区間のサンプル幅より粗いレベルは選ばれない（隣の区間に値が漏れない）", () => {
    // 64サンプル中、バケツ2（[32, 48)）にだけ非ゼロ値を置く
    const samples = makeBucketSamples([
      [0, 0],
      [0, 0],
      [0, 0.9],
      [0, 0],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 32サンプル幅の区間2つには bucketSize 32 のレベルが選ばれるはず
    // もし粗いレベル（bucketSize 64）が選ばれると、区間0のmaxにも0.9が漏れる
    const result = resamplePeaks(peaks, [0, 32, 64]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.9]);
  });

  it("サンプル幅の異なる区間ごとに適切なレベルが独立して選ばれる", () => {
    // 128サンプルで、レベル0は8バケツ
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.2, 0.2],
      [-0.3, 0.3],
      [-0.4, 0.4],
      [-0.5, 0.5],
      [-0.6, 0.6],
      [-0.7, 0.7],
      [-0.8, 0.8],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 区間0と1は32サンプル幅なので bucketSize 32 のレベル、
    // 区間2は64サンプル幅なので bucketSize 64 のレベルが使われる
    // どの区間もバケツ境界に揃っているため、結果は各区間の実min/maxと一致する
    const result = resamplePeaks(peaks, [0, 32, 64, 128]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.2, -0.4, -0.8]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.2, 0.4, 0.8]);
  });

  it("区間境界がバケツ境界に揃っていない場合、区間と重なるバケツ全体のmin/maxになる", () => {
    // バケツ0の先頭2サンプル（[0, 2)）にだけ非ゼロ値、バケツ1は全ゼロ
    const samples = makeBucketSamples([
      [-0.4, 0.4],
      [0, 0],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 区間 [8, 24) のサンプルはすべて0だが、バケツ0と1の両方に重なるため、
    // バケツ0のmin/max（-0.4/0.4）が結果に含まれる
    const result = resamplePeaks(peaks, [8, 24]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.4]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.4]);
  });

  it("音声データの範囲外にはみ出す区間は範囲内のみ反映され、完全に範囲外ならゼロになる", () => {
    const samples = createArray(64, () => 0.4);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    // 区間0 [-32, -16): 完全に範囲外なので 0/0
    // 区間1 [-16, 16): 負側にはみ出すが範囲内に 0.4 があるので 0.4/0.4
    // 区間2 [16, 80): 末尾側にはみ出すが範囲内に 0.4 があるので 0.4/0.4
    // 区間3 [80, 96): 完全に範囲外なので 0/0
    const result = resamplePeaks(peaks, [-32, -16, 16, 80, 96]);
    expectFloat32ArrayCloseTo(result.minValues, [0, 0.4, 0.4, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.4, 0.4, 0]);
  });

  it("全体を1区間に集約すると全体のmin/maxになる", () => {
    const samples = makeBucketSamples([
      [-0.1, 0.1],
      [-0.5, 0.3],
      [-0.2, 0.6],
    ]);
    const peaks = generateWaveformPeaks(makeAudioBuffer(samples));

    const result = resamplePeaks(peaks, [0, 48]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.5]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.6]);
  });
});
