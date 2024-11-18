import { AccentPhrase, Mora } from "@/openapi";
import {
  CharacterInfo,
  EngineId,
  SpeakerId,
  StyleId,
  ToolbarButtonTagType,
} from "@/type/preload";
import {
  formatCharacterStyleName,
  sanitizeFileName,
  currentDateString,
  DEFAULT_STYLE_NAME,
  extractExportText,
  extractYomiText,
  TuningTranscription,
  isAccentPhrasesTextDifferent,
  buildAudioFileNameFromRawData,
  getToolbarButtonName,
  isOnCommandOrCtrlKeyDown,
  filterCharacterInfosByStyleType,
} from "@/store/utility";
import { uuid4 } from "@/helpers/random";
import { isMac } from "@/helpers/platform";

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
  text: string,
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

test("formatCharacterStyleName", () => {
  expect(formatCharacterStyleName("四国めたん", DEFAULT_STYLE_NAME)).toEqual(
    "四国めたん（ノーマル）",
  );
});

test("sanitizeFileName", () => {
  expect(sanitizeFileName("テスト\x00ファイル\x1f名.txt")).toBe(
    "テストファイル名.txt",
  );
  expect(sanitizeFileName('テスト"*/:<>?\\|ファイル名.txt')).toBe(
    "テストファイル名.txt",
  );
});

test("currentDateString", () => {
  expect(currentDateString()).toMatch(/\d{4}\d{2}\d{2}/);
});

describe.each([
  // 半角記号
  {
    testName: "半角記号",
    memoText: "ダミー]ダミー[メモ]ダミー[ダミー",
    rubyText: "ダミー|}ダミー{漢字|読み}ダミー{|ダミー",
    expectedSkippedMemoText: "ダミー]ダミーダミー[ダミー",
    expectedSkippedRubyExportText: "ダミー|}ダミー読みダミー{|ダミー",
    expectedSkippedRubyYomiText: "ダミー|}ダミー漢字ダミー{|ダミー",
  },
  // 全角記号
  {
    testName: "全角記号",
    memoText: "ダミー］ダミー［メモ］ダミー［ダミー",
    rubyText: "ダミー｜｝ダミー｛漢字｜読み｝ダミー｛｜ダミー",
    expectedSkippedMemoText: "ダミー］ダミーダミー［ダミー",
    expectedSkippedRubyExportText: "ダミー｜｝ダミー読みダミー｛｜ダミー",
    expectedSkippedRubyYomiText: "ダミー｜｝ダミー漢字ダミー｛｜ダミー",
  },
])(
  "extractExportTextとextractYomiText $testName",
  ({
    memoText,
    rubyText,
    expectedSkippedMemoText,
    expectedSkippedRubyExportText,
    expectedSkippedRubyYomiText,
  }) => {
    const text = memoText + rubyText;

    it("無指定の場合はそのまま", () => {
      const param = {
        enableMemoNotation: false,
        enableRubyNotation: false,
      };
      expect(extractExportText(text, param)).toBe(text);
      expect(extractYomiText(text, param)).toBe(text);
    });

    it("メモをスキップ", () => {
      const param = {
        enableMemoNotation: true,
        enableRubyNotation: false,
      };
      expect(extractExportText(text, param)).toBe(
        expectedSkippedMemoText + rubyText,
      );
      expect(extractYomiText(text, param)).toBe(
        expectedSkippedMemoText + rubyText,
      );
    });

    it("ルビをスキップ", () => {
      const param = {
        enableMemoNotation: false,
        enableRubyNotation: true,
      };
      expect(extractExportText(text, param)).toBe(
        memoText + expectedSkippedRubyYomiText,
      );
      expect(extractYomiText(text, param)).toBe(
        memoText + expectedSkippedRubyExportText,
      );
    });

    it("メモとルビをスキップ", () => {
      const param = {
        enableMemoNotation: true,
        enableRubyNotation: true,
      };
      expect(extractExportText(text, param)).toBe(
        expectedSkippedMemoText + expectedSkippedRubyYomiText,
      );
      expect(extractYomiText(text, param)).toBe(
        expectedSkippedMemoText + expectedSkippedRubyExportText,
      );
    });
  },
);

describe("TuningTranscription", () => {
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
        findMora(before, moraText),
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
        findMora(before, moraText),
      );
    });
  });
});

describe("isAccentPhrasesTextDifferent", () => {
  it("アクセントフレーズのテキストが異なる場合、trueを返す", () => {
    const accentPhrases1 = [
      createDummyAccentPhrase(["あ", "い", "う"]),
      createDummyAccentPhrase(["え", "お"]),
    ];
    const accentPhrases2 = [
      createDummyAccentPhrase(["か", "き", "く"]),
      createDummyAccentPhrase(["け", "こ"]),
    ];
    const result = isAccentPhrasesTextDifferent(accentPhrases1, accentPhrases2);
    expect(result).toBe(true);
  });

  it("アクセントフレーズのテキストが同じ場合、falseを返す", () => {
    const accentPhrases1 = [
      createDummyAccentPhrase(["あ", "い", "う"]),
      createDummyAccentPhrase(["え", "お"]),
    ];
    const accentPhrases2 = [
      createDummyAccentPhrase(["あ", "い", "う"]),
      createDummyAccentPhrase(["え", "お"]),
    ];
    const result = isAccentPhrasesTextDifferent(accentPhrases1, accentPhrases2);
    expect(result).toBe(false);
  });
});

test("buildAudioFileNameFromRawData", () => {
  const fileNamePattern =
    "index=$連番$ characterName=$キャラ$ text=$テキスト$ styleName=$スタイル$ date=$日付$ projectName=$プロジェクト名$";
  const vars = {
    index: 10,
    characterName: "キャラ１",
    text: "テストテキスト",
    styleName: "スタイル１",
    date: "20210801",
    projectName: "サンプルプロジェクト",
  };
  const result = buildAudioFileNameFromRawData(fileNamePattern, vars);
  expect(result).toBe(
    "index=011 characterName=キャラ１ text=テストテキスト styleName=スタイル１ date=20210801 projectName=サンプルプロジェクト",
  );
});

test("getToolbarButtonName", () => {
  expect(getToolbarButtonName("PLAY_CONTINUOUSLY")).toBe("連続再生");
  expect(getToolbarButtonName("STOP")).toBe("停止");
  expect(getToolbarButtonName("EXPORT_AUDIO_SELECTED")).toBe(
    "選択音声を書き出し",
  );
  expect(getToolbarButtonName("EXPORT_AUDIO_ALL")).toBe("全部書き出し");
  expect(getToolbarButtonName("EXPORT_AUDIO_CONNECT_ALL")).toBe(
    "音声を繋げて書き出し",
  );
  expect(getToolbarButtonName("存在しないタグ" as ToolbarButtonTagType)).toBe(
    undefined,
  );
});

test("isOnCommandOrCtrlKeyDown", () => {
  expect(isOnCommandOrCtrlKeyDown({ metaKey: true, ctrlKey: false })).toBe(
    isMac,
  );
  expect(isOnCommandOrCtrlKeyDown({ metaKey: false, ctrlKey: true })).toBe(
    !isMac,
  );
  expect(isOnCommandOrCtrlKeyDown({ metaKey: true, ctrlKey: true })).toBe(true);
  expect(isOnCommandOrCtrlKeyDown({ metaKey: false, ctrlKey: false })).toBe(
    false,
  );
});

describe("filterCharacterInfosByStyleType", () => {
  const createCharacterInfo = (
    styleTypes: (undefined | "talk" | "frame_decode" | "sing")[],
  ): CharacterInfo => {
    const engineId = EngineId(uuid4());
    return {
      portraitPath: "path/to/portrait",
      metas: {
        policy: "policy",
        speakerName: "speakerName",
        speakerUuid: SpeakerId(uuid4()),
        styles: styleTypes.map((styleType) => ({
          styleType,
          styleName: "styleName",
          engineId,
          styleId: StyleId(Math.random()),
          iconPath: "path/to/icon",
          portraitPath: "path/to/portrait",
          voiceSamplePaths: [],
        })),
      },
    };
  };
  const characterInfos: CharacterInfo[] = [
    createCharacterInfo(["talk"]),
    createCharacterInfo(["frame_decode"]),
    createCharacterInfo(["sing"]),
    createCharacterInfo(["talk", "frame_decode", "sing"]),
    createCharacterInfo([undefined]),
  ];

  for (const styleType of ["frame_decode", "sing"] as const) {
    test(`${styleType}のキャラクターが取得できる`, () => {
      const filtered = filterCharacterInfosByStyleType(
        characterInfos,
        styleType,
      );
      // talkしかないキャラクターは除外される
      expect(filtered.length).toBe(2);
      filtered.forEach((c) => {
        // styleTypeが指定したものになっている
        expect(c.metas.styles[0].styleType).toBe(styleType);
        // stylesの数が正しい
        expect(c.metas.styles.length).toBe(1);
      });
    });
  }

  test(`singerLikeを指定するとsingとhummingのキャラクターが取得できる`, () => {
    const filtered = filterCharacterInfosByStyleType(
      characterInfos,
      "singerLike",
    );
    expect(filtered.length).toBe(3);
    expect(filtered[0].metas.styles.length).toBe(1);
    expect(filtered[1].metas.styles.length).toBe(1);
    expect(filtered[2].metas.styles.length).toBe(2);
  });

  test(`talkを指定するとsingerLike以外のキャラクターが取得できる`, () => {
    const filtered = filterCharacterInfosByStyleType(characterInfos, "talk");
    expect(filtered.length).toBe(3);
    expect(filtered[0].metas.styles.length).toBe(1);
    expect(filtered[1].metas.styles.length).toBe(1);
    expect(filtered[2].metas.styles.length).toBe(1);
  });
});
