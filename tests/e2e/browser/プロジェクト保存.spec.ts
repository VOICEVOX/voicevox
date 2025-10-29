import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";
import { mockShowSaveFileDialog, mockWriteFile } from "./mockUtility";
import { fillAudioCell, waitForUiUnlock } from "./utils";

test.beforeEach(gotoHome);

test("無保存状態から最初に保存したときにダイアログが表示されない", async ({
  page,
}) => {
  await navigateToMain(page);

  await test.step("テキスト欄にテキストを入力", async () => {
    await fillAudioCell(page, 0, "こんにちは");
  });

  await test.step("保存ダイアログのモックを設定", async () => {
    await mockShowSaveFileDialog(page);
    await mockWriteFile(page);
  });

  await test.step("プロジェクトを名前を付けて保存", async () => {
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを名前を付けて保存").click();
  });

  await test.step("「プロジェクトが切り替わりました」ダイアログが表示されないことを確認", async () => {
    const dialog = page.getByRole("dialog", {
      name: "保存",
    });
    // ダイアログが存在しない、または非表示であることを確認
    await expect(dialog).not.toBeVisible({ timeout: 1000 });
  });
});

test("既存プロジェクトを別名で保存したときにダイアログが表示される", async ({
  page,
}) => {
  await navigateToMain(page);

  await test.step("テキスト欄にテキストを入力", async () => {
    await fillAudioCell(page, 0, "こんにちは");
  });

  await test.step("最初の保存", async () => {
    await mockShowSaveFileDialog(page);
    await mockWriteFile(page);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを名前を付けて保存").click();
    await waitForUiUnlock(page);
  });

  await test.step("2回目の保存ダイアログのモックを設定", async () => {
    await mockShowSaveFileDialog(page);
    await mockWriteFile(page);
  });

  await test.step("プロジェクトを別名で保存", async () => {
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを名前を付けて保存").click();
  });

  await test.step("「プロジェクトが切り替わりました」ダイアログが表示されることを確認", async () => {
    const dialog = page.getByRole("dialog", { name: "保存" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/編集中のプロジェクトが .* に切り替わりました。/),
    ).toBeVisible();

    // ダイアログを閉じる
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(dialog).not.toBeVisible();
  });
});
