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

let speakerImages: {
  portrait: string;
  icon: string;
}[];

/**
 * 差し替え用の立ち絵・アイコンを取得する。
 */
async function getSpeakerImages(): Promise<
  {
    portrait: string;
    icon: string;
  }[]
> {
  if (!speakerImages) {
    const assetsPath = path.resolve(__dirname, "assets");
    const images = await fs.readdir(assetsPath);
    const icons = images.filter((image) => image.startsWith("icon"));
    icons.sort(
      (a, b) =>
        parseInt(a.split(".")[0].split("_")[1]) -
        parseInt(b.split(".")[0].split("_")[1])
    );
    speakerImages = await Promise.all(
      icons.map(async (iconPath) => {
        const portraitPath = iconPath.replace("icon_", "portrait_");
        const portrait = await fs.readFile(
          path.join(assetsPath, portraitPath),
          "base64"
        );
        const icon = await fs.readFile(
          path.join(assetsPath, iconPath),
          "base64"
        );

        return { portrait, icon };
      })
    );
  }
  return speakerImages;
}

test.beforeEach(async ({ page }) => {
  let speakers: Speaker[];
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
        style.name = `Style ${i}-${j}`;
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
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");
  await navigateToMain(page);

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
  await expect(page).toHaveScreenshot("メイン画面.png");
});
