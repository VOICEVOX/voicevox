/**
 * 日本語のひらがなやカタカナなどを扱う
 */

/** 読み仮名を検出するための正規表現を生成する */
export const createKanaRegex = (includeSeparation?: boolean): RegExp => {
  // 以下の文字のみで構成される場合、「読み仮名」としてこれを処理する
  // includeSeparationがtrueの時は、読点(U+3001)とクエスチョン(U+FF1F)も含む
  //  * ひらがな(U+3041~U+3094)
  //  * カタカナ(U+30A1~U+30F4)
  //  * 全角長音(U+30FC)
  if (includeSeparation) {
    return /^[\u3041-\u3094\u30A1-\u30F4\u30FC\u3001\uFF1F]+$/;
  }
  return /^[\u3041-\u3094\u30A1-\u30F4\u30FC]+$/;
};

/** ひらがなをカタカナにする */
export const convertHiraToKana = (text: string): string => {
  return text.replace(/[\u3041-\u3094]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0x60);
  });
};

/** ひらがなやカタカナに含まれる長音を母音に変換する */
export const convertLongVowel = (text: string): string => {
  return text
    .replace(/(?<=[アカサタナハマヤラワャァガザダバパ]ー*)ー/g, "ア")
    .replace(/(?<=[イキシチニヒミリィギジヂビピ]ー*)ー/g, "イ")
    .replace(/(?<=[ウクスツヌフムユルュゥヴグズヅブプ]ー*)ー/g, "ウ")
    .replace(/(?<=[エケセテネヘメレェゲゼデベペ]ー*)ー/g, "エ")
    .replace(/(?<=[オコソトノホモヨロヲョォゴゾドボポ]ー*)ー/g, "オ")
    .replace(/(?<=[ン]ー*)ー/g, "ン")
    .replace(/(?<=[ッ]ー*)ー/g, "ッ")
    .replace(/(?<=[あかさたなはまやらわゃぁがざだばぱ]ー*)ー/g, "あ")
    .replace(/(?<=[いきしちにひみりぃぎじぢびぴ]ー*)ー/g, "い")
    .replace(/(?<=[うくすつぬふむゆるゅぅぐずづぶぷ]ー*)ー/g, "う")
    .replace(/(?<=[えけせてねへめれぇげぜでべぺ]ー*)ー/g, "え")
    .replace(/(?<=[おこそとのほもよろをょぉごぞどぼぽ]ー*)ー/g, "お")
    .replace(/(?<=[ん]ー*)ー/g, "ん")
    .replace(/(?<=[っ]ー*)ー/g, "っ");
};
