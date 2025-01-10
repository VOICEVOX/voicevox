import { test, expect, Page, Locator } from "@playwright/test";

import { gotoHome, navigateToSettingDialog } from "../../navigators";
import { getNewestQuasarDialog } from "../../locators";

test.beforeEach(gotoHome);

/**
 * 書き出しファイル名パターンダイアログまで移動
 */
const moveToFilenameDialog = async (page: Page, settingDialog: Locator) => {
  await settingDialog
    .locator(".row-card", { hasText: "トーク：書き出しファイル名パターン" })
    .getByRole("button", { name: "編集する" })
    .click();
  await page.waitForTimeout(500);

  const filenameDialog = getNewestQuasarDialog(page);
  await expect(
    filenameDialog.getByText("書き出しファイル名パターン"),
  ).toBeVisible();

  const doneButton = filenameDialog.getByRole("button", { name: "確定" });
  const textbox = filenameDialog.getByRole("textbox", {
    name: "ファイル名パターン",
  });

  return { filenameDialog, doneButton, textbox };
};

test("「オプション」から「書き出しファイル名パターン」を変更したり保存したりできる", async ({
  page,
}) => {
  const settingDialog = await navigateToSettingDialog(page);

  let { doneButton, textbox } = await moveToFilenameDialog(page, settingDialog);

  // デフォルト状態は確定ボタンが押せる
  await expect(textbox).toHaveValue("$連番$_$キャラ$（$スタイル$）_$テキスト$");
  await expect(doneButton).toBeEnabled();

  // 何も入力されていないときは確定ボタンが押せない
  await textbox.click();
  await textbox.fill("");
  await textbox.press("Enter");
  await expect(settingDialog.getByText("何か入力してください")).toBeVisible();
  await expect(doneButton).toBeDisabled();

  // $連番$ が含まれていない場合は確定ボタンが押せない
  await textbox.click();
  await textbox.fill("test");
  await textbox.press("Enter");
  await expect(textbox).toHaveValue("test");
  await expect(settingDialog.getByText("$連番$は必須です")).toBeVisible();
  await expect(doneButton).toBeDisabled();

  // 無効な文字が含まれている場合は確定ボタンが押せない
  await textbox.click();
  await textbox.fill("$連番$\\");
  await textbox.press("Enter");
  await expect(doneButton).toBeDisabled();
  await expect(
    settingDialog.getByText("使用できない文字が含まれています：「\\」"),
  ).toBeVisible();

  // $連番$ を含めると確定ボタンが押せる
  await textbox.click();
  await textbox.fill("test");
  await textbox.press("Enter");
  await page.getByRole("button", { name: "$連番$" }).click();
  await expect(textbox).toHaveValue("test$連番$");
  await expect(doneButton).toBeEnabled();
  await page.waitForTimeout(100);

  // 確定するとダイアログが閉じて設定した内容が反映されている
  await doneButton.click();
  await page.waitForTimeout(700);
  await expect(settingDialog.getByText("test$連番$.wav")).toBeVisible();

  // 再度開くと設定した内容が反映されている
  ({ doneButton, textbox } = await moveToFilenameDialog(page, settingDialog));
  await expect(textbox).toHaveValue("test$連番$");

  // デフォルト値にリセットできる
  await page.getByRole("button", { name: "デフォルトにリセット" }).click();
  await expect(textbox).toHaveValue("$連番$_$キャラ$（$スタイル$）_$テキスト$");
});
