import path from "path";
import { Platform } from "quasar";
import { Change, diffChars } from "diff";
import pluck from "just-pluck-it";
import { ToolbarButtonTagType, isMac } from "@/type/preload";
import { AccentPhrase, Mora } from "@/openapi";

export const DEFAULT_STYLE_NAME = "ノーマル";

export const formatCharacterStyleName = (
  characterName: string,
  styleName = DEFAULT_STYLE_NAME
) => `${characterName}（${styleName}）`;

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

/**
 * AudioInfoコンポーネントに表示されるパラメータ
 */
export const SLIDER_PARAMETERS = {
  /**
   * 話速パラメータの定義
   */
  SPEED: {
    max: () => 2,
    min: () => 0.5,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   * 音高パラメータの定義
   */
  PITCH: {
    max: () => 0.15,
    min: () => -0.15,
    step: () => 0.01,
    scrollStep: () => 0.01,
  },
  /**
   *  抑揚パラメータの定義
   */
  INTONATION: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  音量パラメータの定義
   */
  VOLUME: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  開始無音パラメータの定義
   */
  PRE_PHONEME_LENGTH: {
    max: () => 1.5,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  終了無音パラメータの定義
   */
  POST_PHONEME_LENGTH: {
    max: () => 1.5,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  モーフィングレートパラメータの定義
   */
  MORPHING_RATE: {
    max: () => 1,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
};

export const replaceTagIdToTagString = {
  index: "連番",
  characterName: "キャラ",
  styleName: "スタイル",
  text: "テキスト",
  date: "日付",
};
const replaceTagStringToTagId: { [tagString: string]: string } = Object.entries(
  replaceTagIdToTagString
).reduce((prev, [k, v]) => ({ ...prev, [v]: k }), {});

export const DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE =
  "$連番$_$キャラ$（$スタイル$）_$テキスト$";
export const DEFAULT_AUDIO_FILE_NAME_TEMPLATE = `${DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE}.wav`;
const DEFAULT_AUDIO_FILE_NAME_VARIABLES = {
  index: 0,
  characterName: "四国めたん",
  text: "テキストテキストテキスト",
  styleName: DEFAULT_STYLE_NAME,
  date: currentDateString(),
};

export function currentDateString(): string {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth().toString().padStart(2, "0");
  const date = currentDate.getDate().toString().padStart(2, "0");

  return `${year}${month}${date}`;
}

function replaceTag(
  template: string,
  replacer: { [key: string]: string }
): string {
  const result = template.replace(/\$(.+?)\$/g, (match, p1) => {
    const replaceTagId = replaceTagStringToTagId[p1];
    if (replaceTagId === undefined) {
      return match;
    }
    return replacer[replaceTagId] ?? "";
  });

  return result;
}

export function extractExportText(text: string): string {
  return skipReadingPart(skipMemoText(text));
}
export function extractYomiText(text: string): string {
  return skipWritingPart(skipMemoText(text));
}
function skipReadingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、漢字部分だけを残す
  return text.replace(/\{([^|]*)\|([^}]*)\}/g, "$1");
}
function skipWritingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、かんじ部分だけを残す
  return text.replace(/\{([^|]*)\|([^}]*)\}/g, "$2");
}
function skipMemoText(targettext: string): string {
  // []をスキップ
  const resolvedText = targettext.replace(/\[.*?\]/g, "");
  return resolvedText;
}

/**
 * 新しく変更されるアクセント句に対して、変更前のモーラを適用するクラス
 *
 *
 * まず、与えられた現在と過去のアクセント句のモーラを一つの配列にまとめる。こうして作られた過去と現在のモーラ配列を、
 * それぞれの「変更前モーラパッチ配列」「変更後モーラパッチ配列」と呼ぶことにする。
 * 「変更前モーラパッチ配列」と「変更後モーラパッチ配列」の各文字をテキスト化して、変更前から変更後への変更に対するテキスト差分を検出し、配列にまとめる。この配列を、テキストパッチ配列と呼ぶ。
 * 変更前モーラパッチ配列の中に、変化分の文字列を挿入、または、変更後の状態に合わせて、モーラを削除する操作を行う。
 * こうして作られたモーラ配列を、モーラパッチ配列と呼ぶ。
 * 最後に、変更後のアクセント句全体をモーラに対して走査し、モーラパッチ配列のモーラテキストとアクセント区のモーラテキストを比較して、テキストが一致していれば、
 * 変更後のアクセントモーラに対して、モーラパッチ配列の要素を適用する。
 */
export class AccentDiff {
  beforeAccent: AccentPhrase[];
  afterAccent: AccentPhrase[];
  constructor(beforeAccent: AccentPhrase[], afterAccent: AccentPhrase[]) {
    this.afterAccent = JSON.parse(JSON.stringify(afterAccent));
    this.beforeAccent = JSON.parse(JSON.stringify(beforeAccent));
  }
  /**
   * アクセント句のテキストを配列として返すメンバ関数
   */
  getMorasTextFromAccentPhrases(accent: AccentPhrase[]) {
    const result: string[] = [];
    accent.forEach((element: AccentPhrase) => {
      const plucked = pluck(element.moras, "text");
      const text = plucked.join("");
      result.push(text);
    });
    return result.join("");
  }
  /**
   * パッチモーラ配列を作成するメンバ関数
   */
  createMorasOrMorasTextArray() {
    const after = JSON.parse(JSON.stringify(this.afterAccent));
    const before = JSON.parse(JSON.stringify(this.beforeAccent));
    // テキストの差分検出
    const diffed: any = diffChars(
      this.getMorasTextFromAccentPhrases(before),
      this.getMorasTextFromAccentPhrases(after)
    );
    const pluckedBefore = pluck(before, "moras").flat(); // 変更前のアクセント句からモーラ配列を作成
    let pluckedIndex = 0; // 現在のモーラ配列の位置(テキストの位置)を表す。各操作に対して、非常に重要
    for (const diff of diffed) {
      if (diff.removed) {
        let removeForSmallCounter = 0; // ャ、ュ、ョといった文字を検出するたびに+1加算される
        for (
          let removeValueIndex = 0;
          removeValueIndex < diff.value.length;
          removeValueIndex++
        ) {
          if (
            diff.value[removeValueIndex] === "ャ" ||
            diff.value[removeValueIndex] === "ュ" ||
            diff.value[removeValueIndex] === "ョ"
          ) {
            ++removeForSmallCounter;
          }
        }
        pluckedBefore.splice(pluckedIndex, diff.count - removeForSmallCounter);
      } else if (diff.added) {
        for (let valueIndex = 0; valueIndex < diff.value.length; valueIndex++) {
          if (
            diff.value[valueIndex] === "ャ" ||
            diff.value[valueIndex] === "ュ" ||
            diff.value[valueIndex] === "ョ"
          ) {
            pluckedBefore.splice(
              pluckedIndex - 1,
              1,
              String(diff.value[valueIndex - 1]) +
                String(diff.value[valueIndex])
            );
            ++pluckedIndex;
          } else {
            pluckedBefore.splice(pluckedIndex, 0, diff.value[valueIndex]);
            ++pluckedIndex;
          }
        }
      } else {
        // 削除も変更もしないfor文を記述
        for (const char of diff.value) {
          if (char === "ャ" || char === "ュ" || char === "ョ") continue;
          else ++pluckedIndex;
        }
      }
    }
    return pluckedBefore;
  }
  /**
   * 変更後のアクセント句に、パッチモーラ配列を適用するメンバ関数
   */
  mergeAccentPhrases() {
    const after = JSON.parse(JSON.stringify(this.afterAccent));
    const pluckedBefore = this.createMorasOrMorasTextArray();
    let beforeIndex = 0; // pluckedBeforeのデータの位置

    // 与えられたアクセント句は、AccentPhrases[ Nmber ][ Object Key][ Number ]の順番で、モーラを操作できるため、二重forで回す
    for (let AccentIndex = 0; AccentIndex < after.length; AccentIndex++) {
      for (
        let MoraIndex = 0;
        MoraIndex < after[AccentIndex]["moras"].length;
        MoraIndex++
      ) {
        // パッチモーラのある要素が文字列なら次へ
        if (typeof pluckedBefore[beforeIndex] === "string") {
          ++beforeIndex;
          continue;
        }
        if (
          after[AccentIndex]["moras"][MoraIndex].text ===
          pluckedBefore[beforeIndex].text
        ) {
          after[AccentIndex]["moras"][MoraIndex] = pluckedBefore[beforeIndex];
        }
        ++beforeIndex;
      }
    }

    return after;
  }
}

/**
 * ２つのAccentPhrasesのテキスト内容が異なるかどうかを判定
 */
export function isAccentPhrasesTextDifferent(
  beforeAccent: AccentPhrase[],
  afterAccent: AccentPhrase[]
): boolean {
  if (beforeAccent.length !== afterAccent.length) return true;

  for (let accentIndex = 0; accentIndex < beforeAccent.length; accentIndex++) {
    if (
      beforeAccent[accentIndex].moras.length !==
        afterAccent[accentIndex].moras.length ||
      beforeAccent[accentIndex].pauseMora?.text !==
        afterAccent[accentIndex].pauseMora?.text
    )
      return true;

    for (
      let moraIndex = 0;
      moraIndex < beforeAccent[accentIndex].moras.length;
      moraIndex++
    ) {
      if (
        beforeAccent[accentIndex].moras[moraIndex].text !==
        afterAccent[accentIndex].moras[moraIndex].text
      ) {
        return true;
      }
    }
  }
  return false;
}

export function buildAudioFileNameFromRawData(
  fileNamePattern = DEFAULT_AUDIO_FILE_NAME_TEMPLATE,
  vars = DEFAULT_AUDIO_FILE_NAME_VARIABLES
): string {
  let pattern = fileNamePattern;
  if (pattern === "") {
    // ファイル名指定のオプションが初期値("")ならデフォルトテンプレートを使う
    pattern = DEFAULT_AUDIO_FILE_NAME_TEMPLATE;
  }

  let text = sanitizeFileName(vars.text);
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }

  const characterName = sanitizeFileName(vars.characterName);

  const index = (vars.index + 1).toString().padStart(3, "0");

  const styleName = sanitizeFileName(vars.styleName);

  const date = currentDateString();

  return replaceTag(pattern, {
    text,
    characterName,
    index,
    styleName,
    date,
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

// based on https://github.com/BBWeb/path-browserify/blob/win-version/index.js
export const getBaseName = (filePath: string) => {
  if (!Platform.is.win) return path.basename(filePath);

  const splitDeviceRegex =
    /^([a-zA-Z]:|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)?([\\/])?([\s\S]*?)$/;
  const splitTailRegex =
    /^([\s\S]*?)((?:\.{1,2}|[^\\/]+?|)(\.[^./\\]*|))(?:[\\/]*)$/;

  const resultOfSplitDeviceRegex = splitDeviceRegex.exec(filePath);
  if (
    resultOfSplitDeviceRegex == undefined ||
    resultOfSplitDeviceRegex.length < 3
  )
    return "";
  const tail = resultOfSplitDeviceRegex[3] || "";

  const resultOfSplitTailRegex = splitTailRegex.exec(tail);
  if (resultOfSplitTailRegex == undefined || resultOfSplitTailRegex.length < 2)
    return "";
  const basename = resultOfSplitTailRegex[2] || "";

  return basename;
};

/**
 * Macでの`command`キー、またはその他OSでの`Ctrl`キーが押されているなら`true`を返します。
 */
// ctrlKey = windowsのCtrl = macのControl
// metaKey = windowsのWin = macのCommand
// altKey = windowsのAlt = macのOption(問題なし)
export const isOnCommandOrCtrlKeyDown = (event: {
  metaKey: boolean;
  ctrlKey: boolean;
}) => (isMac && event.metaKey) || (!isMac && event.ctrlKey);

/**
 * AccentPhraseのtextを結合して返します。
 */
export const joinTextsInAccentPhrases = (
  accentPhrase: AccentPhrase
): string => {
  return accentPhrase.moras.map((mora) => mora.text).join("");
};
