import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain } from "../../navigators";
import { addAudioCells } from "./utils";

/*
 * 全てのAudioCellのキャラクター+スタイル名を取得する。
 * キャラクター+スタイル名はalt属性から取得する。
 *
 * @returns キャラクター名の配列
 */
async function getSelectedCharacters(page: Page): Promise<string[]> {
  const characterNames = await page.evaluate(() => {
    const audioCells = [...document.querySelectorAll(".audio-cell")];
    const characterNames: string[] = [];
    for (const audioCell of audioCells) {
      const character = audioCell.querySelector(".icon-container > img");
      if (character) {
        const alt = character.getAttribute("alt");
        if (!alt) {
          throw new Error("alt属性がありません");
        }

        characterNames.push(alt);
      }
    }
    return characterNames;
  });
  return characterNames;
}

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);

  await navigateToMain(page);
  await page.waitForTimeout(100);
  await toggleSetting(page, "複数選択");

  await addAudioCells(page, 3);
});

test("複数選択：キャラクター選択", async ({ page }) => {
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  await page.locator(".audio-cell:nth-child(2) .character-button").click();
  await page.waitForTimeout(100);

  await page.locator(".character-item-container .q-item:nth-child(2)").click();
  await page.waitForTimeout(100);

  const characterNames = await getSelectedCharacters(page);

  expect(characterNames[0]).not.toEqual(characterNames[1]);
  expect(characterNames[1]).toEqual(characterNames[2]);
  expect(characterNames[1]).toEqual(characterNames[3]);
});
