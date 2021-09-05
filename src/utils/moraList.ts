import { Mora } from "@/openapi/models";
export const UNVOICE_SYMBOL = "_";
export const ACCENT_SYMBOL = "'";
export const NOPAUSE_DELIMITER = "/";
export const PAUSE_DELIMITER = "、";
/**
 * 以下のモーラ対応表はOpenJTalkのソースコードから取得し、
 * カタカナ表記とモーラが一対一対応するように改造した。
 * Open JTalkのソースコードのライセンスは以下の通り：
 * -----------------------------------------------------------------
 *           The Japanese TTS System "Open JTalk"
 *           developed by HTS Working Group
 *           http://open-jtalk.sourceforge.net/
 * -----------------------------------------------------------------
 *
 *  Copyright (c) 2008-2014  Nagoya Institute of Technology
 *                           Department of Computer Science
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or
 * without modification, are permitted provided that the following
 * conditions are met:
 *
 * - Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following
 *   disclaimer in the documentation and/or other materials provided
 *   with the distribution.
 * - Neither the name of the HTS working group nor the names of its
 *   contributors may be used to endorse or promote products derived
 *   from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
 * CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
const moraList: [string, string | null, string][] = [
  // ["ヴョ", "by", "o"],
  // ["ヴュ", "by", "u"],
  // ["ヴャ", "by", "a"],
  ["ヴォ", "v", "o"],
  ["ヴェ", "v", "e"],
  ["ヴィ", "v", "i"],
  ["ヴァ", "v", "a"],
  ["ヴ", "v", "u"],
  ["ン", null, "N"],
  // ["ヲ", null, "o"],
  // ["ヱ", null, "e"],
  // ["ヰ", null, "i"],
  ["ワ", "w", "a"],
  // ["ヮ", "w", "a"],
  ["ロ", "r", "o"],
  ["レ", "r", "e"],
  ["ル", "r", "u"],
  ["リョ", "ry", "o"],
  ["リュ", "ry", "u"],
  ["リャ", "ry", "a"],
  ["リェ", "ry", "e"],
  ["リ", "r", "i"],
  ["ラ", "r", "a"],
  ["ヨ", "y", "o"],
  // ["ョ", "y", "o"],
  ["ユ", "y", "u"],
  // ["ュ", "y", "u"],
  ["ヤ", "y", "a"],
  // ["ャ", "y", "a"],
  ["モ", "m", "o"],
  ["メ", "m", "e"],
  ["ム", "m", "u"],
  ["ミョ", "my", "o"],
  ["ミュ", "my", "u"],
  ["ミャ", "my", "a"],
  ["ミェ", "my", "e"],
  ["ミ", "m", "i"],
  ["マ", "m", "a"],
  ["ポ", "p", "o"],
  ["ボ", "b", "o"],
  ["ホ", "h", "o"],
  ["ペ", "p", "e"],
  ["ベ", "b", "e"],
  ["ヘ", "h", "e"],
  ["プ", "p", "u"],
  ["ブ", "b", "u"],
  ["フォ", "f", "o"],
  ["フェ", "f", "e"],
  ["フィ", "f", "i"],
  ["ファ", "f", "a"],
  ["フ", "f", "u"],
  ["ピョ", "py", "o"],
  ["ピュ", "py", "u"],
  ["ピャ", "py", "a"],
  ["ピェ", "py", "e"],
  ["ピ", "p", "i"],
  ["ビョ", "by", "o"],
  ["ビュ", "by", "u"],
  ["ビャ", "by", "a"],
  ["ビェ", "by", "e"],
  ["ビ", "b", "i"],
  ["ヒョ", "hy", "o"],
  ["ヒュ", "hy", "u"],
  ["ヒャ", "hy", "a"],
  ["ヒェ", "hy", "e"],
  ["ヒ", "h", "i"],
  ["パ", "p", "a"],
  ["バ", "b", "a"],
  ["ハ", "h", "a"],
  ["ノ", "n", "o"],
  ["ネ", "n", "e"],
  ["ヌ", "n", "u"],
  ["ニョ", "ny", "o"],
  ["ニュ", "ny", "u"],
  ["ニャ", "ny", "a"],
  ["ニェ", "ny", "e"],
  ["ニ", "n", "i"],
  ["ナ", "n", "a"],
  ["ドゥ", "d", "u"],
  ["ド", "d", "o"],
  ["トゥ", "t", "u"],
  ["ト", "t", "o"],
  ["デョ", "dy", "o"],
  ["デュ", "dy", "u"],
  ["デャ", "dy", "a"],
  ["デェ", "dy", "e"],
  ["ディ", "d", "i"],
  ["デ", "d", "e"],
  ["テョ", "ty", "o"],
  ["テュ", "ty", "u"],
  ["テャ", "ty", "a"],
  ["ティ", "t", "i"],
  ["テ", "t", "e"],
  // ["ヅ", "z", "u"],
  ["ツォ", "ts", "o"],
  ["ツェ", "ts", "e"],
  ["ツィ", "ts", "i"],
  ["ツァ", "ts", "a"],
  ["ツ", "ts", "u"],
  ["ッ", null, "cl"],
  // ["ヂ", "j", "i"],
  ["チョ", "ch", "o"],
  ["チュ", "ch", "u"],
  ["チャ", "ch", "a"],
  ["チェ", "ch", "e"],
  ["チ", "ch", "i"],
  ["ダ", "d", "a"],
  ["タ", "t", "a"],
  ["ゾ", "z", "o"],
  ["ソ", "s", "o"],
  ["ゼ", "z", "e"],
  ["セ", "s", "e"],
  ["ズィ", "z", "i"],
  ["ズ", "z", "u"],
  ["スィ", "s", "i"],
  ["ス", "s", "u"],
  ["ジョ", "j", "o"],
  ["ジュ", "j", "u"],
  ["ジャ", "j", "a"],
  ["ジェ", "j", "e"],
  ["ジ", "j", "i"],
  ["ショ", "sh", "o"],
  ["シュ", "sh", "u"],
  ["シャ", "sh", "a"],
  ["シェ", "sh", "e"],
  ["シ", "sh", "i"],
  ["ザ", "z", "a"],
  ["サ", "s", "a"],
  ["ゴ", "g", "o"],
  ["コ", "k", "o"],
  ["ゲ", "g", "e"],
  ["ケ", "k", "e"],
  // ["ヶ", "k", "e"],
  ["グヮ", "gw", "a"],
  ["グ", "g", "u"],
  ["クヮ", "kw", "a"],
  ["ク", "k", "u"],
  ["ギョ", "gy", "o"],
  ["ギュ", "gy", "u"],
  ["ギャ", "gy", "a"],
  ["ギェ", "gy", "e"],
  ["ギ", "g", "i"],
  ["キョ", "ky", "o"],
  ["キュ", "ky", "u"],
  ["キャ", "ky", "a"],
  ["キェ", "ky", "e"],
  ["キ", "k", "i"],
  ["ガ", "g", "a"],
  ["カ", "k", "a"],
  ["オ", null, "o"],
  // ["ォ", null, "o"],
  ["エ", null, "e"],
  // ["ェ", null, "e"],
  ["ウォ", "w", "o"],
  ["ウェ", "w", "e"],
  ["ウィ", "w", "i"],
  ["ウ", null, "u"],
  // ["ゥ", null, "u"],
  ["イェ", "y", "e"],
  ["イ", null, "i"],
  // ["ィ", null, "i"],
  ["ア", null, "a"],
  // ["ァ", null, "a"],
];

const basic: [string, Mora][] = moraList.map(([text, consonant, vowel]) => [
  text,
  consonant ? { text, consonant, vowel, pitch: 0 } : { text, vowel, pitch: 0 },
]);

const unvoice: [string, Mora][] = moraList
  .filter(([_text, _consonant, vowel]) =>
    ["a", "i", "u", "e", "o"].includes(vowel)
  )
  .map(([text, consonant, vowel]) => [
    UNVOICE_SYMBOL + text,
    consonant
      ? { text, consonant, vowel: vowel.toUpperCase(), pitch: 0 }
      : { text, vowel: vowel.toUpperCase(), pitch: 0 },
  ]);

export const text2mora: Map<string, Mora> = new Map(basic.concat(unvoice));
