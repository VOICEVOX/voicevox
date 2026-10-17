import { test, expect } from "@playwright/test";
import { gotoHome, navigateToSettingDialog } from "../../navigators";

test.beforeEach(gotoHome);

test("スクリーンショット", { tag: "@vrt" }, async ({ page }) => {
  test.skip(
    process.env.VRT !== "1",
    "DockerのVRTランナー以外ではスキップします",
  );

  await navigateToSettingDialog(page);
  await page.waitForTimeout(500);

  // スクリーンショット撮影とスクロールを繰り返す
  for (let i = 0; i < 6; i++) {
    await expect(page).toHaveScreenshot(`スクリーンショット_${i}.png`);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
  }
});
