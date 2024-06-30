/**
 * トーク系の構造体を作るモック。
 */

import { IpadicFeatures } from "kuromoji";
import { moraToPhonemes } from "./phonemeMock";
import { convertHiraToKana, moraPattern } from "@/domain/japanese";
import { AccentPhrase, Mora } from "@/openapi";

/** アルファベット文字列を適当な0~1の適当な数値に変換する */
function alphabetsToNumber(text: string): number {
  const codes = text.split("").map((c) => c.charCodeAt(0));
  const sum = codes.reduce((a, b) => a + b);
  return (sum % 256) / 256;
}

// 0.1~1になるように適当な長さを求める
function phonemeToLengthMock(phoneme: string): number {
  return alphabetsToNumber(phoneme) * 0.9 + 0.1;
}

// 3~6になるように適当なピッチを求める
function phonemeToPitchMock(phoneme: string): number {
  return (1 - alphabetsToNumber(phoneme)) * 3 + 3;
}

/** カタカナテキストを適当なモーラに変換する */
function textToMoraMock(text: string): Mora {
  const phonemes = moraToPhonemes[text];
  if (phonemes == undefined) throw new Error(`モーラに変換できません: ${text}`);

  return {
    text,
    consonant: phonemes[0],
    consonantLength:
      phonemes[0] == undefined ? undefined : phonemeToLengthMock(phonemes[0]),
    vowel: phonemes[1],
    vowelLength: phonemeToLengthMock(phonemes[1]),
    pitch: phonemeToPitchMock((phonemes[0] ?? "") + phonemes[1]),
  };
}

/** カタカナテキストを適当なアクセント句に変換する */
function textToAccentPhrase(text: string): AccentPhrase {
  const moras: Mora[] = [...text.matchAll(moraPattern)].map((m) =>
    textToMoraMock(m[0]),
  );
  const alphabets = moras.map((m) => (m.consonant ?? "") + m.vowel).join("");
  const accent =
    1 + Math.round(alphabetsToNumber(alphabets) * (moras.length - 1));
  return { moras, accent };
}

/**
 * テキストを適当なアクセント句に分割する。
 * 助詞ごとに区切る。記号ごとに無音を入れる。
 * 無音で終わるアクセント句の最後のモーラが「す」「つ」の場合は無声化する。
 */
export function tokensToActtentPhrases(tokens: IpadicFeatures[]) {
  // TODO: 先にアクセントを求めてから長さなどを求める
  const accentPhrases: AccentPhrase[] = [];
  let textPhrase = "";
  for (const token of tokens) {
    // 記号の場合は無音を入れて区切る
    if (token.pos == "記号") {
      if (textPhrase.length == 0) continue;

      const accentPhrase = textToAccentPhrase(textPhrase);
      accentPhrase.pauseMora = {
        text: "、",
        vowel: "",
        vowelLength: 1 - 1 / (accentPhrases.length + 1),
        pitch: 0,
      };
      accentPhrases.push(accentPhrase);
      textPhrase = "";
      continue;
    }

    // 記号以外は連結
    if (token.reading == undefined)
      throw new Error(`発音がないトークン: ${token.surface_form}`);
    textPhrase += token.reading;

    // 助詞の場合は区切る
    if (token.pos == "助詞") {
      accentPhrases.push(textToAccentPhrase(textPhrase));
      textPhrase = "";
    }
  }
  if (textPhrase != "") {
    accentPhrases.push(textToAccentPhrase(textPhrase));
  }

  // 最後のアクセント句の無音をなくす
  if (accentPhrases.length > 0) {
    const lastPhrase = accentPhrases[accentPhrases.length - 1];
    lastPhrase.pauseMora = undefined;
  }

  // 無音のあるアクセント句を無声化
  for (const phrase of accentPhrases) {
    if (phrase.pauseMora == undefined) continue;
    const lastMora = phrase.moras[phrase.moras.length - 1];
    if (lastMora.text == "ス" || lastMora.text == "ツ") {
      lastMora.vowel = "U";
      lastMora.pitch = 0;
    }
  }

  // 別のアクセント句で同じにならないように適当に値をずらす
  for (let i = 0; i < accentPhrases.length; i++) {
    const diff = i * 0.01;
    const accentPhrase = accentPhrases[i];
    for (const mora of accentPhrase.moras) {
      if (mora.consonantLength != undefined) mora.consonantLength += diff;
      mora.vowelLength += diff;
      if (mora.pitch > 0) mora.pitch += diff;
    }
    if (accentPhrase.pauseMora != undefined) {
      accentPhrase.pauseMora.vowelLength += diff;
    }
  }

  return accentPhrases;
}
