import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});
/*
 * イントネーションのスライダーの値をnumber[][]として取得する
 * @param page
 */
async function getSliderValues(page: Page) {
  const moraTables = await page.locator(".mora-table").all();
  return await Promise.all(
    moraTables.map(async (moraTable) => {
      const sliders = await moraTable.locator(".q-slider").all();
      return await Promise.all(
        sliders.map(async (slider) => {
          const value = await slider.getAttribute("aria-valuenow");
          if (value == null) {
            throw new Error("aria-valuenowが取得できません");
          }
          return parseFloat(value);
        })
      );
    })
  );
}

test("実験的機能：調整結果の保持", async ({ page }) => {
  await navigateToMain(page);

  await toggleSetting(page, "調整結果の保持");
  await page.waitForTimeout(100);

  const audioCell = page.locator(".audio-cell:nth-child(1)");
  await audioCell.locator("input").fill("ずんだもんの朝食");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);

  await page.locator(".detail-selector").getByText("ｲﾝﾄﾈｰｼｮﾝ").click();
  await page.waitForTimeout(100);

  const sliders = await page
    .locator(".pitch-cell .q-slider .q-slider__track")
    .all();
  for (const slider of sliders) {
    await slider.click({ position: { x: 0, y: 0 }, force: true });
  }
  await page.waitForTimeout(100);

  // 確認
  let sliderValues;
  sliderValues = await getSliderValues(page);
  expect(sliderValues).toEqual([
    // ズ ン ダ モ ン ノ
    [6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
    // チョ ウ ショ ク
    [6.5, 6.5, 6.5, 6.5],
  ]);

  // 句読点（pauseMora）だけの変更：句読点部分以外は変わらない
  await audioCell.locator("input").clear();
  await audioCell.locator("input").fill("ずんだもんの、朝食");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  sliderValues = await getSliderValues(page);
  expect(sliderValues).toEqual([
    // ズ ン ダ モ ン ノ （、）
    [6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
    // チョ ウ ショ ク
    [6.5, 6.5, 6.5, 6.5],
  ]);
  const firstAccentPhrase = page.locator(".mora-table").first();
  expect(firstAccentPhrase.getByText("、").isVisible()).toBeTruthy();

  // 一部のアクセント句のみ変更：他のアクセント句は変わらない
  await audioCell.locator("input").clear();
  await audioCell.locator("input").fill("ずんだもんの、夕食");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  sliderValues = await getSliderValues(page);
  expect(sliderValues[0]).toEqual([
    // ズ ン ダ モ ン ノ （、）
    6.5, 6.5, 6.5, 6.5, 6.5, 6.5,
  ]);
  // 変化することを確認
  expect(sliderValues[1]).not.toEqual([6.5, 6.5, 6.5, 6.5]);
});
