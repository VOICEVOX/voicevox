import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("メイン画面の表示", async ({ page }) => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");
  await navigateToMain(page);

  // トーク画面の表示
  while (true) {
    await page.locator(".audio-cell:nth-child(1) .q-field").click(); // 一番上のテキスト欄をクリックする
    await page.waitForTimeout(100);
    // ローディングが消えるまで待つ
    if (
      (await page
        .locator(".character-portrait-wrapper .character-name")
        .innerText()) !== "（表示エラー）" &&
      (await page.locator(".character-portrait-wrapper .loading").count()) === 0
    ) {
      break;
    }
  }
  await expect(page).toHaveScreenshot("トーク画面.png");

  // ソング画面の表示
  await page.getByText("ソング").click();
  await expect(page.getByText("ソング")).toBeEnabled(); // 無効化が解除されるまで待つ
  await expect(page).toHaveScreenshot("ソング画面.png");
});
