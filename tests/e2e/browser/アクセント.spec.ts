import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("アクセント分割したらアクセント区間が増える", async ({ page }) => {
  await navigateToMain(page);
  await expect(page.locator(".audio-cell").first()).toBeVisible();
  await page.locator(".audio-cell input").first().fill("こんにちは");
  await page.locator(".audio-cell input").first().press("Enter");
  await page.waitForTimeout(500);
  expect(await page.locator(".mora-table").count()).toBe(1);
  await (await page.locator(".splitter-cell").all())[1].click();
  await page.waitForTimeout(500);
  expect(await page.locator(".mora-table").count()).toBe(2);
});
