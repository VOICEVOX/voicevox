import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("アクセント分割したらアクセント区間が増える", async ({ page }) => {
  await navigateToMain(page);
  await expect(page.locator(".audio-cell").first()).toBeVisible();
  await page.locator(".audio-cell input").first().fill("こんにちは");
  await page.locator(".audio-cell input").first().press("Enter");
  await page.waitForTimeout(500);
  expect(await page.locator(".accent-phrase").count()).toBe(1);
  await (await page.locator(".splitter-cell").all())[1].click();
  await page.waitForTimeout(500);
  expect(await page.locator(".accent-phrase").count()).toBe(2);
});

test("分割したアクセント区間を結合できる", async ({ page }) => {
  await navigateToMain(page);

  const accentPhrases = page.locator(".accent-phrase");

  await test.step("アクセント区間を表示する", async () => {
    const input = page.locator(".audio-cell input").first();
    await input.fill("こんにちは");
    await input.press("Enter");
    await expect(accentPhrases).toHaveCount(1);
  });

  await test.step("アクセント区間を分割する", async () => {
    await page.locator(".splitter-cell").nth(1).click();
    await expect(accentPhrases).toHaveCount(2);
  });

  await test.step("分割したアクセント区間を結合する", async () => {
    await accentPhrases.first().locator(".splitter-cell").last().click();
    await expect(accentPhrases).toHaveCount(1);
  });
});

test("アクセントの読み部分をクリックすると読みを変更できる", async ({
  page,
}) => {
  await navigateToMain(page);

  await page.getByRole("textbox", { name: "1行目" }).click();
  await page.getByRole("textbox", { name: "1行目" }).fill("テストです");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  const accentPhrase = page.locator(".accent-phrase");
  await expect(accentPhrase).toHaveText("テストデス");

  await expect(page.locator(".text-cell").first()).toBeVisible();
  await page.locator(".text-cell").first().click();
  const input = page.getByLabel("1番目のアクセント区間の読み");
  expect(await input.inputValue()).toBe("テストデス");
  await input.fill("テストテスト");
  await input.press("Enter");
  await expect(accentPhrase).toHaveText("テストテスト");
});
