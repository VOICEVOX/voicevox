import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("起動したら「利用規約に関するお知らせ」が表示される", async ({ page }) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible();
});
