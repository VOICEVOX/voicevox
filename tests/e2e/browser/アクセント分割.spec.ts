import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("アクセント分割したらアクセント区画が増える", async ({ page }) => {
  await navigateToMain(page);
  await expect(page.locator(".audio-cell").first()).toBeVisible();
  await page.locator(".audio-cell input").first().fill("こんにちは");
  await page.locator(".audio-cell input").first().press("Enter");
  expect(await page.locator(".mora-table").count()).toBe(1);
  await (await page.locator(".splitter-cell").all())[1].click();
  await page.waitForTimeout(100);
  expect(await page.locator(".mora-table").count()).toBe(2);
});
