import { test, expect, Page } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";

test.beforeEach(gotoHome);

async function getCurrentPlayhead(page: Page) {
  const boundingBox = await page
    .getByTestId("sequencer-playhead")
    .boundingBox();
  if (boundingBox == null) throw new Error("再生バーが見つかりません");
  return boundingBox;
}

test("再生ボタンを押して再生できる", async ({ page }) => {
  await navigateToSong(page);
  // TODO: ページ内のオーディオを検出するテストを追加する

  const sequencer = page.getByLabel("シーケンサ");

  await sequencer.click({ position: { x: 107, y: 171 } }); // ノートを追加
  const beforePosition = await getCurrentPlayhead(page); // 再生ヘッドの初期位置
  await page.getByText("play_arrow").click(); // 再生ボタンを押す
  await page.waitForTimeout(3000);
  await page.getByText("stop").click(); // 停止ボタンを押す
  const afterPosition = await getCurrentPlayhead(page); // 再生ヘッドの再生後の位置
  expect(afterPosition.x).not.toEqual(beforePosition.x);
  expect(afterPosition.y).toEqual(beforePosition.y);
});

test("ノートを追加・削除できる", async ({ page }) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");

  const getCurrentNoteCount = async () =>
    await sequencer.locator(".note").count();

  // ノートの追加
  expect(await getCurrentNoteCount()).toBe(0);
  await sequencer.click({ position: { x: 107, y: 171 } });
  expect(await getCurrentNoteCount()).toBe(1);
  await sequencer.click({ position: { x: 200, y: 171 } });
  expect(await getCurrentNoteCount()).toBe(2);

  // ノートの削除
  expect(await getCurrentNoteCount()).toBe(2);
  await sequencer.click({ position: { x: 107, y: 171 } });
  await page.keyboard.press("Delete");
  expect(await getCurrentNoteCount()).toBe(1);
  await sequencer.click({ position: { x: 200, y: 171 } });
  await page.keyboard.press("Delete");
  expect(await getCurrentNoteCount()).toBe(0);
});
