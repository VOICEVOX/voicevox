import { getLast } from "@/sing/utility";

/**
 * mipmapのレベル。バケットサイズと、各バケットのmin/max値を保持する。
 */
type WaveformPeaksMipmapLevel = {
  readonly bucketSize: number;
  readonly minBuckets: Float32Array;
  readonly maxBuckets: Float32Array;
};

/**
 * 波形ピークのmipmap。
 * 先頭のレベルが最も細かいレベルで、以降はバケットサイズの昇順に並ぶ。
 */
export type WaveformPeaksMipmap = readonly WaveformPeaksMipmapLevel[];

/**
 * 波形ピークをリサンプルしたもの。
 */
export type ResampledPeaks = {
  readonly minValues: Float32Array;
  readonly maxValues: Float32Array;
};

/**
 * AudioBufferのch0からピークのmipmapを生成する。
 *
 * @param audioBuffer ピークを計算する音声データ。ch0のみ使用される。
 * @param minBucketSize 最小のバケットサイズ。1以上の整数でなければならない。
 * @returns 生成されたピークのmipmap。レベルはバケットサイズで昇順にソートされている。
 */
export function generateWaveformPeaksMipmap(
  audioBuffer: AudioBuffer,
  minBucketSize: number,
): WaveformPeaksMipmap {
  if (audioBuffer.length === 0) {
    throw new Error("audioBuffer must have at least one sample.");
  }
  if (!Number.isInteger(minBucketSize) || minBucketSize < 1) {
    throw new Error("minBucketSize must be a positive integer.");
  }

  const channel = audioBuffer.getChannelData(0);
  const numSamples = channel.length;

  // レベル0: サンプルから直接バケット化
  const baseNumBuckets = Math.ceil(numSamples / minBucketSize);
  const baseMinBuckets = new Float32Array(baseNumBuckets);
  const baseMaxBuckets = new Float32Array(baseNumBuckets);

  for (let bucketIndex = 0; bucketIndex < baseNumBuckets; bucketIndex++) {
    const start = bucketIndex * minBucketSize;
    const end = Math.min(start + minBucketSize, numSamples);
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

  const levels: WaveformPeaksMipmapLevel[] = [
    {
      bucketSize: minBucketSize,
      minBuckets: baseMinBuckets,
      maxBuckets: baseMaxBuckets,
    },
  ];

  // レベル1以降: バケット数が1個になるまで2バケットずつまとめる
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
 * @param peaksMipmap リサンプル元のピークmipmap。
 *   レベルはバケットサイズで昇順にソートされていなければならない。
 * @param binBoundarySamples 各区間の境界をサンプル位置で表した配列。
 *   `binBoundarySamples[i]` 以上 `binBoundarySamples[i + 1]` 未満が区間 `i` のサンプル範囲。
 *   配列の長さは 区間の数 + 1 で、2以上でなければならない。
 *   各値は音声データ先頭基準のサンプル位置で、単調非減少でなければならない。
 *   サンプル数を超える値や負の値も許容され、範囲外は0埋めになる。
 *   幅0の区間は点として扱い、その位置のサンプルを含むバケットの値になる。
 * @returns 各区間のmin/max値。
 */
export function resamplePeaks(
  peaksMipmap: WaveformPeaksMipmap,
  binBoundarySamples: number[],
): ResampledPeaks {
  if (peaksMipmap.length === 0) {
    throw new Error("peaksMipmap must have at least one level.");
  }
  for (const level of peaksMipmap) {
    if (level.minBuckets.length !== level.maxBuckets.length) {
      throw new Error("minBuckets and maxBuckets must have the same length.");
    }
    if (level.minBuckets.length === 0) {
      throw new Error("every level must have at least one bucket.");
    }
  }
  for (let i = 1; i < peaksMipmap.length; i++) {
    if (peaksMipmap[i].bucketSize <= peaksMipmap[i - 1].bucketSize) {
      throw new Error(
        "peaksMipmap levels must be in ascending order of bucketSize.",
      );
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
    let selectedLevel = peaksMipmap[0];
    for (const level of peaksMipmap) {
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
