import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("「設定」→「デフォルトスタイル」で「設定 / デフォルトスタイル・試聴」ダイアログが表示される", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByText("デフォルトスタイル").click();
  await expect(page.getByText("設定 / デフォルトスタイル・試聴")).toBeVisible();
});
