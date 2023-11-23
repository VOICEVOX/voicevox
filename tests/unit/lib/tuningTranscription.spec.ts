import { AccentPhrase, Mora } from "@/openapi";
import { TuningTranscription } from "@/store/utility";

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
    expect(findMora(result, moraText)).not.toEqual(findMora(before, moraText));
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
    expect(findMora(result, moraText)).not.toEqual(findMora(before, moraText));
  });
});
