/**
 * 話者情報を作るモック。
 * なんとなくENGINEのモックと揃えている。
 */

import { Speaker, SpeakerInfo } from "@/openapi";

/** 話者を返すモック */
export function getSpeakersMock(): Speaker[] {
  return [
    // トーク２つ
    {
      name: "dummy1",
      styles: [
        { name: "style0", id: 0 },
        { name: "style1", id: 2 },
      ],
      speakerUuid: "7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff",
      version: "mock",
    },
    // トーク２つ
    {
      name: "dummy2",
      styles: [
        { name: "style0", id: 1 },
        { name: "style1", id: 3 },
      ],
      speakerUuid: "388f246b-8c41-4ac1-8e2d-5d79f3ff56d9",
      version: "mock",
    },
    // トーク１つ
    {
      name: "dummy3",
      styles: [{ name: "style0", id: 8 }],
      speakerUuid: "35b2c544-660e-401e-b503-0e14c635303a",
      version: "mock",
    },
  ];
}

/** 話者の追加情報を返すモック。 */
export function getSpeakerInfoMock(
  speakerUuid: string,
  assetsDir: string,
): SpeakerInfo {
  const speakers = getSpeakersMock();

  // NOTE: 画像のURLを得るために必要
  const speakerIndex = speakers.findIndex(
    (speaker) => speaker.speakerUuid === speakerUuid,
  );
  if (speakerIndex === -1) {
    throw new Error(`Speaker not found: ${speakerUuid}`);
  }

  const styleIds = speakers[speakerIndex].styles.map((style) => style.id);

  return {
    policy: `Dummy policy for ${speakerUuid}`,
    portrait: `${assetsDir}/portrait_${speakerIndex + 1}.png`,
    styleInfos: styleIds.map((id) => {
      return {
        id,
        icon: `${assetsDir}/icon_${speakerIndex + 1}.png`,
        voiceSamples: [],
      };
    }),
  };
}
