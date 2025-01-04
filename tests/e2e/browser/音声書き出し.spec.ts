import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";

// 書き出し先用のディレクトリを作る
let tempDir: string;
test.beforeAll(async () => {
  tempDir = fs.mkdtempSync(os.tmpdir() + "/");
});
test.afterAll(async () => {
  fs.rmSync(tempDir, { recursive: true });
});

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
    const fileChooserPromise = page.waitForEvent("filechooser");

    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "選択音声を書き出し").click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(tempDir, "output.wav"));
  });
});
