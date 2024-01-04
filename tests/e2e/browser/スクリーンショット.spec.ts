import path from "path";
import fs from "fs/promises";
import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import {
  Speaker,
  SpeakerFromJSON,
  SpeakerInfo,
  SpeakerInfoFromJSON,
  SpeakerInfoToJSON,
  SpeakerToJSON,
} from "@/openapi";

const characterInfoDir = path.resolve(
  __dirname,
  "..",
  "..",
  "..", // プロジェクトルート
  "build",
  "vendored",
  "voicevox_nemo_resource",
  "voicevox_nemo",
  "character_info"
);
let speakerImages: {
  portrait: string;
  icon: string;
}[];

/**
 * Voicevox Nemoで使われているアイコン・立ち絵を取得する。
 */
async function getSpeakerImages(): Promise<
  {
    portrait: string;
    icon: string;
  }[]
> {
  if (!speakerImages) {
    const characterInfos = await fs.readdir(characterInfoDir);

    // readdirの結果の順序に依存しないようにソートする。
    // 男声は入れない（女声の6種類で十分のはず）
    const femaleVoices = characterInfos.filter((characterInfo) =>
      characterInfo.startsWith("女声")
    );

    femaleVoices.sort((a, b) => parseInt(a[2]) - parseInt(b[2]));
    speakerImages = await Promise.all(
      femaleVoices.map(async (characterInfo) => {
        const characterInfoPath = path.join(characterInfoDir, characterInfo);
        const files = await fs.readdir(characterInfoPath);
        const portraitPath = files.find((image) =>
          image.startsWith("portrait")
        );
        const iconPath = await fs
          .readdir(path.join(characterInfoPath, "icons"))
          .then((files) => files[0]);
        if (!portraitPath || !iconPath) {
          throw new Error(`portraitPath=${portraitPath}, iconPath=${iconPath}`);
        }

        const portrait = await fs.readFile(
          path.join(characterInfoPath, portraitPath),
          "base64"
        );
        const icon = await fs.readFile(
          path.join(characterInfoPath, "icons", iconPath),
          "base64"
        );

        return { portrait, icon };
      })
    );
  }
  return speakerImages;
}

test.beforeEach(async ({ page }, testinfo) => {
  let speakers: Speaker[];
  // Playwrightはデフォルトでスクリーンショットのファイル名にOSを含める。
  // 色々な環境でスクリーンショットの更新を出来るようにするため、
  // この挙動を無効化する。
  // 参照： https://github.com/microsoft/playwright/issues/14218
  testinfo.snapshotSuffix = "";
  const speakerImages = await getSpeakerImages();
  // Voicevox Nemo EngineでもVoicevox Engineでも同じ結果が選られるように、
  // GET /speakers、GET /speaker_infoの話者名、スタイル名、画像を差し替える。
  await page.route(/\/speakers$/, async (route) => {
    const response = await route.fetch();
    const json: Speaker[] = await response
      .json()
      .then((json) => json.map(SpeakerFromJSON));
    let i = 0;
    for (const speaker of json) {
      i++;
      speaker.name = `Speaker ${i}`;
      let j = 0;
      for (const style of speaker.styles) {
        j++;
        style.name = `Style ${j}`;
      }
    }
    speakers = json;
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json.map(SpeakerToJSON)),
    });
  });
  await page.route(/\/speaker_info\?/, async (route) => {
    if (!speakers) {
      // Unreachableのはず
      throw new Error("speakers is not initialized");
    }
    const url = new URL(route.request().url());
    const speakerUuid = url.searchParams.get("speaker_uuid");
    if (!speakerUuid) {
      throw new Error("speaker_uuid is not set");
    }
    const response = await route.fetch();
    const json: SpeakerInfo = await response.json().then(SpeakerInfoFromJSON);
    const speakerIndex = speakers.findIndex(
      (speaker) => speaker.speakerUuid === speakerUuid
    );
    if (speakerIndex === -1) {
      throw new Error(`speaker_uuid=${speakerUuid} is not found`);
    }
    const image = speakerImages[speakerIndex % speakerImages.length];
    json.portrait = image.portrait;
    for (const style of json.styleInfos) {
      style.icon = image.icon;
      if ("portrait" in style) {
        delete style.portrait;
      }
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SpeakerInfoToJSON(json)),
    });
  });
});
test.beforeEach(gotoHome);

test("メイン画面の表示", async ({ page }) => {
  await navigateToMain(page);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await page.locator(".audio-cell:nth-child(1) .q-field").click();
    await page.waitForTimeout(100);
    if (
      (await page
        .locator(".character-portrait-wrapper .character-name")
        .innerText()) !== "（表示エラー）" &&
      (await page.locator(".character-portrait-wrapper .loading").count()) === 0
    ) {
      break;
    }
  }
  await expect(page).toHaveScreenshot();
});
