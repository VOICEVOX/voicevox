import { test } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("テキストを入力→アクセントを変更→音声合成→再生ができる", async ({
  page,
}) => {
  await navigateToMain(page);

  await page.getByRole("textbox", { name: "1行目" }).click();
  await page.getByRole("textbox", { name: "1行目" }).fill("テストです");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  await page.waitForTimeout(1000);

  await page
    .locator(
      ".accent-slider-cell > div > div > .q-slider > .q-slider__track-container"
    ) //FIXME: 良くないセレクタを直す
    .click();
  await page.waitForTimeout(1000);

  await page.getByRole("button").filter({ hasText: "play_arrow" }).click();
  await page.waitForTimeout(5000);

  //FIXME: 本当に音声が再生できているか確かめる
});
