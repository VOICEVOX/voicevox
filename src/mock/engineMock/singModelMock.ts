/**
 * ソング系の構造体を作るモック。
 * 値は適当だが、テストで使えるよう決定論的に決まるようにしたり、UIのバグに気づけるようある程度規則を持たせている。
 */

import { moraToPhonemes } from "./phonemeMock";
import { moraPattern, convertHiraToKana } from "@/domain/japanese";
import { Note, FramePhoneme } from "@/openapi";

/** アルファベット文字列を適当な0~1の適当な数値に変換する */
function alphabetsToNumber(text: string): number {
  const codes = text.split("").map((c) => c.charCodeAt(0));
  const sum = codes.reduce((a, b) => a + b);
  return (sum % 256) / 256;
}

/** 0.01~0.25になるように適当な長さを決める */
function phonemeToLengthMock(phoneme: string): number {
  return alphabetsToNumber(phoneme) * 0.24 + 0.01;
}

/** 揺れ幅が-30cent~30centになるように適当なピッチを決める */
function phonemeAndKeyToPitchMock(phoneme: string, key: number): number {
  const base = 440 * Math.pow(2, (key - 69) / 12);
  const shift = (-30 + 60 * alphabetsToNumber(phoneme)) / 1200;
  return base * Math.pow(2, shift);
}

/**
 * ノートから音素と適当な音素長を作成する。
 * 母音の開始位置をノートの開始位置は一致させ、子音は前のノートに食い込むようにする。
 */
function notesToFramePhonemesMock(notes: Note[]): FramePhoneme[] {
  const framePhonemes: FramePhoneme[] = [];
  for (const note of notes) {
    const phonemes = moraToPhonemes[convertHiraToKana(note.lyric)];
    if (phonemes == undefined)
      throw new Error(`音素に変換できません: ${note.lyric}`);

    const [consonant, vowel] = phonemes;

    if (consonant != undefined) {
      // 子音は適当な長さ
      let consonantLength = phonemeToLengthMock(consonant);

      // 子音の長さが前のノートの長さ以上になる場合、子音の長さをノートの半分にする
      const beforeFramePhoneme = framePhonemes[framePhonemes.length - 1];
      if (beforeFramePhoneme.frameLength < consonantLength) {
        consonantLength = beforeFramePhoneme.frameLength / 2;
      }

      // 子音は前のノートに食い込む。
      beforeFramePhoneme.frameLength -= consonantLength;
      framePhonemes.push({ phoneme: consonant, frameLength: consonantLength });
    }

    // 母音はノートの長さ
    const vowelLength = note.frameLength;
    framePhonemes.push({ phoneme: vowel, frameLength: vowelLength });
  }

  return framePhonemes;
}

/** ノートと音素長から適当なピッチを作成する */
function notesAndFramePhonemesToPitchMock(
  notes: Note[],
  framePhonemes: FramePhoneme[],
): number[] {
  // こんな感じ
  // const f0 = moras.flatMap((mora, i) =>
  //   Array<number>(framePerMora[i]).fill(
  //     mora.pitch == 0 ? 0 : Math.exp(mora.pitch),
  //   ),
  // );
  // note idがほしい！
}
