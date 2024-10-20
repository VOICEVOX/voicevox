/**
 * キャラクター情報を作るモック。
 * なんとなくVOICEVOX ENGINEリポジトリのモック実装と揃えている。
 */

import { assetsPath } from "./constants";
import { Speaker, SpeakerInfo } from "@/openapi";

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
export function getCharacterInfoMock(speakerUuid: string): SpeakerInfo {
  // NOTE: 画像のURLを得るために必要
  const speakerIndex = baseCharactersMock.findIndex(
    (speaker) => speaker.speakerUuid === speakerUuid,
  );
  if (speakerIndex === -1) {
    throw new Error(`Speaker not found: ${speakerUuid}`);
  }

  const styleIds = baseCharactersMock[speakerIndex].styles.map(
    (style) => style.id,
  );

  return {
    policy: `Dummy policy for ${speakerUuid}`,
    portrait: `${assetsPath}/portrait_${speakerIndex + 1}.png`,
    styleInfos: styleIds.map((id) => {
      return {
        id,
        icon: `${assetsPath}/icon_${speakerIndex + 1}.png`,
        voiceSamples: [],
      };
    }),
  };
}

/** 喋れるキャラクターの追加情報を返すモック */
export function getSpeakerInfoMock(speakerUuid: string): SpeakerInfo {
  return getCharacterInfoMock(speakerUuid);
}
