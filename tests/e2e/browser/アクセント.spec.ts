import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("アクセント分割したらアクセント区間が増える", async ({ page }) => {
  await navigateToMain(page);
  await expect(page.locator(".audio-cell").first()).toBeVisible();
  await page.locator(".audio-cell input").first().fill("こんにちは");
  await page.locator(".audio-cell input").first().press("Enter");
  await page.waitForTimeout(500);
  expect(await page.locator(".mora-table").count()).toBe(1);
  await (await page.locator(".splitter-cell").all())[1].click();
  await page.waitForTimeout(500);
  expect(await page.locator(".mora-table").count()).toBe(2);
});

test("アクセントの読み部分をクリックすると読みを変更できる", async ({
  page,
}) => {
  await navigateToMain(page);

  await page.getByRole("textbox", { name: "1行目" }).click();
  await page.getByRole("textbox", { name: "1行目" }).fill("テストです");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  await page.locator(".text-cell").first().waitFor();

  await expect(page.locator(".text-cell").first()).toBeVisible();
  await page.locator(".text-cell").first().click();
  const qMenu = page.locator(".q-menu > label > div > div > div");
  expect(await qMenu.first().inputValue()).toBe("テストデス");
  await qMenu.fill("テストテスト");
  expect(await qMenu.first().inputValue()).toBe("テストテスト");
});
