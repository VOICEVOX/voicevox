import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("詳細調整欄のコンテキストメニュー", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  // 削除
  await page.getByRole("textbox", { name: "1行目" }).click();
  await page.getByRole("textbox", { name: "1行目" }).fill("1234");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  await page.getByText("サンジュウ").click({
    button: "right",
  });
  await page.getByText("削除").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("サンジュウ")).not.toBeVisible();
  await expect(page.getByText("ニヒャク")).toBeVisible();
  await expect(page.getByText("ヨン")).toBeVisible();
});
