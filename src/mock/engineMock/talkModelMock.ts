/**
 * トーク系の構造体を作るモック。
 */

import { builder, IpadicFeatures, Tokenizer } from "kuromoji";
import { moraToPhonemes } from "./phonemeMock";
import { parseKana } from "./aquestalkLikeMock";
import { moraPattern } from "@/domain/japanese";
import { AccentPhrase, Mora } from "@/openapi";
import { isNode } from "@/helpers/platform";

let _tokenizer: Tokenizer<IpadicFeatures> | undefined;

/** kuromoji用の辞書のパスを取得する */
function getDicPath() {
  if (isNode) {
    return "node_modules/kuromoji/dict";
  } else {
    return "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict";
  }
}

/** テキストをトークン列に変換するトークナイザーを取得する */
async function createOrGetTokenizer() {
  if (_tokenizer != undefined) {
    return _tokenizer;
  }

  return new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
    builder({
      dicPath: getDicPath(),
      nodeOrBrowser: isNode ? "node" : "browser",
    }).build((err: Error, tokenizer: Tokenizer<IpadicFeatures>) => {
      if (err) {
        reject(err);
      } else {
        _tokenizer = tokenizer;
        resolve(tokenizer);
      }
    });
  });
}

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

/** 3~5になるように適当なピッチを決める */
function phonemeToPitchMock(phoneme: string): number {
  return (1 - alphabetsToNumber(phoneme)) * 2 + 3;
}

/** カタカナテキストをモーラに変換する */
function textToMoraMock(text: string): Mora {
  const phonemes = moraToPhonemes[text];
  if (phonemes == undefined) throw new Error(`モーラに変換できません: ${text}`);

  return {
    text,
    consonant: phonemes[0],
    consonantLength: phonemes[0] == undefined ? undefined : 0,
    vowel: phonemes[1],
    vowelLength: 0,
    pitch: 0,
  };
}

/**
 * カタカナテキストを適当なアクセント句に変換する。
 * アクセント位置は適当に決める。
 */
function textToAccentPhraseMock(text: string): AccentPhrase {
  const moras: Mora[] = [...text.matchAll(moraPattern)].map((m) =>
    textToMoraMock(m[0]),
  );
  const alphabets = moras.map((m) => (m.consonant ?? "") + m.vowel).join("");
  const accent =
    1 + Math.round(alphabetsToNumber(alphabets) * (moras.length - 1));
  return { moras, accent };
}

/**
 * アクセント句内のモーラの長さを適当に代入する。
 * 最後のモーラだけ長くする。
 */
export function replaceLengthMock(
  accentPhrases: AccentPhrase[],
  styleId: number,
) {
  for (const accentPhrase of accentPhrases) {
    for (let i = 0; i < accentPhrase.moras.length; i++) {
      const mora = accentPhrase.moras[i];

      // 最後のモーラだけ長く
      const offset = i == accentPhrase.moras.length - 1 ? 0.05 : 0;

      if (mora.consonant != undefined)
        mora.consonantLength =
          (phonemeToLengthMock(mora.consonant) + offset) / 5;
      mora.vowelLength = phonemeToLengthMock(mora.vowel) + offset;
    }
  }

  // 別のアクセント句や話者で同じにならないように適当に値をずらす
  for (let i = 0; i < accentPhrases.length; i++) {
    const diff = i * 0.01 + styleId * 0.03;
    const accentPhrase = accentPhrases[i];
    for (const mora of accentPhrase.moras) {
      if (mora.consonantLength != undefined) mora.consonantLength += diff;
      mora.vowelLength += diff;
    }
    if (accentPhrase.pauseMora != undefined) {
      accentPhrase.pauseMora.vowelLength += diff;
    }
  }
}

/**
 * アクセント句内のモーラのピッチを適当に代入する。
 * アクセント位置のモーラだけ高くする。
 */
export function replacePitchMock(
  accentPhrases: AccentPhrase[],
  styleId: number,
) {
  for (const accentPhrase of accentPhrases) {
    for (let i = 0; i < accentPhrase.moras.length; i++) {
      const mora = accentPhrase.moras[i];

      // 無声化している場合はピッチを0にする
      if (mora.vowel == "U") {
        mora.pitch = 0;
        continue;
      }

      // アクセント位置のモーラだけ高く
      const offset = i == accentPhrase.accent ? 0.3 : 0;

      const phoneme = (mora.consonant ?? "") + mora.vowel[1];
      mora.pitch = phonemeToPitchMock(phoneme) + offset;
    }
  }

  // 別のアクセント句や話者で同じにならないように適当に値をずらす
  for (let i = 0; i < accentPhrases.length; i++) {
    const diff = i * 0.01 + styleId * 0.03;
    const accentPhrase = accentPhrases[i];
    for (const mora of accentPhrase.moras) {
      if (mora.pitch > 0) mora.pitch += diff;
    }
  }
}

/**
 * テキストを適当なアクセント句に分割する。
 * 助詞ごとに区切る。記号ごとに無音を入れる。
 * 無音で終わるアクセント句の最後のモーラが「す」「つ」の場合は無声化する。
 */
export async function textToActtentPhrasesMock(text: string, styleId: number) {
  const accentPhrases: AccentPhrase[] = [];

  // トークンに分割
  const tokenizer = await createOrGetTokenizer();
  const tokens = tokenizer.tokenize(text);

  let textPhrase = "";
  for (const token of tokens) {
    // 記号の場合は無音を入れて区切る
    if (token.pos == "記号") {
      const pauseMora = {
        text: "、",
        vowel: "pau",
        vowelLength: 1 - 1 / (accentPhrases.length + 1),
        pitch: 0,
      };

      // テキストが空の場合は前のアクセント句に無音を追加、空でない場合は新しいアクセント句を追加
      let accentPhrase: AccentPhrase;
      if (textPhrase.length === 0) {
        accentPhrase = accentPhrases[accentPhrases.length - 1];
      } else {
        accentPhrase = textToAccentPhraseMock(textPhrase);
        accentPhrases.push(accentPhrase);
      }
      accentPhrase.pauseMora = pauseMora;

      textPhrase = "";
      continue;
    }

    // 記号以外は連結
    if (token.reading == undefined)
      throw new Error(`発音がないトークン: ${token.surface_form}`);
    textPhrase += token.reading;

    // 助詞の場合は区切る
    if (token.pos == "助詞") {
      accentPhrases.push(textToAccentPhraseMock(textPhrase));
      textPhrase = "";
    }
  }
  if (textPhrase != "") {
    accentPhrases.push(textToAccentPhraseMock(textPhrase));
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

  // 長さとピッチを代入
  replaceLengthMock(accentPhrases, styleId);
  replacePitchMock(accentPhrases, styleId);

  return accentPhrases;
}

/**
 * AquesTalk風記法をアクセント句に変換する。
 */
export async function aquestalkLikeToAccentPhrasesMock(
  text: string,
  styleId: number,
) {
  const accentPhrases: AccentPhrase[] = parseKana(text);

  // 長さとピッチを代入
  replaceLengthMock(accentPhrases, styleId);
  replacePitchMock(accentPhrases, styleId);

  return accentPhrases;
}
