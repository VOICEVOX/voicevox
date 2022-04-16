import { State } from "@/store/type";
import { ToolbarButtonTagType } from "@/type/preload";

export function sanitizeFileName(fileName: string): string {
  // \x00 - \x1f: ASCII 制御文字
  //   \x00: Null
  //   ...
  //   \x1f: Unit separator
  // \x22: "
  // \x2a: *
  // \x2f: /
  // \x3a: :
  // \x3c: <
  // \x3e: >
  // \x3f: ?
  // \x5c: \
  // \x7c: |
  // \x7f: DEL

  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;

  return fileName.replace(sanitizer, "");
}

export function buildProjectFileName(state: State, extension?: string): string {
  const headItemText = state.audioItems[state.audioKeys[0]].text;

  const tailItemText =
    state.audioItems[state.audioKeys[state.audioKeys.length - 1]].text;

  const headTailItemText =
    headItemText !== tailItemText
      ? headItemText + "..." + tailItemText
      : headItemText;

  let defaultFileNameStem = sanitizeFileName(headTailItemText);

  if (defaultFileNameStem === "") {
    defaultFileNameStem = "Untitled";
  }

  return extension
    ? `${defaultFileNameStem}.${extension}`
    : defaultFileNameStem;
}

type ReplaceTag =
  | "index"
  | "characterName"
  | "styleName"
  | "rawStyleName"
  | "text";
type Replacer = { [P in ReplaceTag]?: string };
type VariablesForFileName = {
  index: number;
  characterName: string;
  styleName: string | undefined;
  text: string;
};

export const replaceTagMap: Map<ReplaceTag, string> = new Map([
  ["index", "連番"],
  ["characterName", "キャラ"],
  ["styleName", "（スタイル）"],
  ["text", "テキスト"],
  ["rawStyleName", "スタイル"],
]);

export const DEFAULT_FILE_NAME_TEMPLATE =
  "$連番$_$キャラ$$（スタイル）$_$テキスト$.wav";
const DEFAULT_FILE_NAME_VARIABLES: VariablesForFileName = {
  index: 0,
  characterName: "四国めたん",
  text: "おはようこんにちはこんばんは",
  styleName: "ノーマル",
};

function replaceTag(template: string, replacer: Replacer): string {
  let result = `${template}`;

  replaceTagMap.forEach((target, key) => {
    const replacedText = replacer[key] ?? "";
    result = result.replaceAll(`$${target}$`, replacedText);
  });

  return result;
}

export function buildFileNameFromRawData(
  fileNamePattern = DEFAULT_FILE_NAME_TEMPLATE,
  vars: VariablesForFileName = DEFAULT_FILE_NAME_VARIABLES
): string {
  let pattern = fileNamePattern;
  if (pattern.length === 0) {
    // ファイル名指定のオプションが初期値("")ならデフォルトテンプレートを使う
    pattern = DEFAULT_FILE_NAME_TEMPLATE;
  }

  let text = sanitizeFileName(vars.text);
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }

  const characterName = sanitizeFileName(vars.characterName);

  const index = (vars.index + 1).toString().padStart(3, "0");

  // デフォルトのスタイルだとstyleIdが定義されていないのでstyleNameがundefinedになるケースが存在する
  const styleName = sanitizeFileName(vars.styleName ?? "");

  return replaceTag(pattern, {
    index,
    characterName,
    rawStyleName: styleName,
    styleName: styleName.length !== 0 ? `（${styleName}）` : "",
    text,
  });
}

export const getToolbarButtonName = (tag: ToolbarButtonTagType): string => {
  const tag2NameObj: Record<ToolbarButtonTagType, string> = {
    PLAY_CONTINUOUSLY: "連続再生",
    STOP: "停止",
    EXPORT_AUDIO_ONE: "１つ書き出し",
    EXPORT_AUDIO_ALL: "全部書き出し",
    EXPORT_AUDIO_CONNECT_ALL: "音声を繋げて書き出し",
    SAVE_PROJECT: "プロジェクト保存",
    UNDO: "元に戻す",
    REDO: "やり直す",
    IMPORT_TEXT: "テキスト読み込み",
    EMPTY: "空白",
  };
  return tag2NameObj[tag];
};

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

export const convertHiraToKana = (text: string): string => {
  return text.replace(/[\u3041-\u3094]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0x60);
  });
};

export const convertLongVowel = (text: string): string => {
  return text
    .replace(/(?<=[アカサタナハマヤラワャァガザダバパ]ー*)ー/g, "ア")
    .replace(/(?<=[イキシチニヒミリィギジヂビピ]ー*)ー/g, "イ")
    .replace(/(?<=[ウクスツヌフムユルュゥヴグズヅブプ]ー*)ー/g, "ウ")
    .replace(/(?<=[エケセテネヘメレェゲゼデベペ]ー*)ー/g, "エ")
    .replace(/(?<=[オコソトノホモヨロヲョォゴゾドボポ]ー*)ー/g, "オ")
    .replace(/(?<=[ン]ー*)ー/g, "ン")
    .replace(/(?<=[ッ]ー*)ー/g, "ッ");
};
