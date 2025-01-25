import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";
import { mockShowExportFileDialog, mockWriteFile } from "./helper";

test.beforeEach(gotoHome);

test.describe("音声書き出し", () => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");
  test.beforeEach(async ({ page }) => {
    await navigateToMain(page);

    const audioCell = page.getByRole("textbox", { name: "1行目" });
    const accentPhrase = page.locator(".accent-phrase");

    await audioCell.click();
    await audioCell.fill("こんにちは、これはテスト音声です");
    await audioCell.press("Enter");
    await expect(accentPhrase).not.toHaveCount(0);
  });

  test("デフォルト", async ({ page }, { title }) => {
    const { getFileIds } = await mockShowExportFileDialog(page);
    const { getWritedFileBuffers } = await mockWriteFile(page);

    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "選択音声を書き出し").click();
    await expect(page.getByText("音声を書き出しました")).toBeVisible();

    const fileId = (await getFileIds())[0];
    const buffer = (await getWritedFileBuffers())[fileId];
    expect(buffer).toMatchSnapshot(`${title}.wav`);
  });
});
