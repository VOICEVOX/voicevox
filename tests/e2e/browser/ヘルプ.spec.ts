import { test, expect } from "@playwright/test";

import { navigateToHelpDialog } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("「ヘルプ」→「お問い合わせ」で「ヘルプ / お問い合わせ」ページが表示される", async ({
  page,
}) => {
  await navigateToHelpDialog(page);
  await page.getByText("お問い合わせ").click();
  await expect(page.getByText("ヘルプ / お問い合わせ")).toBeVisible();
});
