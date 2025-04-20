import { expect, Locator, Page, test } from "@playwright/test";
import { getNewestQuasarDialog, getQuasarMenu } from "./locators";

export async function gotoHome({ page }: { page: Page }) {
  await test.step("最初の画面に移動", async () => {
    const BASE_URL = "http://localhost:7357/";
    await page.setViewportSize({ width: 1024, height: 630 });
    await page.goto(BASE_URL);
  });
}

export async function navigateToMain(page: Page) {
  await test.step("初回起動時の確認を完了してメイン画面に移動", async () => {
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
  });
}

export async function toggleSetting(page: Page, settingName: string) {
  await test.step(`設定 ${settingName} をトグルする`, async () => {
    await page.getByRole("button", { name: "設定" }).click();
    await page.waitForTimeout(100);
    await page.getByText("オプション").click();
    await page.waitForTimeout(100);
    await page
      .locator(".row-card", {
        has: page.getByText(settingName),
      })
      .click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "設定を閉じる" }).click();
  });
  await page.waitForTimeout(500);
}

export async function navigateToHelpDialog(page: Page): Promise<Locator> {
  return await test.step("ヘルプダイアログの表示まで移動", async () => {
    await navigateToMain(page);
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "ヘルプ" }).click();
    return getNewestQuasarDialog(page);
  });
}

export async function navigateToSettingDialog(page: Page): Promise<Locator> {
  return await test.step("設定ダイアログの表示まで移動", async () => {
    await navigateToMain(page);
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "設定" }).click();
    await getQuasarMenu(page, "オプション").click();
    return getNewestQuasarDialog(page);
  });
}

export async function navigateToSong(page: Page) {
  await test.step("ソング画面に移動", async () => {
    await navigateToMain(page);
    await expect(page.getByText("ソング")).toBeVisible();
    await page.getByText("ソング").click();

    // 見やすいようにスナップを1/8に変更
    await page.getByLabel("スナップ").click();
    await page.getByRole("option", { name: "1/8", exact: true }).click();
  });
}
