import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";
import { mockShowSaveFileDialog, mockWriteFile } from "./mockUtility";

test.beforeEach(gotoHome);

test("プロジェクトファイル切り替わり案内ダイアログ", async ({ page }) => {
  await navigateToMain(page);

  const dialog = page.getByRole("dialog").filter({
    hasText: /編集中のプロジェクトが .* に切り替わりました。/,
  });

  await test.step("プロジェクトを保存", async () => {
    await mockShowSaveFileDialog(page);
    await mockWriteFile(page);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを名前を付けて保存").click();
  });

  await test.step("ダイアログが表示されないことを確認", async () => {
    await expect(dialog).not.toBeVisible({ timeout: 1000 });
  });

  await test.step("プロジェクトを別名で保存", async () => {
    await mockShowSaveFileDialog(page);
    await mockWriteFile(page);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを名前を付けて保存").click();
  });

  await test.step("ダイアログが表示されることを確認", async () => {
    await expect(dialog).toBeVisible();
  });
});
