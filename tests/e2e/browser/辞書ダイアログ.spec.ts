import { test, expect } from "@playwright/test";
import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("「設定」→「読み方＆アクセント辞書」で「読み方＆アクセント辞書」ページが表示される", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("読み方＆アクセント辞書").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("読み方＆アクセント辞書")).toBeVisible();
  await expect(page.getByText("単語一覧")).toBeVisible();
  expect(1).toBe(2);
});
