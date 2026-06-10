import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("メイン画面の表示", async ({ page }) => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");
  await navigateToMain(page);

  await test.step("トーク画面のスクリーンショットを撮る", async () => {
    // ローディングが消えるまで待つ
    while (true) {
      await page.locator(".audio-cell:nth-child(1) .q-field").click();
      await page.waitForTimeout(100);
      if (
        (await page
          .locator(".character-portrait-wrapper .character-name")
          .innerText()) !== "（表示エラー）" &&
        (await page.locator(".character-portrait-wrapper .loading").count()) ===
          0
      ) {
        break;
      }
    }
    await expect(page).toHaveScreenshot("トーク画面.png");
  });

  await test.step("ソング画面のスクリーンショットを撮る", async () => {
    await page.getByText("ソング").click();
    await expect(page.getByText("ソング")).toBeEnabled(); // 無効化が解除されるまで待つ
    await expect(page).toHaveScreenshot("ソング画面.png");
  });
});
