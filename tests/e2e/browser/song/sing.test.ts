import { test, expect, Page } from "@playwright/test";

import { gotoHome, navigateToMain } from "../../navigators";

test.beforeEach(gotoHome);

function navigateToSong(page: Page) {
  return async () => {
    await navigateToMain(page);
    await expect(page.getByText("ソング")).toBeVisible();
    await page.getByText("ソング").click();
  };
}

test("再生ボタンを押して再生できる", async ({ page }) => {
  await navigateToSong(page);
  // TODO: ページ内のオーディオを検出するテストを追加する

  const getCurrentPlayhead = async () =>
    await page.locator(".sequencer-playhead").boundingBox();

  // 再生ボタンを押して再生
  await page.locator(".sequencer-body").click({ position: { x: 107, y: 171 } });
  const beforePosition = await getCurrentPlayhead(); // 再生ヘッドの初期位置
  await page.getByText("play_arrow").click(); // 再生ボタンを押す
  await page.waitForTimeout(3000);
  await page.getByText("stop").click(); // 停止ボタンを押す
  const afterPosition = await getCurrentPlayhead(); // 再生ヘッドの再生後の位置
  await expect(afterPosition?.x).not.toEqual(beforePosition?.x);
  await expect(afterPosition?.y).toEqual(beforePosition?.y);
});

test("ノートを追加・削除できる", async ({ page }) => {
  await navigateToSong(page);

  const getCurrentNoteCount = async () => await page.locator(".note").count();

  // ノートの追加
  await expect(await getCurrentNoteCount()).toBe(0);
  await page.locator(".sequencer-body").click({ position: { x: 107, y: 171 } });
  await expect(await getCurrentNoteCount()).toBe(1);
  await page.locator(".sequencer-body").click({ position: { x: 200, y: 171 } });
  await expect(await getCurrentNoteCount()).toBe(2);

  // ノートの削除
  await expect(await getCurrentNoteCount()).toBe(2);
  await page.locator(".sequencer-body").click({ position: { x: 107, y: 171 } });
  await page.keyboard.press("Delete");
  await expect(await getCurrentNoteCount()).toBe(1);
  await page.locator(".sequencer-body").click({ position: { x: 200, y: 171 } });
  await page.keyboard.press("Delete");
  await expect(await getCurrentNoteCount()).toBe(0);
});

test("ダブルクリックでノートを編集できる", async ({ page }) => {
  await navigateToSong(page);

  const getCurrentNoteLyric = async () =>
    await page.locator(".note-lyric").textContent();

  await page.locator(".sequencer-body").click({ position: { x: 107, y: 171 } });
  const beforeLyric = await getCurrentNoteLyric();

  await page
    .locator(".sequencer-body")
    .click({ position: { x: 107, y: 171 }, clickCount: 2 }); // ダブルクリック

  await page.keyboard.press("Enter");
  const afterLyric = await getCurrentNoteLyric();
  await expect(afterLyric).not.toEqual(beforeLyric);
});
