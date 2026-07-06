import { describe, it, expect } from "vitest";
import {
  generateWaveformPeaksMipmap,
  resamplePeaks,
} from "@/sing/waveformPeaks";
import { createArray } from "@/sing/utility";

const MIN_BUCKET_SIZE = 16;
const SAMPLE_RATE = 24000;

function makeAudioBuffer(samples: number[]): AudioBuffer {
  const channel = new Float32Array(samples);
  return {
    length: channel.length,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    duration: channel.length / SAMPLE_RATE,
    getChannelData: (ch: number) => {
      if (ch !== 0) {
        throw new Error("only ch0 supported in test");
      }
      return channel;
    },
  } as unknown as AudioBuffer;
}

/**
 * 指定したバケットサイズで区切ったときの各バケットのmin/maxからサンプル配列を作る。
 * 各バケットは、先頭サンプルがmin、2番目のサンプルがmax、残りが0になる。
 * 0埋め部分がそのバケットのmin/maxに影響しないよう、min <= 0 <= max でなければならない。
 */
function makeBucketSamples(
  bucketMinMaxList: [min: number, max: number][],
  bucketSize: number,
): number[] {
  if (bucketSize < 2) {
    throw new Error("bucketSize は2以上でなければなりません。");
  }
  const samples: number[] = [];
  for (const [min, max] of bucketMinMaxList) {
    if (min > 0 || max < 0) {
      throw new Error("min <= 0 <= max でなければなりません。");
    }
    samples.push(min, max, ...createArray(bucketSize - 2, () => 0));
  }
  return samples;
}

function expectFloat32ArrayCloseTo(actual: Float32Array, expected: number[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i]);
  }
}

describe("generateWaveformPeaksMipmap", () => {
  it("不正なminBucketSizeを渡すとエラーになる", () => {
    const buffer = makeAudioBuffer([0, 0.1, -0.1]);

    // 0以下はエラー
    expect(() => generateWaveformPeaksMipmap(buffer, 0)).toThrow();
    expect(() => generateWaveformPeaksMipmap(buffer, -1)).toThrow();

    // 非整数はエラー
    expect(() => generateWaveformPeaksMipmap(buffer, 1.5)).toThrow();
    expect(() => generateWaveformPeaksMipmap(buffer, NaN)).toThrow();
    expect(() => generateWaveformPeaksMipmap(buffer, Infinity)).toThrow();

    // 1以上の整数なら通る
    expect(() => generateWaveformPeaksMipmap(buffer, 1)).not.toThrow();
  });

  it("minBucketSize以下のサンプル数ならバケット1個のレベルが1つだけできる", () => {
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer([0.1, -0.2, 0.3]),
      MIN_BUCKET_SIZE,
    );
    expect(peaksMipmap.length).toBe(1);
    expect(peaksMipmap[0].bucketSize).toBe(MIN_BUCKET_SIZE);
    expectFloat32ArrayCloseTo(peaksMipmap[0].minBuckets, [-0.2]);
    expectFloat32ArrayCloseTo(peaksMipmap[0].maxBuckets, [0.3]);
  });

  it("レベル0はminBucketSizeごとのバケットになり、各バケットがその範囲のmin/maxを持つ", () => {
    // バケット0（[0, 16)）: min -0.4（i=3）, max 0.6（i=10）
    // バケット1（[16, 32)）: min -0.7（i=25）, max 0.8（i=20）
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
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    expect(peaksMipmap[0].bucketSize).toBe(MIN_BUCKET_SIZE);
    expectFloat32ArrayCloseTo(peaksMipmap[0].minBuckets, [-0.4, -0.7]);
    expectFloat32ArrayCloseTo(peaksMipmap[0].maxBuckets, [0.6, 0.8]);
  });

  it("サンプル数がminBucketSizeの倍数でないとき、最後のバケットは端数サンプルのみで計算される", () => {
    // minBucketSizeサンプルの0埋めバケット + 端数4サンプル
    const samples = [
      ...createArray(MIN_BUCKET_SIZE, () => 0),
      0.1,
      -0.3,
      0.5,
      0.2,
    ];
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // ceil(20 / 16) = 2バケットで、バケット1は [16, 20) の4サンプルのみ
    expectFloat32ArrayCloseTo(peaksMipmap[0].minBuckets, [0, -0.3]);
    expectFloat32ArrayCloseTo(peaksMipmap[0].maxBuckets, [0, 0.5]);
  });

  it("バケット数が1になるまで、隣接2バケットをmin/max統合したレベルが積まれる", () => {
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.4, 0.2],
        [-0.2, 0.8],
        [-0.3, 0.3],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    expect(peaksMipmap.length).toBe(3);

    // レベル0: 入力そのままの4バケット
    expect(peaksMipmap[0].bucketSize).toBe(MIN_BUCKET_SIZE);
    expectFloat32ArrayCloseTo(
      peaksMipmap[0].minBuckets,
      [-0.1, -0.4, -0.2, -0.3],
    );
    expectFloat32ArrayCloseTo(peaksMipmap[0].maxBuckets, [0.1, 0.2, 0.8, 0.3]);

    // レベル1: 隣接2バケットの統合
    expect(peaksMipmap[1].bucketSize).toBe(MIN_BUCKET_SIZE * 2);
    expectFloat32ArrayCloseTo(peaksMipmap[1].minBuckets, [-0.4, -0.3]);
    expectFloat32ArrayCloseTo(peaksMipmap[1].maxBuckets, [0.2, 0.8]);

    // レベル2: 全体のmin/max
    expect(peaksMipmap[2].bucketSize).toBe(MIN_BUCKET_SIZE * 4);
    expectFloat32ArrayCloseTo(peaksMipmap[2].minBuckets, [-0.4]);
    expectFloat32ArrayCloseTo(peaksMipmap[2].maxBuckets, [0.8]);
  });

  it("バケット数が奇数のとき、最後のバケットは単独で上位レベルに引き継がれる", () => {
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.2, 0.2],
        [-0.5, 0.6],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // レベル1: バケット0と1の統合 + バケット2の単独引き継ぎ
    expectFloat32ArrayCloseTo(peaksMipmap[1].minBuckets, [-0.2, -0.5]);
    expectFloat32ArrayCloseTo(peaksMipmap[1].maxBuckets, [0.2, 0.6]);
  });
});

describe("resamplePeaks", () => {
  it("不正なpeaksMipmapを渡すとエラーになる", () => {
    // 空のpeaksMipmap
    expect(() => resamplePeaks([], [0, 16, 32])).toThrow();

    // バケットが0個のレベルを含む
    const emptyBucketsPeaksMipmap = [
      {
        bucketSize: 16,
        minBuckets: new Float32Array(0),
        maxBuckets: new Float32Array(0),
      },
    ];
    expect(() => resamplePeaks(emptyBucketsPeaksMipmap, [0, 16, 32])).toThrow();

    // minBucketsとmaxBucketsの長さが一致しない
    const mismatchedLengthPeaksMipmap = [
      {
        bucketSize: 16,
        minBuckets: new Float32Array(2),
        maxBuckets: new Float32Array(1),
      },
    ];
    expect(() =>
      resamplePeaks(mismatchedLengthPeaksMipmap, [0, 16, 32]),
    ).toThrow();

    // レベルがバケットサイズの昇順に並んでいない
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.2, 0.2],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );
    const reversedPeaksMipmap = [...peaksMipmap].reverse();
    expect(() => resamplePeaks(reversedPeaksMipmap, [0, 16, 32])).toThrow();
  });

  it("不正なbinBoundarySamplesを渡すとエラーになる", () => {
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.2, 0.2],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 長さが2未満
    expect(() => resamplePeaks(peaksMipmap, [])).toThrow();
    expect(() => resamplePeaks(peaksMipmap, [0])).toThrow();

    // 減少している
    expect(() => resamplePeaks(peaksMipmap, [0, 32, 16])).toThrow();
  });

  it("幅0の区間は点として扱われ、その位置のサンプルを含むバケットの値になる", () => {
    const samples = makeBucketSamples(
      [
        [-0.3, 0.3],
        [-0.5, 0.5],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 区間1はバケット境界ちょうど（位置16）の幅0区間で、サンプル16を含むバケット1の値になる
    // 区間3はバケット1の内部（位置24）の幅0区間で、バケット1の値になる
    const result = resamplePeaks(peaksMipmap, [0, 16, 16, 24, 24, 32]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.3, -0.5, -0.5, -0.5, -0.5]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.3, 0.5, 0.5, 0.5, 0.5]);
  });

  it("音声データ範囲外にある幅0の区間はゼロ埋めのままになる", () => {
    const samples = makeBucketSamples([[-0.3, 0.3]], MIN_BUCKET_SIZE);
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 区間0は先頭より前（位置-8）、区間2は末尾（位置16）の幅0区間で、どちらもゼロ埋めになる
    const result = resamplePeaks(peaksMipmap, [-8, -8, 16, 16]);
    expectFloat32ArrayCloseTo(result.minValues, [0, -0.3, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.3, 0]);
  });

  it("区間のサンプル幅がminBucketSize未満のときは最も細かいレベル0が使われる", () => {
    // バケット0にだけ非ゼロ値、バケット1は全ゼロ
    const samples = makeBucketSamples(
      [
        [-0.4, 0.4],
        [0, 0],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 8サンプル幅の区間3つにはレベル0（bucketSize 16）が使われるため、
    // バケット0に属する区間0と1は -0.4/0.4、バケット1に属する区間2は 0/0 になる
    // もし粗いレベル1（bucketSize 32、全体で1バケット）が使われると区間2にも -0.4/0.4 が現れる
    const result = resamplePeaks(peaksMipmap, [0, 8, 16, 24]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.4, -0.4, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.4, 0.4, 0]);
  });

  it("区間のサンプル幅より粗いレベルは選ばれない（隣の区間に値が漏れない）", () => {
    // 64サンプル中、バケット2（[32, 48)）にだけ非ゼロ値を置く
    const samples = makeBucketSamples(
      [
        [0, 0],
        [0, 0],
        [0, 0.9],
        [0, 0],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 32サンプル幅の区間2つには bucketSize 32 のレベルが選ばれるはず
    // もし粗いレベル（bucketSize 64）が選ばれると、区間0のmaxにも0.9が漏れる
    const result = resamplePeaks(peaksMipmap, [0, 32, 64]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.9]);
  });

  it("サンプル幅の異なる区間ごとに適切なレベルが独立して選ばれる", () => {
    // 128サンプルで、レベル0は8バケット
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.2, 0.2],
        [-0.3, 0.3],
        [-0.4, 0.4],
        [-0.5, 0.5],
        [-0.6, 0.6],
        [-0.7, 0.7],
        [-0.8, 0.8],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 区間0と1は32サンプル幅なので bucketSize 32 のレベル、
    // 区間2は64サンプル幅なので bucketSize 64 のレベルが使われる
    // どの区間もバケット境界に揃っているため、結果は各区間の実min/maxと一致する
    const result = resamplePeaks(peaksMipmap, [0, 32, 64, 128]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.2, -0.4, -0.8]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.2, 0.4, 0.8]);
  });

  it("区間境界がバケット境界に揃っていない場合、区間と重なるバケット全体のmin/maxになる", () => {
    // バケット0の先頭2サンプル（[0, 2)）にだけ非ゼロ値、バケット1は全ゼロ
    const samples = makeBucketSamples(
      [
        [-0.4, 0.4],
        [0, 0],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 区間 [8, 24) のサンプルはすべて0だが、バケット0と1の両方に重なるため、
    // バケット0のmin/max（-0.4/0.4）が結果に含まれる
    const result = resamplePeaks(peaksMipmap, [8, 24]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.4]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.4]);
  });

  it("音声データの範囲外にはみ出す区間は範囲内のみ反映され、完全に範囲外ならゼロになる", () => {
    const samples = createArray(64, () => 0.4);
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    // 区間0 [-32, -16): 完全に範囲外なので 0/0
    // 区間1 [-16, 16): 負側にはみ出すが範囲内に 0.4 があるので 0.4/0.4
    // 区間2 [16, 80): 末尾側にはみ出すが範囲内に 0.4 があるので 0.4/0.4
    // 区間3 [80, 96): 完全に範囲外なので 0/0
    const result = resamplePeaks(peaksMipmap, [-32, -16, 16, 80, 96]);
    expectFloat32ArrayCloseTo(result.minValues, [0, 0.4, 0.4, 0]);
    expectFloat32ArrayCloseTo(result.maxValues, [0, 0.4, 0.4, 0]);
  });

  it("全体を1区間に集約すると全体のmin/maxになる", () => {
    const samples = makeBucketSamples(
      [
        [-0.1, 0.1],
        [-0.5, 0.3],
        [-0.2, 0.6],
      ],
      MIN_BUCKET_SIZE,
    );
    const peaksMipmap = generateWaveformPeaksMipmap(
      makeAudioBuffer(samples),
      MIN_BUCKET_SIZE,
    );

    const result = resamplePeaks(peaksMipmap, [0, 48]);
    expectFloat32ArrayCloseTo(result.minValues, [-0.5]);
    expectFloat32ArrayCloseTo(result.maxValues, [0.6]);
  });
});
