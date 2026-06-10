import { test, expect, type Locator } from "@playwright/test";

import { gotoHome, navigateToMain, toggleSetting } from "../navigators";

test.beforeEach(gotoHome);

async function validateValue(locator: Locator, expectedValue: string) {
  const value = await locator.evaluate((e: HTMLInputElement) => e.value);
  expect(value).toBe(expectedValue);
}

test("音声パラメータ引き継ぎの設定", async ({ page }) => {
  await navigateToMain(page);

  const inputTag = page.locator(".parameters .q-field__native").first();

  await test.step("パラメータ入力欄を表示する", async () => {
    await page.waitForTimeout(100);
    await page.locator(".audio-cell input").first().press("Enter");
    await page.waitForTimeout(100);
    await expect(inputTag).toBeVisible();
  });

  await test.step("パラメータの値を変更する", async () => {
    await validateValue(inputTag, "1.00");
    await inputTag.evaluate((e: HTMLInputElement) => {
      e.value = "0.50";
      e.dispatchEvent(new Event("change"));
    });
    await validateValue(inputTag, "0.50");
  });

  await test.step("テキストを追加するとパラメータが引き継がれる", async () => {
    await page.getByRole("button").filter({ hasText: "add" }).click();
    await validateValue(inputTag, "0.50");
  });

  await toggleSetting(page, "パラメータの引き継ぎ");

  await test.step("引き継ぎ設定オフ時はデフォルト値になる", async () => {
    await page.locator(".audio-cell input").first().click();
    await page.getByRole("button").filter({ hasText: "add" }).click();
    await inputTag.waitFor();
    await validateValue(inputTag, "1.00");
  });

  await test.step("スライダーからパラメータを変更する", async () => {
    const sliderThumbBox = await page
      .locator(".q-slider__thumb")
      .first()
      .boundingBox();
    if (!sliderThumbBox) throw new Error("sliderThumbBox is null");
    const sliderBox = await page.locator(".q-slider").first().boundingBox();
    if (!sliderBox) throw new Error("sliderBox is null");
    await page.mouse.move(
      sliderThumbBox.x + sliderThumbBox.width / 2,
      sliderThumbBox.y + sliderThumbBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sliderBox.x + sliderBox.width,
      sliderBox.y + sliderBox.height / 2,
    );
    await page.waitForTimeout(100);
    await validateValue(inputTag, "2.00");
  });
});
