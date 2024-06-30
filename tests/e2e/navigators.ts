import { expect, Page } from "@playwright/test";
import { getNewestQuasarDialog, getQuasarMenu } from "./locators";

/**
 * 最初の画面に移動
 */
export async function gotoHome({ page }: { page: Page }) {
  const BASE_URL = "http://localhost:7357/";
  await page.setViewportSize({ width: 1024, height: 630 });
  await page.goto(BASE_URL);
}

/**
 * 初回起動時の確認を完了してメイン画面に移動
 */
export async function navigateToMain(page: Page) {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 90 * 1000,
  });
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "同意して使用開始" }).click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "完了" }).click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "許可" }).click();
  await page.waitForTimeout(100);
}

/**
 * 特定の設定をトグルする
 */
export async function toggleSetting(page: Page, settingName: string) {
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("オプション").click();
  await page.waitForTimeout(100);
  await page
    .locator(".q-card__actions", {
      has: page.getByText(settingName),
    })
    .locator(".q-toggle")
    .click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定を閉じる" }).click();
  await page.waitForTimeout(500);
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
 * 設定ダイアログの表示まで移動
 */
export async function navigateToSettingDialog(page: Page) {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定" }).click();
  await getQuasarMenu(page, "オプション").click();
  return getNewestQuasarDialog(page);
}
