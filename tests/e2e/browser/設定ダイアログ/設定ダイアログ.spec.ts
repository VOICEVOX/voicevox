import { test, expect } from "@playwright/test";
import { gotoHome, navigateToSettingDialog } from "../../navigators";

test.beforeEach(gotoHome);

test("スクリーンショット", async ({ page }) => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");

  await navigateToSettingDialog(page);
  await page.waitForTimeout(500);

  await expect(page).toHaveScreenshot("スクリーンショット.png", {
    fullPage: true,
  });
});
