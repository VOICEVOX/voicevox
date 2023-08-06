import { test, expect, Page, Locator } from "@playwright/test";

import { navigateToOptionDialog } from "../../navigators";
import { getNewestQuasarDialog } from "../../locators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

/**
 * 書き出しファイル名パターンダイアログまで移動
 */
const moveToFilenameDialog = async (page: Page, optionDialog: Locator) => {
  await optionDialog.getByRole("button", { name: "編集する" }).click();
  const filenameDialog = await getNewestQuasarDialog(page);
  await expect(
    filenameDialog.getByText("書き出しファイル名パターン")
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
  const optionDialog = await navigateToOptionDialog(page);

  let { doneButton, textbox } = await moveToFilenameDialog(page, optionDialog);

  // デフォルト状態は確定ボタンが押せる
  await expect(textbox).toHaveValue("$連番$_$キャラ$（$スタイル$）_$テキスト$");
  await expect(doneButton).toBeEnabled();

  // $連番$ が含まれていない場合は確定ボタンが押せない
  await textbox.click();
  await textbox.fill("test");
  await textbox.press("Enter");
  await expect(textbox).toHaveValue("test");
  await expect(doneButton).toBeDisabled();

  // $連番$ を含めると確定ボタンが押せる
  await page.getByRole("button", { name: "$連番$" }).click();
  await expect(textbox).toHaveValue("test$連番$");
  await expect(doneButton).toBeEnabled();

  // 確定するとダイアログが閉じて設定した内容が反映されている
  await doneButton.click();
  await expect(optionDialog.getByText("test$連番$.wav")).toBeVisible();

  // 再度開くと設定した内容が反映されている
  ({ doneButton, textbox } = await moveToFilenameDialog(page, optionDialog));
  await expect(textbox).toHaveValue("test$連番$");

  // デフォルト値にリセットできる
  await page.getByRole("button", { name: "デフォルトにリセット" }).click();
  await expect(textbox).toHaveValue("$連番$_$キャラ$（$スタイル$）_$テキスト$");
});
