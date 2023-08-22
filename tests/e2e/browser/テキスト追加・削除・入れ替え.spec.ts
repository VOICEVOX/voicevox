import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("テキストの追加・入れ替え・削除", async ({ page }) => {
  await navigateToMain(page);
  await expect(
    page.getByRole("button").filter({ hasText: "add" })
  ).toBeVisible();
  expect(await page.locator(".audio-cell").count()).toBe(1);
  await page.locator(".audio-cell input").fill("foo");
  await page.locator(".audio-cell input").press("Enter");
  expect(await page.locator(".audio-cell input").inputValue()).toBe("foo");
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.locator(".audio-cell input").nth(1).fill("bar");
  await page.locator(".audio-cell input").nth(1).press("Enter");
  await page.locator(".audio-cell input").nth(2).fill("baz");
  await page.locator(".audio-cell input").nth(2).press("Enter");
  expect(await page.locator(".audio-cell").count()).toBe(4);
  await page.locator(".audio-cell").first().hover();
  await page
    .getByRole("button")
    .filter({ hasText: "delete_outline" })
    .first()
    .click();
  expect(await page.locator(".audio-cell").count()).toBe(3);
  expect(await page.locator(".audio-cell input").first().inputValue()).toBe(
    "bar"
  );
  const dragFrom = (await page
    .locator(".audio-cell .icon-container")
    .first()
    .boundingBox()) || {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const dragTo = (await page
    .locator(".audio-cell .icon-container")
    .nth(1)
    .boundingBox()) || {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  await page.mouse.move(
    dragFrom.x + dragFrom.width / 2,
    dragFrom.y + dragFrom.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    dragTo.x + dragTo.width / 2,
    dragTo.y + dragTo.height / 2
  );
  await page.mouse.up();

  expect(await page.locator(".audio-cell input").first().inputValue()).toBe(
    "baz"
  );
  expect(await page.locator(".audio-cell input").nth(1).inputValue()).toBe(
    "bar"
  );
});
