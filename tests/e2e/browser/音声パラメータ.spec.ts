import { test, expect, Locator } from "@playwright/test";

import { gotoHome, navigateToMain, toggleSetting } from "../navigators";

test.beforeEach(gotoHome);

async function validateValue(locator: Locator, expectedValue: string) {
  const value = await locator.evaluate((e: HTMLInputElement) => e.value);
  expect(value).toBe(expectedValue);
}

test("音声パラメータ引き継ぎの設定", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.locator(".audio-cell input").first().press("Enter");
  await page.waitForTimeout(100);
  const inputTag = page.locator(".parameters .q-field__native").first();
  await expect(inputTag).toBeVisible();

  // 数値を変更し、変わるかどうかを確認
  await validateValue(inputTag, "1.00");
  await inputTag.evaluate((e: HTMLInputElement) => {
    e.value = "0.50";
    e.dispatchEvent(new Event("change"));
  });
  await validateValue(inputTag, "0.50");

  // パラメータ引き継ぎは自動的にオンなので、パラメータ引き継ぎがされるかどうかを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await validateValue(inputTag, "0.50");

  await toggleSetting(page, "パラメータの引き継ぎ");

  // パラメータを引き継がないことの確認
  await page.locator(".audio-cell input").first().click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await inputTag.waitFor();
  await validateValue(inputTag, "1.00");

  // スライダーからパラメータの変更ができるかどうかを確認
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
