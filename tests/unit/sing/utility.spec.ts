import { filterCharacterInfosByStyleType } from "@/sing/utility";
import { CharacterInfo, EngineId, SpeakerId, StyleId } from "@/type/preload";

const engineId = EngineId("00000000-0000-0000-0000-000000000000");
const otherEngineId = EngineId("00000000-0000-0000-0000-000000000001");
const characterInfos: CharacterInfo[] = [
  {
    portraitPath: "path/to/portrait",
    metas: {
      policy: "policy",
      speakerName: "Speaker 1",
      speakerUuid: SpeakerId("00000000-0000-0000-0000-000000000000"),
      styles: [
        {
          styleName: "styleName",
          styleType: "talk",
          engineId,
          styleId: StyleId(0),
          iconPath: "path/to/icon",
          portraitPath: "path/to/portrait",
          voiceSamplePaths: [],
        },
        {
          styleName: "styleName",
          styleType: "humming",
          engineId,
          styleId: StyleId(1),
          iconPath: "path/to/icon",
          portraitPath: "path/to/portrait",
          voiceSamplePaths: [],
        },
        {
          styleName: "styleName",
          styleType: "sing",
          engineId,
          styleId: StyleId(2),
          iconPath: "path/to/icon",
          portraitPath: "path/to/portrait",
          voiceSamplePaths: [],
        },
      ],
    },
  },
  {
    portraitPath: "path/to/portrait",
    metas: {
      policy: "policy",
      speakerName: "Speaker without styleType",
      speakerUuid: SpeakerId("00000000-0000-0000-0000-000000000001"),
      styles: [
        {
          styleName: "styleName",
          engineId: otherEngineId,
          styleId: StyleId(0),
          iconPath: "path/to/icon",
          portraitPath: "path/to/portrait",
          voiceSamplePaths: [],
        },
      ],
    },
  },
];

for (const styleType of ["humming", "sing"] as const) {
  it(`${styleType}のキャラクターが取得できる`, () => {
    const filtered = filterCharacterInfosByStyleType(characterInfos, styleType);
    // talkしかないキャラクターは除外される
    expect(filtered.length).toBe(1);
    // styleTypeが指定したものになっている
    expect(filtered[0].metas.styles[0].styleType).toBe(styleType);
    // stylesの数が正しい
    expect(filtered[0].metas.styles.length).toBe(1);
  });
}

it(`singerLikeを指定するとsingとhummingのキャラクターが取得できる`, () => {
  const filtered = filterCharacterInfosByStyleType(
    characterInfos,
    "singerLike"
  );
  expect(filtered.length).toBe(1);
  expect(filtered[0].metas.styles.length).toBe(2);
});

it(`talkを指定するとsingerLike以外のキャラクターが取得できる`, () => {
  const filtered = filterCharacterInfosByStyleType(characterInfos, "talk");
  expect(filtered.length).toBe(2);
  expect(filtered[0].metas.styles.length).toBe(1);
  expect(filtered[1].metas.styles.length).toBe(1);
});
