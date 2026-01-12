import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain, gotoHome } from "../navigators";

test.beforeEach(gotoHome);

/**
 * イントネーションのスライダーの値をnumber[][]として取得する
 * @param page
 */
async function getSliderValues(page: Page) {
  const moraTables = await page.locator(".accent-phrase").all();
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
        }),
      );
    }),
  );
}

test("実験的機能：調整結果の保持", async ({ page }) => {
  await navigateToMain(page);

  const audioCell = page.locator(".audio-cell:nth-child(1)");
  const firstAccentPhrase = page.locator(".accent-phrase").first();

  await test.step("調整結果の保持を有効にする", async () => {
    await toggleSetting(page, "調整結果の保持");
    await page.waitForTimeout(100);
  });

  await test.step("テキストを入力する", async () => {
    await audioCell.locator("input").fill("ずんだもんの朝食");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
  });

  await test.step("イントネーションを表示してスライダーを全て最小値にする", async () => {
    await page.locator(".detail-selector").getByText("ｲﾝﾄﾈｰｼｮﾝ").click();
    await page.waitForTimeout(100);

    const sliders = await page
      .locator(".pitch-cell .q-slider .q-slider__track")
      .all();
    for (const slider of sliders) {
      await slider.click({ position: { x: 0, y: 0 }, force: true });
    }
    await page.waitForTimeout(100);

    const sliderValues = await getSliderValues(page);
    expect(sliderValues).toEqual([
      // ズ ン ダ モ ン ノ
      [6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
      // チョ ウ ショ ク
      [6.5, 6.5, 6.5, 6.5],
    ]);
  });

  await test.step("句読点を追加しても他のスライダー値は保持される", async () => {
    await audioCell.locator("input").clear();
    await audioCell.locator("input").fill("ずんだもんの、朝食");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);

    const sliderValues = await getSliderValues(page);
    expect(sliderValues).toEqual([
      // ズ ン ダ モ ン ノ （、）
      [6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
      // チョ ウ ショ ク
      [6.5, 6.5, 6.5, 6.5],
    ]);
    await expect(firstAccentPhrase.getByText("、")).toBeVisible();
  });

  await test.step("句読点を削除しても他のスライダー値は保持される", async () => {
    await audioCell.locator("input").clear();
    await audioCell.locator("input").fill("ずんだもんの朝食");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);

    const sliderValues = await getSliderValues(page);
    expect(sliderValues).toEqual([
      // ズ ン ダ モ ン ノ
      [6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
      // チョ ウ ショ ク
      [6.5, 6.5, 6.5, 6.5],
    ]);
    await expect(firstAccentPhrase.getByText("、")).not.toBeVisible();
  });

  await test.step("一部のアクセント句を変更しても他は保持される", async () => {
    await audioCell.locator("input").clear();
    await audioCell.locator("input").fill("ずんだもんの夕食");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);

    const sliderValues = await getSliderValues(page);
    expect(sliderValues[0]).toEqual([
      // ズ ン ダ モ ン ノ
      6.5, 6.5, 6.5, 6.5, 6.5, 6.5,
    ]);
    expect(sliderValues[1]).not.toEqual([6.5, 6.5, 6.5, 6.5]);
  });
});
