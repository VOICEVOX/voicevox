import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("+ボタンを押したら行が追加され、ゴミ箱のボタンを押したら行が削除される", async ({
  page,
}) => {
  await navigateToMain(page);
  await expect(
    page.getByRole("button").filter({ hasText: "add" })
  ).toBeVisible();
  expect(await page.locator(".audio-cell").count()).toBe(1);
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  expect(await page.locator(".audio-cell").count()).toBe(4);
  await (await page.locator(".audio-cell").all())[0].hover();
  await (
    await page.getByRole("button").filter({ hasText: "delete_outline" }).all()
  )[0].click();
  expect(await page.locator(".audio-cell").count()).toBe(3);
});
