import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

type Box = {
  width: number;
  height: number;
  x: number;
  y: number;
};

test("音声パラメータ引き継ぎの設定", async ({ page }) => {
  await navigateToMain(page);
  await page.locator(".audio-cell input").first().press("Enter");
  await expect(
    page.locator(".parameters .q-slider__thumb").first()
  ).toBeVisible();

  // まずはsliderを動かす
  const thumbBoxBeforeMove: Box = (await page
    .locator(".parameters .q-slider__thumb")
    .first()
    .boundingBox()) || { width: 0, height: 0, x: 0, y: 0 };

  const trackBox: Box = (await page
    .locator(".parameters .q-slider__track")
    .first()
    .boundingBox()) || { width: 0, height: 0, x: 0, y: 0 };

  await page.mouse.move(
    thumbBoxBeforeMove.x + thumbBoxBeforeMove.width / 2,
    thumbBoxBeforeMove.y + thumbBoxBeforeMove.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(trackBox.x, trackBox.y + trackBox.height / 2);
  await page.mouse.up();

  const thumbBoxAfterMove: Box = (await page
    .locator(".parameters .q-slider__thumb")
    .first()
    .boundingBox()) || { width: 0, height: 0, x: 0, y: 0 };
  // sliderが動いてることを確認
  expect(thumbBoxBeforeMove.x).not.toBe(0);
  expect(thumbBoxBeforeMove.x).not.toBe(thumbBoxAfterMove.x);
  expect(thumbBoxAfterMove.x).not.toBe(0);

  // audio-cellを追加してもパラメータが引き継がれてることを確認
  await page.locator(".add-button-wrapper button").click();
  const thumbBoxAfterAddOnce = (await page
    .locator(".parameters .q-slider__thumb")
    .first()
    .boundingBox()) || { width: 0, height: 0, x: 0, y: 0 };
  expect(thumbBoxAfterAddOnce.x).toBe(thumbBoxAfterMove.x);

  // パラメータの引き継ぎをオフにして設定用画面を閉じる
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByText("オプション").click();
  await page
    .locator(".q-card__actions")
    .filter({ hasText: "パラメータの引き継ぎ" })
    .getByRole("switch")
    .click();

  await page
    .locator("#q-portal--dialog--6")
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();

  // スライダーを移動させてパラメータが引き継がれないことを確認
  await page.locator(".audio-cell input").first().focus();
  await page.locator(".add-button-wrapper button").click();

  const thumbBoxAfterOffParam = (await page
    .locator(".parameters .q-slider__thumb")
    .first()
    .boundingBox()) || { width: 0, height: 0, x: 0, y: 0 };
  expect(thumbBoxAfterOffParam.x).not.toBe(thumbBoxAfterAddOnce.x);
});
