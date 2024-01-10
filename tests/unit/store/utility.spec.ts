import { AccentPhrase, Mora } from "@/openapi";
import { ToolbarButtonTagType, isMac } from "@/type/preload";
import {
  DEFAULT_AUDIO_FILE_NAME_TEMPLATE,
  formatCharacterStyleName,
  sanitizeFileName,
  currentDateString,
  DEFAULT_STYLE_NAME,
  extractExportText,
  extractYomiText,
  TuningTranscription,
  // isAccentPhrasesTextDifferent,
  buildAudioFileNameFromRawData,
  getToolbarButtonName,
  createKanaRegex,
  convertHiraToKana,
  convertLongVowel,
  getBaseName,
  isOnCommandOrCtrlKeyDown,
  joinTextsInAccentPhrases,
} from "@/store/utility";

function createDummyMora(text: string): Mora {
  return {
    text,
    vowel: "dummy",
    vowelLength: Math.random(),
    pitch: Math.random(),
  };
}

function createDummyAccentPhrase(moraTexts: string[]): AccentPhrase {
  return {
    moras: moraTexts.map(createDummyMora),
    accent: Math.random(),
  };
}

// AccentPhrasesから特定のmora textを持つものMoraを返す
function findMora(
  accentPhrases: AccentPhrase[],
  text: string
): Mora | undefined {
  let candidate: Mora | undefined;
  for (let i = 0; i < accentPhrases.length; i++) {
    for (let j = 0; j < accentPhrases[i].moras.length; j++) {
      if (accentPhrases[i].moras[j].text === text) {
        if (candidate != undefined) {
          throw new Error(`AccentPhraseに${text}が複数見つかりました`);
        }
        candidate = accentPhrases[i].moras[j];
      }
    }
  }
  return candidate;
}

describe("Utilitys", () => {
  test("formatCharacterStyleName", () => {
    expect(formatCharacterStyleName("四国めたん", DEFAULT_STYLE_NAME)).toEqual(
      "四国めたん（ノーマル）"
    );
  });

  test("sanitizeFileName", () => {
    expect(sanitizeFileName("テスト\x00ファイル\x1f名.txt")).toBe(
      "テストファイル名.txt"
    );
    expect(sanitizeFileName('テスト"*/:<>?\\|ファイル名.txt')).toBe(
      "テストファイル名.txt"
    );
  });

  test("currentDateString", () => {
    expect(currentDateString()).toMatch(/\d{4}\d{2}\d{2}/);
  });

  test("extractExportText", () => {
    const input = "{漢字|かんじ}[半角記号メモ]";
    const expected = "漢字";
    const result = extractExportText(input);
    expect(result).toEqual(expected);
  });

  test("extractYomiText", () => {
    const input = "{漢字|かんじ}[メモ]";
    const expected = "かんじ";
    const result = extractYomiText(input);
    expect(result).toEqual(expected);
  });

  test("TuningTranscription", () => {
    it("２つ以上のアクセント句でも正しくデータを転写できる", async () => {
      const before: AccentPhrase[] = [
        createDummyAccentPhrase(["い", "え"]),
        createDummyAccentPhrase(["か", "き", "く", "け", "こ"]),
        createDummyAccentPhrase(["さ", "し", "す", "せ", "そ"]),
      ];
      const after: AccentPhrase[] = [
        createDummyAccentPhrase(["あ", "い", "う", "え", "お"]), // 最初・真ん中・最後に追加
        createDummyAccentPhrase(["き", "け"]), // 最初・真ん中・最後を消去
        createDummyAccentPhrase(["た", "ち", "つ", "て", "と"]), // すべて置き換え
      ];
      const tuningTransctiption = new TuningTranscription(before, after);
      const result = tuningTransctiption.transcribe();

      // モーラ数などは変わっていない
      expect(result.length).toEqual(after.length);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].moras.length).toEqual(after[i].moras.length);
      }

      // 転写されている
      ["い", "え", "き", "け"].forEach((moraText) => {
        expect(findMora(result, moraText)).toEqual(findMora(before, moraText));
      });

      // 転写されていない
      ["あ", "う", "お", "た", "ち", "つ", "て", "と"].forEach((moraText) => {
        expect(findMora(result, moraText)).not.toEqual(
          findMora(before, moraText)
        );
      });
    });

    it("拗音のあるモーラも正しくデータを転写できる", async () => {
      const before = [
        createDummyAccentPhrase(["い", "しぃ", "う", "しゅ", "お", "しょ"]),
      ];
      const after = [
        createDummyAccentPhrase(["あ", "しゃ", "き", "きゅ", "お", "しょ"]),
      ];
      const tuningTransctiption = new TuningTranscription(before, after);
      const result = tuningTransctiption.transcribe();

      // モーラ数などは変わっていない
      expect(result.length).toEqual(after.length);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].moras.length).toEqual(after[i].moras.length);
      }

      // 転写されている
      ["お", "しょ"].forEach((moraText) => {
        expect(findMora(result, moraText)).toEqual(findMora(before, moraText));
      });

      // 転写されていない
      ["あ", "しゃ", "き", "きゅ"].forEach((moraText) => {
        expect(findMora(result, moraText)).not.toEqual(
          findMora(before, moraText)
        );
      });
    });
  });

  test("buildAudioFileNameFromRawData", () => {
    it("指定したパターンに従ってファイル名を生成する", () => {
      const fileNamePattern = "テストパターン";
      const vars = {
        index: 1,
        characterName: "四国めたん",
        text: "テストテキスト",
        styleName: "ツンツン",
        date: currentDateString(),
      };
      const result = buildAudioFileNameFromRawData(fileNamePattern, vars);
      expect(result).toBe("テストパターン");
    });

    it("何も記述しなくても処理される", () => {
      // このテストが通らない場合
      // buildAudioFileFromRawData関数の記述か
      // デフォルト引数が間違っている可能性がある。
      const result = buildAudioFileNameFromRawData();
      expect(result).toBe(DEFAULT_AUDIO_FILE_NAME_TEMPLATE);
    });
  });

  test("getToolbarButtonName", () => {
    expect(getToolbarButtonName("PLAY_CONTINUOUSLY")).toBe("連続再生");
    expect(getToolbarButtonName("STOP")).toBe("停止");
    expect(getToolbarButtonName("EXPORT_AUDIO_SELECTED")).toBe(
      "選択音声を書き出し"
    );
    expect(getToolbarButtonName("EXPORT_AUDIO_ALL")).toBe("全部書き出し");
    expect(getToolbarButtonName("EXPORT_AUDIO_CONNECT_ALL")).toBe(
      "音声を繋げて書き出し"
    );
    expect(getToolbarButtonName("存在しないタグ" as ToolbarButtonTagType)).toBe(
      undefined
    );
  });

  test("createKanaRegex", () => {
    it("includeSeparationがtrueの場合、読点とクエスチョンも含む", () => {
      const regex = createKanaRegex(true);
      expect(regex.test("あいうえお、")).toBe(true);
      expect(regex.test("かきくけこ？")).toBe(true);
    });

    it("includeSeparationがfalseの場合、読点とクエスチョンを含まない", () => {
      const regex = createKanaRegex(false);
      expect(regex.test("あいうえお、")).toBe(false);
      expect(regex.test("かきくけこ？")).toBe(false);
    });
  });

  test("convertHiraToKana", () => {
    expect(convertHiraToKana("あいうえお")).toBe("アイウエオ");
    expect(convertHiraToKana("かきくけこ")).toBe("カキクケコ");
    expect(convertHiraToKana("さしすせそ")).toBe("サシスセソ");
  });

  test("convertLongVowel", () => {
    expect(convertLongVowel("アー")).toBe("アア");
    expect(convertLongVowel("イー")).toBe("イイ");
    expect(convertLongVowel("ウー")).toBe("ウウ");
    expect(convertLongVowel("エー")).toBe("エエ");
    expect(convertLongVowel("オー")).toBe("オオ");
  });

  test("getBaseName", () => {
    expect(getBaseName("/path/to/file.txt")).toBe("file.txt");
    expect(getBaseName("/path/to/file")).toBe("file");
    expect(getBaseName("file.txt")).toBe("file.txt");
    expect(getBaseName("file")).toBe("file");
  });

  test("isOnCommandOrCtrlKeyDown", () => {
    expect(isOnCommandOrCtrlKeyDown({ metaKey: true, ctrlKey: false })).toBe(
      isMac
    );
    expect(isOnCommandOrCtrlKeyDown({ metaKey: false, ctrlKey: true })).toBe(
      !isMac
    );
    expect(isOnCommandOrCtrlKeyDown({ metaKey: true, ctrlKey: true })).toBe(
      true
    );
    expect(isOnCommandOrCtrlKeyDown({ metaKey: false, ctrlKey: false })).toBe(
      false
    );
  });

  test("joinTextsInAccentPhrases", () => {
    const accentPhrase: AccentPhrase = {
      moras: [
        createDummyMora("あ"),
        createDummyMora("い"),
        createDummyMora("う"),
        createDummyMora("え"),
        createDummyMora("お"),
      ],
      accent: 0,
    };
    const expected = "あいうえお";
    const result = joinTextsInAccentPhrases(accentPhrase);
    expect(result).toEqual(expected);
  });
});
