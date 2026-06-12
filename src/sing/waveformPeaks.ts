/**
 * 波形のピーク（min/max）データをmipmap形式で保持・参照するための純粋関数群。
 *
 * AudioBufferを一度だけ縮約し、複数解像度のピーク配列として保持する。
 * 描画時には表示解像度に応じたレベルを選択してリサンプルすることで、
 * ズーム連続変化時のO(audioBuffer.length)再計算を避ける。
 */

import { getLast } from "@/sing/utility";

type WaveformMipmapLevel = {
  readonly bucketSize: number;
  readonly minBuckets: Float32Array;
  readonly maxBuckets: Float32Array;
};

/**
 * 波形ピークのmipmap。
 * levels[0]が最も細かいレベルで、以降はバケツサイズの昇順に並ぶ。
 */
export type WaveformPeaks = readonly WaveformMipmapLevel[];

/**
 * 波形ピークをリサンプルしたもの。
 */
export type ResampledPeaks = {
  readonly minValues: Float32Array;
  readonly maxValues: Float32Array;
};

const BASE_BUCKET_SIZE = 16;

/**
 * AudioBufferのch0からピークのmipmapを生成する。
 * 最も細かいレベルのバケツサイズは BASE_BUCKET_SIZE で、
 * 以降は2倍ずつ大きなバケツサイズのレベルを、バケツ数が1個になるまで積み上げる。
 */
export function generateWaveformPeaks(audioBuffer: AudioBuffer): WaveformPeaks {
  const channel = audioBuffer.getChannelData(0);
  const numSamples = channel.length;

  // レベル0: サンプルから直接バケツ化
  const baseNumBuckets = Math.ceil(numSamples / BASE_BUCKET_SIZE);
  const baseMinBuckets = new Float32Array(baseNumBuckets);
  const baseMaxBuckets = new Float32Array(baseNumBuckets);

  for (let bucketIndex = 0; bucketIndex < baseNumBuckets; bucketIndex++) {
    const start = bucketIndex * BASE_BUCKET_SIZE;
    const end = Math.min(start + BASE_BUCKET_SIZE, numSamples);
    let min = channel[start];
    let max = channel[start];
    for (let i = start + 1; i < end; i++) {
      const value = channel[i];
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
    baseMinBuckets[bucketIndex] = min;
    baseMaxBuckets[bucketIndex] = max;
  }

  const levels: WaveformMipmapLevel[] = [
    {
      bucketSize: BASE_BUCKET_SIZE,
      minBuckets: baseMinBuckets,
      maxBuckets: baseMaxBuckets,
    },
  ];

  // 上位レベル: バケツ数が1個になるまで2バケツずつまとめる
  while (getLast(levels).minBuckets.length > 1) {
    const prev = getLast(levels);
    const prevNumBuckets = prev.minBuckets.length;

    const newBucketSize = prev.bucketSize * 2;
    const newNumBuckets = Math.ceil(prevNumBuckets / 2);
    const newMinBuckets = new Float32Array(newNumBuckets);
    const newMaxBuckets = new Float32Array(newNumBuckets);

    for (let i = 0; i < newNumBuckets; i++) {
      const a = 2 * i;
      const b = 2 * i + 1;
      if (b < prevNumBuckets) {
        newMinBuckets[i] = Math.min(prev.minBuckets[a], prev.minBuckets[b]);
        newMaxBuckets[i] = Math.max(prev.maxBuckets[a], prev.maxBuckets[b]);
      } else {
        newMinBuckets[i] = prev.minBuckets[a];
        newMaxBuckets[i] = prev.maxBuckets[a];
      }
    }

    levels.push({
      bucketSize: newBucketSize,
      minBuckets: newMinBuckets,
      maxBuckets: newMaxBuckets,
    });
  }

  return levels;
}

/**
 * 各区間に対応するサンプル範囲を境界配列で指定して、ピークをリサンプルする。
 * 区間ごとに最適なmipmapレベルを選択するため、サンプル幅が不均等でも適切な解像度になる。
 *
 * @param binBoundarySamples 長さ `numBins + 1` の配列。
 *   `binBoundarySamples[i]` 以上 `binBoundarySamples[i + 1]` 未満が区間 `i` のサンプル範囲。
 *   各値は音声データ先頭基準のサンプル位置で、単調非減少でなければならない。
 *   負の値や `numSamples` を超える値も許容され、範囲外は0埋めになる。
 *   幅0の区間は点として扱い、その位置のサンプルを含むバケツの値になる。
 *   長さは2以上でなければならない。
 */
export function resamplePeaks(
  peaks: WaveformPeaks,
  binBoundarySamples: number[],
): ResampledPeaks {
  if (peaks.length === 0) {
    throw new Error("peaks must have at least one level.");
  }
  for (const level of peaks) {
    if (level.minBuckets.length !== level.maxBuckets.length) {
      throw new Error("minBuckets and maxBuckets must have the same length.");
    }
    if (level.minBuckets.length === 0) {
      throw new Error("every level must have at least one bucket.");
    }
  }
  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i].bucketSize <= peaks[i - 1].bucketSize) {
      throw new Error("peaks levels must be in ascending order of bucketSize.");
    }
  }
  if (binBoundarySamples.length < 2) {
    throw new Error("binBoundarySamples must have at least two elements.");
  }

  const numBins = binBoundarySamples.length - 1;
  const minValues = new Float32Array(numBins);
  const maxValues = new Float32Array(numBins);

  for (let binIndex = 0; binIndex < numBins; binIndex++) {
    const binStartSample = binBoundarySamples[binIndex];
    const binEndSample = binBoundarySamples[binIndex + 1];
    const samplesPerBin = binEndSample - binStartSample;
    if (samplesPerBin < 0) {
      throw new Error(
        "binBoundarySamples must be monotonically non-decreasing.",
      );
    }
    // bucketSize <= samplesPerBin を満たす最大の bucketSize のレベルを選ぶ
    // どのレベルも条件を満たさないときは、最も細かいレベルを使う
    let selectedLevel = peaks[0];
    for (const level of peaks) {
      if (level.bucketSize > samplesPerBin) {
        break;
      }
      selectedLevel = level;
    }

    const numBuckets = selectedLevel.minBuckets.length;
    const bucketSize = selectedLevel.bucketSize;
    let bucketStart = Math.floor(binStartSample / bucketSize);
    let bucketEnd = Math.ceil(binEndSample / bucketSize);
    if (bucketEnd === bucketStart) {
      bucketEnd = bucketStart + 1;
    }
    if (bucketStart < 0) {
      bucketStart = 0;
    }
    if (bucketEnd > numBuckets) {
      bucketEnd = numBuckets;
    }

    if (bucketStart >= bucketEnd) {
      // クランプ前は必ず bucketStart < bucketEnd になっているため、
      // ここに該当するのは区間が音声データの完全に外側にあるときだけで、0埋めのままにする
      continue;
    }

    let min = selectedLevel.minBuckets[bucketStart];
    let max = selectedLevel.maxBuckets[bucketStart];
    for (let i = bucketStart + 1; i < bucketEnd; i++) {
      const bucketMin = selectedLevel.minBuckets[i];
      const bucketMax = selectedLevel.maxBuckets[i];
      if (bucketMin < min) {
        min = bucketMin;
      }
      if (bucketMax > max) {
        max = bucketMax;
      }
    }
    minValues[binIndex] = min;
    maxValues[binIndex] = max;
  }

  return { minValues, maxValues };
}
