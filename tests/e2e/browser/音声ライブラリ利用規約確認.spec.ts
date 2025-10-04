import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu, getNewestQuasarDialog } from "../locators";
import {
  mockShowSaveFileDialog,
  mockWriteFile,
  mockShowSaveDirectoryDialog,
} from "./mockUtility";
import {
  addAudioCells,
  fillAudioCell,
  changeAudioCellCharacter,
  waitForExportNotificationAndClose,
} from "./utils";

test.beforeEach(gotoHome);

test.describe("音声ライブラリ利用規約確認", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMain(page);

    await test.step("テキスト欄にテキストを入力", async () => {
      await fillAudioCell(page, 0, "1番目のテキスト");
    });
  });

  test("音声ライブラリ利用規約ダイアログの表示", async ({ page }) => {
    // 1つのキャラクターでのテスト：
    // * 書き出し時に利用規約が表示される
    // * キャンセル後、再度書き出しすると利用規約が再表示される
    // * 確認後、再度書き出しでは利用規約が表示されない
    //
    // 複数キャラクターでのテスト：
    // * 3人のキャラクターで書き出し時、未確認の2人分の利用規約のみ表示
    // * 確認後、再度3人で書き出しでは何も表示されない
    await test.step("1つのキャラクターで書き出し時に利用規約が表示される", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      const dialog = getNewestQuasarDialog(page);
      await expect(
        dialog.getByText("音声ライブラリ利用規約のご案内"),
      ).toBeVisible();

      // 1つのキャラクターの利用規約が表示されることを確認
      const characterPolicies = dialog.getByRole("listitem");
      await expect(characterPolicies).toHaveCount(1);
    });

    await test.step("キャンセルボタンを押すとダイアログが閉じる", async () => {
      const dialog = getNewestQuasarDialog(page);
      await dialog.getByRole("button", { name: "キャンセル" }).click();
      await expect(dialog).not.toBeVisible();
    });

    await test.step("再度書き出しを試行すると利用規約が再び表示される", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      const dialog = getNewestQuasarDialog(page);
      await expect(
        dialog.getByText("音声ライブラリ利用規約のご案内"),
      ).toBeVisible();

      // 1つのキャラクターの利用規約が表示されることを確認
      const characterPolicies = dialog.getByRole("listitem");
      await expect(characterPolicies).toHaveCount(1);
    });

    await test.step("確認ボタンを押すと書き出しが実行される", async () => {
      const dialog = getNewestQuasarDialog(page);
      await dialog.getByRole("button", { name: "確認して続行" }).click();
      await expect(dialog).not.toBeVisible();

      await waitForExportNotificationAndClose(page);
    });

    await test.step("確認済みキャラクターでは利用規約が表示されない", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      // 利用規約ダイアログが表示されないことを確認
      await page.waitForTimeout(500);
      const policyDialog = page.getByText("音声ライブラリ利用規約のご案内");
      await expect(policyDialog).not.toBeVisible();

      await waitForExportNotificationAndClose(page);
    });

    await test.step("キャラクターを2人追加してテキストを入力", async () => {
      await addAudioCells(page, 2);
      await fillAudioCell(page, 1, "2番目のテキスト");
      await changeAudioCellCharacter(page, 2, 2);
      await fillAudioCell(page, 2, "3番目のテキスト");
      await changeAudioCellCharacter(page, 3, 3);
    });

    await test.step("3人のキャラクターを選択", async () => {
      // 複数選択
      await page.locator(".audio-cell:nth-child(1)").click();
      await page.keyboard.down("Shift");
      await page.locator(".audio-cell:nth-child(3)").click();
      await page.keyboard.up("Shift");
    });

    await test.step("3人選択して書き出し時にキャラクター2と3の利用規約のみ表示される", async () => {
      await mockShowSaveDirectoryDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      const dialog = getNewestQuasarDialog(page);
      await expect(
        dialog.getByText("音声ライブラリ利用規約のご案内"),
      ).toBeVisible();

      // 2つのキャラクターの利用規約が表示されることを確認
      const characterPolicies = dialog.getByRole("listitem");
      await expect(characterPolicies).toHaveCount(2);
    });

    await test.step("確認ボタンを押すと複数音声の書き出しが実行される", async () => {
      const dialog = getNewestQuasarDialog(page);
      await dialog.getByRole("button", { name: "確認して続行" }).click();
      await expect(dialog).not.toBeVisible();

      await waitForExportNotificationAndClose(page);
    });

    await test.step("再度3人のキャラクターを選択", async () => {
      // 複数選択
      await page.locator(".audio-cell:nth-child(1)").click();
      await page.keyboard.down("Shift");
      await page.locator(".audio-cell:nth-child(3)").click();
      await page.keyboard.up("Shift");
    });

    await test.step("全キャラクター確認済みでは利用規約が表示されない", async () => {
      await mockShowSaveDirectoryDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      // 利用規約ダイアログが表示されないことを確認
      await page.waitForTimeout(500);
      const policyDialog = page.getByText("音声ライブラリ利用規約のご案内");
      await expect(policyDialog).not.toBeVisible();

      await waitForExportNotificationAndClose(page);
    });
  });
});
