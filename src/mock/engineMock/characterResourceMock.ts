/**
 * キャラクター情報を作るモック。
 * なんとなくVOICEVOX ENGINEリポジトリのモック実装と揃えている。
 */

import { Speaker, SpeakerInfo } from "@/openapi";

/** 立ち絵のURLを得る */
function getPortraitUrl(characterIndex: number) {
  const portraits = Object.values(
    import.meta.glob<string>("./assets/portrait_*.png", {
      import: "default",
      eager: true,
    }),
  );
  return portraits[characterIndex];
}

/** アイコンのURLを得る */
function getIconUrl(characterIndex: number) {
  const icons = Object.values(
    import.meta.glob<string>("./assets/icon_*.png", {
      import: "default",
      eager: true,
    }),
  );
  return icons[characterIndex];
}

const baseCharactersMock = [
  // トーク２つ・ハミング２つ
  {
    name: "dummy1",
    styles: [
      { name: "style0", id: 0 },
      { name: "style1", id: 2 },
      { name: "style2", id: 4, type: "frame_decode" },
      { name: "style3", id: 6, type: "frame_decode" },
    ],
    speakerUuid: "7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff",
    version: "mock",
  },
  // トーク２つ・ハミング１つ・ソング１つ
  {
    name: "dummy2",
    styles: [
      { name: "style0", id: 1 },
      { name: "style1", id: 3 },
      { name: "style2", id: 5, type: "frame_decode" },
      { name: "style3", id: 7, type: "sing" },
    ],
    speakerUuid: "388f246b-8c41-4ac1-8e2d-5d79f3ff56d9",
    version: "mock",
  },
  // トーク１つ
  {
    name: "dummy3",
    styles: [{ name: "style0", id: 8, type: "talk" }],
    speakerUuid: "35b2c544-660e-401e-b503-0e14c635303a",
    version: "mock",
  },
  // ソング１つ
  {
    name: "dummy4",
    styles: [{ name: "style0", id: 9, type: "sing" }],
    speakerUuid: "b1a81618-b27b-40d2-b0ea-27a9ad408c4b",
    version: "mock",
  },
] satisfies Speaker[];

/** 全てのキャラクターを返すモック */
export function getCharactersMock(): Speaker[] {
  return baseCharactersMock;
}

/** 喋れるキャラクターを返すモック */
export function getSpeakersMock(): Speaker[] {
  return (
    baseCharactersMock
      // スタイルをトークのみに絞り込む
      .map((character) => ({
        ...character,
        styles: character.styles.filter(
          (style) => style.type == undefined || style.type == "talk",
        ),
      }))
      // １つもスタイルがないキャラクターを除外
      .filter((character) => character.styles.length > 0)
  );
}

/* 歌えるキャラクターを返すモック */
export function getSingersMock(): Speaker[] {
  return (
    baseCharactersMock
      // スタイルをソングのみに絞り込む
      .map((character) => ({
        ...character,
        styles: character.styles.filter(
          (style) => style.type == "frame_decode" || style.type == "sing",
        ),
      }))
      // １つもスタイルがないキャラクターを除外
      .filter((character) => character.styles.length > 0)
  );
}

/** キャラクターの追加情報を返すモック。 */
export async function getCharacterInfoMock(
  speakerUuid: string,
): Promise<SpeakerInfo> {
  // NOTE: 画像のURLを得るために必要
  const characterIndex = baseCharactersMock.findIndex(
    (speaker) => speaker.speakerUuid === speakerUuid,
  );
  if (characterIndex === -1) {
    throw new Error(`Character not found: ${speakerUuid}`);
  }

  const styleIds = baseCharactersMock[characterIndex].styles.map(
    (style) => style.id,
  );

  return {
    policy: `Dummy policy for ${speakerUuid}`,
    portrait: getPortraitUrl(characterIndex),
    styleInfos: await Promise.all(
      styleIds.map(async (id) => ({
        id,
        icon: getIconUrl(characterIndex),
        voiceSamples: [],
      })),
    ),
  };
}

/**
 * 喋れるキャラクターの追加情報を返すモック。
 * 本当は喋れるスタイルのみでフィルタリングすべき。
 */
export async function getSpeakerInfoMock(
  speakerUuid: string,
): Promise<SpeakerInfo> {
  return getCharacterInfoMock(speakerUuid);
}
