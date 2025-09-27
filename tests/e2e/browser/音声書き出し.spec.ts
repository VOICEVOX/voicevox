import { test, expect, Page } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu, getNewestQuasarDialog } from "../locators";
import {
  mockShowSaveFileDialog,
  mockWriteFile,
  mockShowSaveDirectoryDialog,
  mockWriteFileError,
} from "./mockUtility";
import { addAudioCells, fillAudioCell, ctrlLike } from "./utils";

test.beforeEach(gotoHome);

/** 書き出し完了の通知を確認して閉じる */
async function waitForExportNotificationAndClose(page: Page) {
  await test.step("書き出し完了の通知を確認して閉じる", async () => {
    // NOTE: なぜか前のnotifyの結果残ってしまっているので、.last()を使う
    const notify = page.locator("#q-notify").last();
    await expect(notify.getByText("音声を書き出しました").last()).toBeVisible();
    await notify.getByRole("button", { name: "閉じる" }).last().click();
    await expect(notify).not.toBeVisible();
  });
}

async function exportSelectedAudioAndSnapshot(page: Page, name: string) {
  const { getFileIds } = await mockShowSaveFileDialog(page);
  const { getWrittenFileBuffers } = await mockWriteFile(page);

  await test.step("選択音声を書き出す", async () => {
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "選択音声を書き出し").click();
  });

  await waitForExportNotificationAndClose(page);

  await test.step("音声ファイルのバイナリをスナップショット", async () => {
    const fileId = (await getFileIds())[0];
    const buffer = (await getWrittenFileBuffers())[fileId];
    expect(buffer).toMatchSnapshot(`${name}.wav`);
  });
}

async function changeAudioCellCharacter(
  page: Page,
  nthChild: number,
  digit: number,
) {
  await test.step(`${nthChild}人目のキャラクターを変更`, async () => {
    const audioCell = page.locator(`.audio-cell:nth-child(${nthChild})`);
    await audioCell.click();
    await page.keyboard.press(`${ctrlLike}+Digit${digit}`);
  });
}

test.describe("音声書き出し", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMain(page);

    await test.step("テキスト欄にテキストを入力", async () => {
      const audioCell = page.getByRole("textbox", { name: "1行目" });
      const accentPhrase = page.locator(".accent-phrase");

      await audioCell.click();
      await audioCell.fill("こんにちは、テストです");
      await audioCell.press("Enter");
      await expect(accentPhrase).not.toHaveCount(0);
    });
  });

  test("各パラメータを変更して音声書き出し", async ({ page }) => {
    test.skip(process.platform !== "win32", "Windows以外のためスキップします"); // NOTE: 音声スナップショットが完全一致しないため
    await exportSelectedAudioAndSnapshot(page, "デフォルト");

    const parameters = [
      ["話速", "1.5"],
      ["音高", "0.5"],
      ["抑揚", "1.5"],
      ["音量", "1.5"],
      ["間の長さ", "1.5"],
      ["開始無音", "0.3"],
      ["終了無音", "0.3"],
    ] as const;

    for (const [name, newValue] of parameters) {
      await test.step(`${name}変更`, async () => {
        const input = page.getByLabel(name);
        const originalValue = await input.inputValue();

        await test.step("パラメータを変更", async () => {
          await input.fill(newValue);
          await input.press("Enter");
        });

        await exportSelectedAudioAndSnapshot(page, `${name}変更`);

        await test.step("元の値に戻す", async () => {
          await input.fill(originalValue);
          await input.press("Enter");
        });
      });
    }
  });

  test("選択音声の書き出しでエラーダイアログが表示される", async ({ page }) => {
    await test.step("書き出しエラーのモックを設定", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFileError(page);
    });

    await test.step("選択音声を書き出す", async () => {
      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();
    });

    await test.step("エラーダイアログを確認して閉じる", async () => {
      const dialog = page.getByRole("dialog", {
        name: "書き出しに失敗しました。",
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "閉じる" }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test("全ての音声の書き出しでエラーダイアログが表示される", async ({
    page,
  }) => {
    await test.step("書き出しエラーのモックを設定", async () => {
      await mockShowSaveDirectoryDialog(page);
      await mockWriteFileError(page);
    });

    await test.step("音声を書き出す", async () => {
      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "音声書き出し").click();
    });

    await test.step("結果ダイアログを確認して閉じる", async () => {
      const dialog = getNewestQuasarDialog(page);
      await expect(dialog.getByText("音声書き出し結果")).toBeVisible();
      await expect(
        dialog.getByText("1件の書き込みエラーによる失敗"),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "閉じる" }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test("音声を繋げて書き出しでエラーダイアログが表示される", async ({
    page,
  }) => {
    await test.step("書き出しエラーのモックを設定", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFileError(page);
    });

    await test.step("音声を繋げて書き出す", async () => {
      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "音声を繋げて書き出し").click();
    });

    await test.step("エラーダイアログを確認して閉じる", async () => {
      const dialog = page.getByRole("dialog", {
        name: "書き出しに失敗しました。",
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "閉じる" }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test("音声ライブラリ利用規約ダイアログの表示", async ({ page }) => {
    // 1. 1つのキャラクターでのテスト:
    //   - 書き出し時に利用規約が表示される
    //   - キャンセル後、再度書き出しすると利用規約が再表示される
    //   - 確認後、再度書き出しでは利用規約が表示されない
    // 2. 複数キャラクターでのテスト:
    //   - 3人のキャラクターで書き出し時、未確認の2人分の利用規約のみ表示
    //   - 確認後、再度3人で書き出しでは何も表示されない
    await test.step("1つのキャラクターで書き出し時に利用規約が表示される", async () => {
      await mockShowSaveFileDialog(page);
      await mockWriteFile(page);

      await page.getByRole("button", { name: "ファイル" }).click();
      await getQuasarMenu(page, "選択音声を書き出し").click();

      const dialog = getNewestQuasarDialog(page);
      await expect(
        dialog.getByText("音声ライブラリ利用規約のご案内"),
      ).toBeVisible();
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
      // 複数選択モードにする
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
      const characterPolicies = dialog.locator(".character-policy-item");
      await expect(characterPolicies).toHaveCount(2);
    });

    await test.step("確認ボタンを押すと複数音声の書き出しが実行される", async () => {
      const dialog = getNewestQuasarDialog(page);
      await dialog.getByRole("button", { name: "確認して続行" }).click();
      await expect(dialog).not.toBeVisible();

      await waitForExportNotificationAndClose(page);
    });

    await test.step("全キャラクター確認済みでは利用規約が表示されない", async () => {
      // 再度3人選択
      await page.locator(".audio-cell:nth-child(1)").click();
      await page.keyboard.down("Shift");
      await page.locator(".audio-cell:nth-child(3)").click();
      await page.keyboard.up("Shift");

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
