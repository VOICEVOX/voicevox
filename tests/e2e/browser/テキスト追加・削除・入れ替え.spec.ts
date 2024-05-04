import { test, expect, Locator, Page } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

async function fillInput(page: Page, locator: Locator, text: string) {
  await locator.fill(text);
  await locator.press("Enter");
  await page.waitForTimeout(100);
  await validateInput(locator, text);
}

async function validateInput(locator: Locator, expectedText: string) {
  expect(await locator.inputValue()).toBe(expectedText);
}

async function getCenter(locator: Locator) {
  const box = (await locator.boundingBox()) || {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("テキストの追加・入れ替え・削除", async ({ page }) => {
  // デフォルトでaudioCellは一つなのを確認
  await navigateToMain(page);
  await expect(
    page.getByRole("button").filter({ hasText: "add" }),
  ).toBeVisible();
  expect(await page.locator(".audio-cell").count()).toBe(1);
  // ３つAudioCellを追加したらAudioCellが４つになるのを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  await fillInput(page, page.locator(".audio-cell input").first(), "foo");
  await fillInput(page, page.locator(".audio-cell input").nth(1), "bar");
  await fillInput(page, page.locator(".audio-cell input").nth(2), "baz");
  expect(await page.locator(".audio-cell").count()).toBe(4);
  // 一番上のAudioCellを削除しもともと２番めだったものが一番上に来てAudioCellが３つになることを確認
  await page.locator(".audio-cell").first().hover();
  await page
    .getByRole("button")
    .filter({ hasText: "delete_outline" })
    .first()
    .click();
  await page.waitForTimeout(100);
  expect(await page.locator(".audio-cell").count()).toBe(3);
  await validateInput(page.locator(".audio-cell input").first(), "bar");
  // ドラッグして一番上と２番めに上のものを入れ替えて、入れ替わってることを確認
  const dragFrom = await getCenter(
    page.locator(".audio-cell .icon-container").first(),
  );
  const dragTo = await getCenter(
    page.locator(".audio-cell .icon-container").nth(1),
  );
  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.down();
  await page.mouse.move(dragTo.x, dragTo.y);
  await page.mouse.up();

  await page.waitForTimeout(100);
  await validateInput(page.locator(".audio-cell input").first(), "baz");
  await page.waitForTimeout(100);
  await validateInput(page.locator(".audio-cell input").nth(1), "bar");
});
