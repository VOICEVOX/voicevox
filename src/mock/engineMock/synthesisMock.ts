/**
 * 音声合成するモック。
 * 音高と音量はそれっぽい音を合成する。
 * 音素は適当に別々の電子音にする。
 */

import { FrameAudioQuery } from "@/openapi";
import { generateWavFileData } from "@/helpers/fileDataGenerator";
import { applyGaussianFilter } from "@/sing/utility";

/** 0~1を返す疑似乱数生成器 */
function Random(seed: number = 0) {
  // 線形合同法
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 31;

  return () => {
    seed = (a * seed + c) % m;
    return seed / m;
  };
}

/** 波形の種類 */
const waveTypes = ["sine", "square", "noise", "silence"] as const;
type WaveType = (typeof waveTypes)[number];

/** サイン波などを生成する */
function generateWave(
  f0: Array<number>,
  volume: Array<number>,
  frameRate: number,
  sampleRate: number,
  type: WaveType,
) {
  const duration = f0.length / frameRate;
  const samplesPerOriginal = sampleRate / frameRate;
  const wave = new Float32Array(sampleRate * duration);

  const seed =
    Math.round(f0.concat(volume).reduce((acc, v) => acc + v, 0)) % 2 ** 31; // そこそこ被らないシード値
  const random = Random(seed);
  let phase = 0;
  for (let frameIndex = 0; frameIndex < f0.length; frameIndex++) {
    const freq = f0[frameIndex];
    const vol = volume[frameIndex];
    const omega = (2 * Math.PI * freq) / sampleRate;

    for (let i = 0; i < samplesPerOriginal; i++) {
      const sampleIndex = frameIndex * samplesPerOriginal + i;
      switch (type) {
        case "sine":
          wave[sampleIndex] = Math.sin(phase);
          break;
        case "square":
          wave[sampleIndex] = (phase / Math.PI) % 2 < 1 ? 1 : -1;
          break;
        case "noise":
          wave[sampleIndex] = random() * 2 - 1;
          break;
        case "silence":
          wave[sampleIndex] = 0;
          break;
      }
      wave[sampleIndex] *= vol;

      phase += omega;
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      }
    }
  }

  return wave;
}

/**
 * 音素ごとの特徴。
 * FIXME: できるならデバッグしやすいようそれっぽい音に近づけたい。
 */
const phonemeFeatures = {
  有声母音: ["a", "i", "u", "e", "o", "N"],
  無声母音: ["A", "I", "U", "E", "O"],
  無音: ["sil", "pau", "cl"],
  有声子音: [
    "b",
    "by",
    "d",
    "dy",
    "g",
    "gw",
    "gy",
    "j",
    "m",
    "my",
    "n",
    "ny",
    "r",
    "ry",
    "v",
    "w",
    "y",
    "z",
  ],
  無声子音: [
    "ch",
    "f",
    "h",
    "hy",
    "k",
    "kw",
    "ky",
    "p",
    "py",
    "s",
    "sh",
    "t",
    "ts",
    "ty",
  ],
};

/** 音素ごとの波形の配合率を適当に決める */
function getWaveRate(phoneme: string): { [key in WaveType]: number } {
  const waveRate: { [key in WaveType]: number } = {
    sine: 0,
    square: 0,
    noise: 0,
    silence: 0,
  };

  // 無音ならほぼ無音
  if (phonemeFeatures.無音.includes(phoneme)) {
    const index = phonemeFeatures.無音.indexOf(phoneme);
    waveRate.noise = ((index + 1) % 30) / 30;
    return waveRate;
  }

  // 有声母音ならノイズなし
  if (phonemeFeatures.有声母音.includes(phoneme)) {
    const rate =
      phonemeFeatures.有声母音.indexOf(phoneme) /
      (phonemeFeatures.有声母音.length - 1);
    waveRate.sine = 1 - rate;
    waveRate.square = rate;
    return waveRate;
  }

  // 無声母音ならノイズ多め
  if (phonemeFeatures.無声母音.includes(phoneme)) {
    const rate =
      phonemeFeatures.無声母音.indexOf(phoneme) /
      (phonemeFeatures.無声母音.length - 1);
    waveRate.sine = (1 - rate) * 0.1;
    waveRate.square = rate * 0.1;
    waveRate.noise = 0.3;
    return waveRate;
  }

  // 有声子音ならノイズ少なめ
  if (phonemeFeatures.有声子音.includes(phoneme)) {
    const rate =
      phonemeFeatures.有声子音.indexOf(phoneme) /
      (phonemeFeatures.有声子音.length - 1);
    waveRate.sine = (1 - rate) * 0.7;
    waveRate.square = rate * 0.7;
    waveRate.noise = 0.2;
    return waveRate;
  }

  // 無声子音ならノイズ多めで音量小さい
  if (phonemeFeatures.無声子音.includes(phoneme)) {
    const rate =
      phonemeFeatures.無声子音.indexOf(phoneme) /
      (phonemeFeatures.無声子音.length - 1);
    waveRate.sine = (1 - rate) * 0.1;
    waveRate.square = rate * 0.1;
    waveRate.noise = 0.1;
    return waveRate;
  }

  throw new Error(`未対応の音素: ${phoneme}`);
}

/**
 * FrameAudioQueryから適当に音声合成する。
 * いろんな波形を作り、音素ごとに波形の配合率を変える。
 */
export function synthesisFrameAudioQueryMock(
  frameAudioQuery: FrameAudioQuery,
  styleId: number,
): Uint8Array {
  const sampleRate = frameAudioQuery.outputSamplingRate;
  const samplePerFrame = 256;
  const frameRate = sampleRate / samplePerFrame;

  const _generateWave = (type: WaveType) =>
    generateWave(
      frameAudioQuery.f0,
      frameAudioQuery.volume,
      frameRate,
      sampleRate,
      type,
    );
  const waves: { [key in WaveType]: Float32Array } = {
    sine: _generateWave("sine"),
    square: _generateWave("square"),
    noise: _generateWave("noise"),
    silence: _generateWave("silence"),
  };

  // フレームごとの音声波形の配分率
  const waveRatesPerFrame = frameAudioQuery.phonemes.flatMap((phoneme) => {
    const waveRate = getWaveRate(phoneme.phoneme);
    return Array<{ [key in WaveType]: number }>(phoneme.frameLength).fill(
      waveRate,
    );
  });

  // サンプルごとの配分率
  // 耳が痛くならないように10msほどの移動平均を取る
  const calcWaveRate = (type: WaveType) => {
    const waveRate = waveRatesPerFrame.flatMap((o) =>
      Array<number>(samplePerFrame).fill(o[type]),
    );
    applyGaussianFilter(waveRate, (sampleRate * 0.01) / 3);
    return waveRate;
  };
  const waveRates = Object.fromEntries(
    waveTypes.map((type) => [type, calcWaveRate(type)]),
  ) as { [key in WaveType]: number[] };

  // 波形を合成。
  // 念の為に-1~1に丸め、音量を1/10にする。
  // 話者ごとに同じにならないように適当に値をずらす
  const wave = new Float32Array(frameAudioQuery.f0.length * samplePerFrame);
  for (let i = 0; i < wave.length; i++) {
    let sample = waveTypes.reduce((acc, type) => {
      return acc + waves[type][i] * waveRates[type][i];
    }, 0);
    sample += (styleId % 977) / 977 / 20; // 977は適当な素数
    wave[i] = Math.min(Math.max(sample, -1), 1) / 10;
  }

  // Blobに変換
  const numberOfChannels = frameAudioQuery.outputStereo ? 2 : 1;
  const buffer = generateWavFileData({
    sampleRate,
    length: wave.length,
    numberOfChannels,
    getChannelData: () => wave,
  });
  return buffer;
}
