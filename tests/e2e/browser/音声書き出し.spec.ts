import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";

test.beforeEach(gotoHome);

test.describe("音声書き出し", () => {
  test.beforeEach(async ({ page }) => {
    // テキスト欄を適当に３行ほど埋める
    await navigateToMain(page);

    const accentPhrase = page.locator(".accent-phrase");

    await page.getByRole("textbox", { name: "1行目" }).click();
    await page.getByRole("textbox", { name: "1行目" }).fill("１行目");
    await page.getByRole("textbox", { name: "1行目" }).press("Enter");
    await expect(accentPhrase).not.toHaveCount(0);

    await page.getByRole("button").filter({ hasText: "add" }).click();
    await page.getByRole("textbox", { name: "2行目" }).click();
    await page.getByRole("textbox", { name: "2行目" }).fill("２行目");
    await page.getByRole("textbox", { name: "2行目" }).press("Enter");
    await expect(accentPhrase).not.toHaveCount(0);

    await page.getByRole("button").filter({ hasText: "add" }).click();
    await page.getByRole("textbox", { name: "3行目" }).click();
    await page.getByRole("textbox", { name: "3行目" }).fill("３行目");
    await page.getByRole("textbox", { name: "3行目" }).press("Enter");
    await expect(accentPhrase).not.toHaveCount(0);
  });

  test("選択中の音声を書き出し", async ({ page }) => {
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "選択音声を書き出し").click();

    // FileChooserでいけるかも
    // https://playwright.dev/docs/api/class-filechooser
  });
});
