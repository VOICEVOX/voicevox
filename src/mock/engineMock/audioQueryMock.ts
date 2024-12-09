/**
 * AudioQueryとFrameAudioQueryのモック。
 * VOICEVOX ENGINEリポジトリの処理とほぼ同じ。
 */

import { AccentPhrase, AudioQuery, FrameAudioQuery, Mora } from "@/openapi";

function generateSilenceMora(length: number): Mora {
  return {
    text: "　",
    vowel: "sil",
    vowelLength: length,
    pitch: 0.0,
  };
}

function toFlattenMoras(accentPhrases: AccentPhrase[]): Mora[] {
  let moras: Mora[] = [];
  accentPhrases.forEach((accentPhrase) => {
    moras = moras.concat(accentPhrase.moras);
    if (accentPhrase.pauseMora) {
      moras.push(accentPhrase.pauseMora);
    }
  });
  return moras;
}

function toFlattenPhonemes(moras: Mora[]): string[] {
  const phonemes: string[] = [];
  for (const mora of moras) {
    if (mora.consonant) {
      phonemes.push(mora.consonant);
    }
    phonemes.push(mora.vowel);
  }
  return phonemes;
}

/** 前後の無音モーラを追加する */
function applyPrePostSilence(moras: Mora[], query: AudioQuery): Mora[] {
  const preSilenceMoras = [generateSilenceMora(query.prePhonemeLength)];
  const postSilenceMoras = [generateSilenceMora(query.postPhonemeLength)];
  return preSilenceMoras.concat(moras).concat(postSilenceMoras);
}

/** 無音時間を置き換える */
function applyPauseLength(moras: Mora[], query: AudioQuery): Mora[] {
  if (query.pauseLength != undefined) {
    for (const mora of moras) {
      if (mora.vowel == "pau") {
        mora.vowelLength = query.pauseLength;
      }
    }
  }
  return moras;
}

/** 無音時間スケールを適用する */
function applyPauseLengthScale(moras: Mora[], query: AudioQuery): Mora[] {
  if (query.pauseLengthScale != undefined) {
    for (const mora of moras) {
      if (mora.vowel == "pau") {
        mora.vowelLength *= query.pauseLengthScale;
      }
    }
  }
  return moras;
}

/** 話速スケールを適用する */
function applySpeedScale(moras: Mora[], query: AudioQuery): Mora[] {
  for (const mora of moras) {
    mora.vowelLength /= query.speedScale;
    if (mora.consonantLength) {
      mora.consonantLength /= query.speedScale;
    }
  }
  return moras;
}

/** 音高スケールを適用する */
function applyPitchScale(moras: Mora[], query: AudioQuery): Mora[] {
  for (const mora of moras) {
    mora.pitch *= 2 ** query.pitchScale;
  }
  return moras;
}

/** 抑揚スケールを適用する */
function applyIntonationScale(moras: Mora[], query: AudioQuery): Mora[] {
  const voiced = moras.filter((mora) => mora.pitch > 0);
  if (voiced.length == 0) {
    return moras;
  }

  const meanF0 =
    voiced.reduce((sum, mora) => sum + mora.pitch, 0) / voiced.length;
  for (const mora of voiced) {
    mora.pitch = (mora.pitch - meanF0) * query.intonationScale + meanF0;
  }
  return moras;
}

/** 疑問文の最後に音高の高いモーラを追加する */
function applyInterrogativeUpspeak(accentPhrases: Array<AccentPhrase>) {
  accentPhrases.forEach((accentPhrase) => {
    const moras = accentPhrase.moras;
    if (
      moras.length > 0 &&
      accentPhrase.isInterrogative &&
      moras[moras.length - 1].pitch > 0
    ) {
      const lastMora = moras[moras.length - 1];
      const upspeakMora: Mora = {
        text: "ー",
        vowel: lastMora.vowel,
        vowelLength: 0.15,
        pitch: lastMora.pitch + 0.3,
      };
      accentPhrase.moras.push(upspeakMora);
    }
  });
}

function secondToFrame(second: number): number {
  const FRAME_RATE = 24000 / 256;
  return Math.round(second * FRAME_RATE);
}

/** モーラや音素ごとのフレーム数を数える */
function countFramePerUnit(moras: Mora[]): {
  framePerPhoneme: number[];
  framePerMora: number[];
} {
  const framePerPhoneme: number[] = [];
  const framePerMora: number[] = [];

  for (const mora of moras) {
    const vowelFrames = secondToFrame(mora.vowelLength);
    const consonantFrames = mora.consonantLength
      ? secondToFrame(mora.consonantLength)
      : 0;
    const moraFrames = vowelFrames + consonantFrames;

    if (mora.consonant) {
      framePerPhoneme.push(consonantFrames);
    }
    framePerPhoneme.push(vowelFrames);
    framePerMora.push(moraFrames);
  }

  return { framePerPhoneme, framePerMora };
}

/** AudioQueryを適当にFrameAudioQueryに変換する */
export function audioQueryToFrameAudioQueryMock(
  audioQuery: AudioQuery,
  { enableInterrogativeUpspeak }: { enableInterrogativeUpspeak: boolean },
): FrameAudioQuery {
  const accentPhrases = audioQuery.accentPhrases;

  if (enableInterrogativeUpspeak) {
    applyInterrogativeUpspeak(accentPhrases);
  }

  let moras = toFlattenMoras(accentPhrases);
  moras = applyPrePostSilence(moras, audioQuery);
  moras = applyPauseLength(moras, audioQuery);
  moras = applyPauseLengthScale(moras, audioQuery);
  moras = applySpeedScale(moras, audioQuery);
  moras = applyPitchScale(moras, audioQuery);
  moras = applyIntonationScale(moras, audioQuery);

  const { framePerPhoneme, framePerMora } = countFramePerUnit(moras);

  const f0 = moras.flatMap((mora, i) =>
    Array<number>(framePerMora[i]).fill(
      mora.pitch == 0 ? 0 : Math.exp(mora.pitch),
    ),
  );
  const volume = Array<number>(f0.length).fill(audioQuery.volumeScale);
  const phonemes = toFlattenPhonemes(moras).map((phoneme, i) => ({
    phoneme,
    frameLength: framePerPhoneme[i],
  }));

  return {
    f0,
    volume,
    phonemes,
    volumeScale: audioQuery.volumeScale,
    outputSamplingRate: audioQuery.outputSamplingRate,
    outputStereo: audioQuery.outputStereo,
  };
}
