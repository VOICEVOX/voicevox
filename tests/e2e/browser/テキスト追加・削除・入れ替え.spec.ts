import { test, expect, type Locator } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { fillAudioCell, validateInput } from "./utils";

test.beforeEach(gotoHome);

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
  await fillAudioCell(page, 0, "foo");
  await fillAudioCell(page, 1, "bar");
  await fillAudioCell(page, 2, "baz");
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

test("選択中のAudioCellを削除しても正しくフォーカスが移動する", async ({
  page,
}) => {
  await navigateToMain(page);

  // 3つAudioCellを追加して合計4つにする
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);

  // それぞれにテキストを入力
  await fillAudioCell(page, 0, "first");
  await fillAudioCell(page, 1, "second");
  await fillAudioCell(page, 2, "third");
  await fillAudioCell(page, 3, "fourth");

  // 2番目のAudioCellをクリックしてアクティブにする
  await page.locator(".audio-cell").nth(1).click();
  await page.waitForTimeout(100);

  // アクティブなAudioCellが2番目であることを確認（activeクラスがついている）
  await expect(page.locator(".audio-cell").nth(1)).toHaveClass(/active/);

  // 2番目のAudioCellを削除
  await page.locator(".audio-cell").nth(1).hover();
  await page
    .getByRole("button")
    .filter({ hasText: "delete_outline" })
    .nth(1)
    .click();
  await page.waitForTimeout(100);

  // AudioCellが3つになっていることを確認
  expect(await page.locator(".audio-cell").count()).toBe(3);

  // 何らかのAudioCellがアクティブ状態を維持していることを確認
  // （削除後に無選択状態にならないことを確認）
  await expect(page.locator(".audio-cell.active")).toHaveCount(1);
});
