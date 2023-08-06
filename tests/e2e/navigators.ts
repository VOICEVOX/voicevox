import { expect, Page } from "@playwright/test";
import { getNewestQuasarDialog } from "./locators";

/**
 * 初回起動時の確認を完了してメイン画面に移動
 */
export async function navigateToMain(page: Page) {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "同意して使用開始" }).click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "完了" }).click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "許可" }).click();
}

/**
 * ヘルプダイアログの表示まで移動
 */
export async function navigateToHelpDialog(page: Page) {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "ヘルプ" }).click();
  return getNewestQuasarDialog(page);
}

/**
 * オプションダイアログの表示まで移動
 */
export async function navigateToOptionDialog(page: Page) {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByText("オプション").click();
  return getNewestQuasarDialog(page);
}
