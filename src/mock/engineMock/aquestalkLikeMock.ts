/**
 * AquesTalk 風記法テキストをパースするモジュール。
 * VOICEVOX ENGINEの voicevox_engine/tts_pipeline/kana_converter.py の移植。
 */

import { moraToPhonemes } from "./phonemeMock";
import { AccentPhrase, Mora } from "@/openapi";

enum ParseKanaErrorCode {
  UNKNOWN_TEXT = "判別できない読み仮名があります: {text}",
  ACCENT_TOP = "句頭にアクセントは置けません: {text}",
  ACCENT_TWICE = "1つのアクセント句に二つ以上のアクセントは置けません: {text}",
  ACCENT_NOTFOUND = "アクセントを指定していないアクセント句があります: {text}",
  EMPTY_PHRASE = "{position}番目のアクセント句が空白です",
  INTERROGATION_MARK_NOT_AT_END = "アクセント句末以外に「？」は置けません: {text}",
  INFINITE_LOOP = "処理時に無限ループになってしまいました...バグ報告をお願いします。",
}

const _LOOP_LIMIT = 300;

// AquesTalk 風記法特殊文字
const UNVOICE_SYMBOL = "_"; // 無声化
const ACCENT_SYMBOL = "'"; // アクセント位置
const NOPAUSE_DELIMITER = "/"; // ポーズ無しアクセント句境界
const PAUSE_DELIMITER = "、"; // ポーズ有りアクセント句境界
const WIDE_INTERROGATION_MARK = "？"; // 疑問形

// AquesTalk 風記法とモーラの対応。無声母音も含む。（音素長・音高 0 初期化）
const _kana2mora: Record<string, Mora> = {};
Object.entries(moraToPhonemes).forEach(([kana, [consonant, vowel]]) => {
  _kana2mora[kana] = {
    text: kana,
    consonant: consonant,
    consonantLength: consonant ? 0 : undefined,
    vowel: vowel,
    vowelLength: 0,
    pitch: 0,
  };

  if (["a", "i", "u", "e", "o"].includes(vowel)) {
    // 「`_` で無声化」の実装。例: "_ホ" -> "hO"
    // NOTE: 現行の型システムは Conditional Literal + upper に非対応.
    // FIXME: バリデーションする
    const upperVowel = vowel.toUpperCase();

    _kana2mora[UNVOICE_SYMBOL + kana] = {
      text: kana,
      consonant: consonant,
      consonantLength: consonant ? 0 : undefined,
      vowel: upperVowel,
      vowelLength: 0,
      pitch: 0,
    };
  }
});

/**
 * 単一アクセント句に相当するAquesTalk 風記法テキストからアクセント句オブジェクトを生成
 * longest matchによりモーラ化。入力長Nに対し計算量O(N^2)。
 */
function _textToAccentPhrase(phrase: string): AccentPhrase {
  // NOTE: ポーズと疑問形はこの関数内で処理しない

  let accentIndex: number | undefined = undefined;
  const moras: Mora[] = [];

  let baseIndex = 0; // パース開始位置。ここから右の文字列をstackに詰めていく。
  let stack = ""; // 保留中の文字列
  let matchedText: string | undefined = undefined; // 最後にマッチした仮名

  let outerLoop = 0;
  while (baseIndex < phrase.length) {
    outerLoop += 1;

    // 「`'` でアクセント位置」の実装
    if (phrase[baseIndex] === ACCENT_SYMBOL) {
      // 「アクセント位置はちょうど１つ」の実装
      if (moras.length === 0) {
        throw new Error(
          ParseKanaErrorCode.ACCENT_TOP.replace("{text}", phrase),
        );
      }
      if (accentIndex != undefined) {
        throw new Error(
          ParseKanaErrorCode.ACCENT_TWICE.replace("{text}", phrase),
        );
      }

      accentIndex = moras.length;
      baseIndex += 1;
      continue;
    }

    // モーラ探索
    // より長い要素からなるモーラが見つかれば上書き（longest match）
    // 例: phrase "キャ" -> "キ" 検出 -> "キャ" 検出/上書き -> Mora("キャ")
    for (let watchIndex = baseIndex; watchIndex < phrase.length; watchIndex++) {
      // アクセント位置特殊文字が来たら探索打ち切り
      if (phrase[watchIndex] === ACCENT_SYMBOL) {
        break;
      }
      stack += phrase[watchIndex];

      if (_kana2mora[stack]) {
        matchedText = stack;
      }
    }

    if (matchedText == undefined) {
      throw new Error(ParseKanaErrorCode.UNKNOWN_TEXT.replace("{text}", stack));
    } else {
      // push mora
      const baseMora = _kana2mora[matchedText];
      moras.push({ ...baseMora });

      baseIndex += matchedText.length;
      stack = "";
      matchedText = undefined;
    }

    if (outerLoop > _LOOP_LIMIT) {
      throw new Error(ParseKanaErrorCode.INFINITE_LOOP);
    }
  }

  if (accentIndex == undefined) {
    throw new Error(
      ParseKanaErrorCode.ACCENT_NOTFOUND.replace("{text}", phrase),
    );
  }

  return { moras, accent: accentIndex, pauseMora: undefined };
}

/**
 * AquesTalk 風記法テキストからアクセント句系列を生成
 */
export function parseKana(text: string): AccentPhrase[] {
  const parsedResults: AccentPhrase[] = [];
  if (text.length === 0) {
    throw new Error(ParseKanaErrorCode.EMPTY_PHRASE.replace("{position}", "1"));
  }

  let phraseBase = 0;
  for (let i = 0; i <= text.length; i++) {
    // アクセント句境界（`/`か`、`）の出現までインデックス進展
    if (
      i === text.length ||
      text[i] === PAUSE_DELIMITER ||
      text[i] === NOPAUSE_DELIMITER
    ) {
      let phrase = text.substring(phraseBase, i);
      if (phrase.length === 0) {
        throw new Error(
          ParseKanaErrorCode.EMPTY_PHRASE.replace(
            "{position}",
            String(parsedResults.length + 1),
          ),
        );
      }
      phraseBase = i + 1;

      // 「`？` で疑問文」の実装
      const isInterrogative = phrase.includes(WIDE_INTERROGATION_MARK);
      if (isInterrogative) {
        if (phrase.indexOf(WIDE_INTERROGATION_MARK) !== phrase.length - 1) {
          throw new Error(
            ParseKanaErrorCode.INTERROGATION_MARK_NOT_AT_END.replace(
              "{text}",
              phrase,
            ),
          );
        }
        // 疑問形はモーラでなくアクセント句属性で表現
        phrase = phrase.replace(WIDE_INTERROGATION_MARK, "");
      }

      const accentPhrase = _textToAccentPhrase(phrase);

      // 「`、` で無音付き区切り」の実装
      if (i < text.length && text[i] === PAUSE_DELIMITER) {
        accentPhrase.pauseMora = {
          text: "、",
          consonant: undefined,
          consonantLength: undefined,
          vowel: "pau",
          vowelLength: 0,
          pitch: 0,
        };
      }

      accentPhrase.isInterrogative = isInterrogative;

      parsedResults.push(accentPhrase);
    }
  }

  return parsedResults;
}
