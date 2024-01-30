import path from "path";
import { Platform } from "quasar";
import { diffArrays } from "diff";
import {
  CharacterInfo,
  StyleInfo,
  StyleType,
  ToolbarButtonTagType,
  isMac,
} from "@/type/preload";
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
    if (replaceTagId == undefined) {
      return match;
    }
    return replacer[replaceTagId] ?? "";
  });

  return result;
}

/**
 * テキスト書き出し用のテキストを生成する。
 */
export function extractExportText(
  text: string,
  {
    enableMemoNotation,
    enableRubyNotation,
  }: { enableMemoNotation: boolean; enableRubyNotation: boolean }
): string {
  if (enableMemoNotation) {
    text = skipMemoText(text);
  }
  if (enableRubyNotation) {
    text = skipRubyReadingPart(text);
  }
  return text;
}

/**
 * 読み用のテキストを生成する。
 */
export function extractYomiText(
  text: string,
  {
    enableMemoNotation,
    enableRubyNotation,
  }: { enableMemoNotation: boolean; enableRubyNotation: boolean }
): string {
  if (enableMemoNotation) {
    text = skipMemoText(text);
  }
  if (enableRubyNotation) {
    text = skipRubyWritingPart(text);
  }
  return text;
}

function skipRubyReadingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、漢字部分だけを残す
  return text
    .replace(/\{([^|]*)\|([^}]*)\}/g, "$1")
    .replace(/｛([^|]*)｜([^}]*)｝/g, "$1");
}
function skipRubyWritingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、かんじ部分だけを残す
  return text
    .replace(/\{([^|]*)\|([^}]*)\}/g, "$2")
    .replace(/｛([^|]*)｜([^}]*)｝/g, "$2");
}
function skipMemoText(targettext: string): string {
  // []をスキップ
  return targettext.replace(/\[.*?\]/g, "").replace(/［.*?］/g, "");
}

/**
 * 2つのアクセント句配列を比べて同じだと思われるモーラの調整結果を転写し
 * 変更前のアクセント句の調整結果を変更後のアクセント句に保持する。
 *
 * <例>
 * 「こんにちは」 -> 「こんばんは」と変更した場合、[]に囲まれる部分で変更前のモーラが転写される。
 * 「 [こん]ばん[は] 」
 */
export class TuningTranscription {
  beforeAccent: AccentPhrase[];
  afterAccent: AccentPhrase[];
  constructor(beforeAccent: AccentPhrase[], afterAccent: AccentPhrase[]) {
    this.beforeAccent = JSON.parse(JSON.stringify(beforeAccent));
    this.afterAccent = JSON.parse(JSON.stringify(afterAccent));
  }

  private createFlatArray<T, K extends keyof T>(
    collection: T[],
    key: K
  ): T[K] extends (infer U)[] ? U[] : T[K][] {
    const result = [];
    for (const element of collection) {
      const value = element[key];
      if (Array.isArray(value)) {
        result.push(...value);
      } else {
        result.push(value);
      }
    }
    return result as T[K] extends (infer U)[] ? U[] : T[K][];
  }

  /**
   * 変更前の配列を操作してpatchMora配列を作る。
   *
   * <例> (Ｕはundefined）
   * 変更前 [ ズ, ン, ダ, モ, ン, ナ, ノ, ダ ]
   * 変更後 [ ボ, ク, ズ, ン, ダ, ナ, ノ, デ, ス ]
   *
   * 再利用される文字列とundefinedで構成されたデータを作る。
   *       [ Ｕ, Ｕ, ズ, ン, ダ, ナ, ノ, Ｕ, Ｕ ]
   *
   * 実際には"ズ"などの文字列部分は{text: "ズ"...}のようなデータ構造になっている。
   * [ Ｕ, Ｕ, {text: "ズ"...}, {text: "ン"...}, {text: "ダ"...}, {text: "ナ"...}, {text: "ノ"...}, Ｕ, Ｕ ]
   */
  private createDiffPatch() {
    const before = structuredClone(this.beforeAccent);
    const after = structuredClone(this.afterAccent);

    const beforeFlatArray = this.createFlatArray(before, "moras");
    const afterFlatArray = this.createFlatArray(after, "moras");
    const diffed = diffArrays(
      this.createFlatArray(beforeFlatArray, "text"),
      this.createFlatArray(afterFlatArray, "text")
    );

    // FIXME: beforeFlatArrayを破壊的に変更しなくても良いようにしてasを不要にする
    let currentTextIndex = 0;
    for (const diff of diffed) {
      if (diff.removed) {
        beforeFlatArray.splice(currentTextIndex, diff.count);
      } else if (diff.added) {
        diff.value.forEach(() => {
          beforeFlatArray.splice(
            currentTextIndex,
            0,
            undefined as never as Mora
          );
          currentTextIndex++;
        });
      } else {
        currentTextIndex += diff.value.length;
      }
    }
    return beforeFlatArray as (Mora | undefined)[];
  }

  /**
   * moraPatchとafterAccentを比較し、textが一致するモーラを転写する。
   *
   *  <例> (「||」は等号記号を表す)
   * 「こんにちは」 -> 「こんばんは」 とテキストを変更した場合、以下の例のように比較する。
   *
   *           moraPatch = [ {text: "コ"...}, {text: "ン"...}, undefined      , undefined      , {text: "ハ"...} ]
   *                              ||                ||                                                ||
   * after[...]["moras"] = [ {text: "コ"...}, {text: "ン"...}, {text: "バ"...}, {text: "ン"...}, {text: "ハ"...} ]
   *
   * あとは一致したモーラを転写するだけ。
   *
   */
  private mergeAccentPhrases(moraPatch: (Mora | undefined)[]): AccentPhrase[] {
    const after: AccentPhrase[] = structuredClone(this.afterAccent);
    let moraPatchIndex = 0;

    // AccentPhrasesから[ accentIndex ]["moras"][ moraIndex ]でモーラが得られる。
    for (let accentIndex = 0; accentIndex < after.length; accentIndex++) {
      for (
        let moraIndex = 0;
        moraIndex < after[accentIndex]["moras"].length;
        moraIndex++
      ) {
        // undefinedのとき、何もせず次のモーラへ移動
        if (moraPatch[moraPatchIndex] == undefined) {
          moraPatchIndex++;
          continue;
        }
        if (
          after[accentIndex]["moras"][moraIndex].text ===
          moraPatch[moraPatchIndex]?.text
        ) {
          after[accentIndex]["moras"][moraIndex] = moraPatch[
            moraPatchIndex
          ] as Mora;
        }
        moraPatchIndex++;
      }
    }

    return after;
  }

  transcribe() {
    const moraPatch = this.createDiffPatch();
    return this.mergeAccentPhrases(moraPatch as never);
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
  const date = vars.date;
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
    EXPORT_AUDIO_SELECTED: "選択音声を書き出し",
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
 * スタイルがシングエディタで利用可能なスタイルかどうかを判定します。
 */
export const isSingingStyle = (styleInfo: StyleInfo) => {
  return (
    styleInfo.styleType === "humming" ||
    styleInfo.styleType === "sing" ||
    styleInfo.styleType === "sing_teacher"
  );
};

/**
 * CharacterInfoの配列を、指定されたスタイルタイプでフィルタリングします。
 */
export const filterCharacterInfosByStyleType = (
  characterInfos: CharacterInfo[],
  styleType: StyleType | "singerLike"
): CharacterInfo[] => {
  const withStylesFiltered: CharacterInfo[] = characterInfos.map(
    (characterInfo) => {
      const styles = characterInfo.metas.styles.filter((styleInfo) => {
        // singerLike：歌う系のスタイル
        if (styleType === "singerLike") {
          return isSingingStyle(styleInfo);
        }
        // talk：singerLike以外のスタイル。
        // styleTypeが存在しない（マルチエンジン）場合があるので、「singerLike以外」をtalkとして扱っている。
        if (styleType === "talk") {
          return !isSingingStyle(styleInfo);
        }
        return styleInfo.styleType === styleType;
      });
      return { ...characterInfo, metas: { ...characterInfo.metas, styles } };
    }
  );

  const withoutEmptyStyles = withStylesFiltered.filter(
    (characterInfo) => characterInfo.metas.styles.length > 0
  );

  return withoutEmptyStyles;
};
