import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain, gotoHome } from "../../navigators";
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

/*
 * AudioInfoのパラメーターを取得する。
 * @returns パラメーター名と値のマップ
 */
async function getAudioInfoParameters(
  page: Page,
): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const result: Record<string, number> = {};
    const audioInfo = document.querySelector("[data-testid='AudioInfo']");
    if (!audioInfo) {
      throw new Error("AudioInfoがありません");
    }

    const parameters = audioInfo.querySelectorAll(".parameters > div");
    for (const parameter of parameters) {
      const input = parameter.querySelector<HTMLInputElement>(
        "label input[type=text]",
      );
      if (!input) {
        throw new Error("inputがありません");
      }

      const value = input.value;
      if (!value) {
        throw new Error("value属性がありません");
      }

      const label = parameter.querySelector("label")?.textContent;
      if (!label) {
        throw new Error("labelがありません");
      }

      result[label] = parseFloat(value);
    }
    return result;
  });
}

test.beforeEach(async ({ page }) => {
  await gotoHome({ page });

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

  await page
    .locator(".character-item-container > .q-item:nth-child(2)")
    .click();
  await page.waitForTimeout(200);

  const characterNames = await getSelectedCharacters(page);

  expect(characterNames[0]).not.toEqual(characterNames[1]);
  expect(characterNames[1]).toEqual(characterNames[2]);
  expect(characterNames[1]).toEqual(characterNames[3]);
});

test("複数選択：AudioInfo操作", async ({ page }) => {
  await page.locator(".audio-cell:nth-child(1)").click();
  await page.waitForTimeout(100);

  const beforeParameters = await getAudioInfoParameters(page);

  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  const audioInfo = page.getByTestId("AudioInfo");
  const parameters = await audioInfo.locator(".parameters > div").all();

  for (const parameter of parameters) {
    const input = parameter.locator("label input");
    if (await input.isDisabled()) continue;
    await input.fill("2");
    await page.waitForTimeout(100);
  }

  // 選択中の他のAudioCellのパラメーターも変更されていることを確認する
  await page.locator(".audio-cell:nth-child(3)").click();

  const afterParameters = await getAudioInfoParameters(page);

  expect(beforeParameters).not.toEqual(afterParameters);

  // 選択外のAudioCellのパラメーターは変更されていないことを確認する
  await page.locator(".audio-cell:nth-child(1)").click();

  const beforeParameters2 = await getAudioInfoParameters(page);

  expect(beforeParameters).toEqual(beforeParameters2);
});
