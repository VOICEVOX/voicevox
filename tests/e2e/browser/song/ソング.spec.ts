import { test, expect, Page } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";
import { ensureNotNullish } from "@/helpers/errorHelper";

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

  let beforePosition: Awaited<ReturnType<typeof getCurrentPlayhead>>;

  await test.step("ノートを追加する", async () => {
    await sequencer.click({ position: { x: 100, y: 171 } });
    beforePosition = await getCurrentPlayhead(page);
  });

  await test.step("再生して停止する", async () => {
    await page.getByText("play_arrow").click();
    await page.waitForTimeout(3000);
    await page.getByText("stop").click();
  });

  await test.step("再生ヘッドが移動している", async () => {
    const afterPosition = await getCurrentPlayhead(page);
    expect(afterPosition.x).not.toEqual(beforePosition.x);
    expect(afterPosition.y).toEqual(beforePosition.y);
  });
});

test("ノートを追加・削除できる", async ({ page }) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");

  const getCurrentNoteCount = async () =>
    await sequencer.locator(".note").count();

  await test.step("ノートの追加", async () => {
    expect(await getCurrentNoteCount()).toBe(0);
    await sequencer.click({ position: { x: 100, y: 171 } });
    expect(await getCurrentNoteCount()).toBe(1);
    await sequencer.click({ position: { x: 200, y: 171 } });
    expect(await getCurrentNoteCount()).toBe(2);
  });

  await test.step("ノートの削除", async () => {
    expect(await getCurrentNoteCount()).toBe(2);
    await sequencer.click({ position: { x: 100, y: 171 } });
    await page.keyboard.press("Delete");
    expect(await getCurrentNoteCount()).toBe(1);
    await sequencer.click({ position: { x: 200, y: 171 } });
    await page.keyboard.press("Delete");
    expect(await getCurrentNoteCount()).toBe(0);
  });
});

test("ドラッグで長いノートを追加できる", async ({ page }) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");

  await test.step("クリックで短いノートを追加", async () => {
    await sequencer.click({ position: { x: 100, y: 171 } });
  });

  await test.step("ドラッグで長いノートを追加", async () => {
    const startPos = { x: 200, y: 171 };
    const endPos = { x: 400, y: 171 };
    await sequencer.hover({ position: startPos });
    await page.mouse.down();
    await page.mouse.move(endPos.x, endPos.y);
    await page.mouse.up();
  });

  await test.step("２つ目のノートが長い", async () => {
    const notes = sequencer.locator(".note");
    await expect(notes).toHaveCount(2);

    const firstNoteBox = ensureNotNullish(await notes.nth(0).boundingBox());
    const secondNoteBox = ensureNotNullish(await notes.nth(1).boundingBox());
    expect(secondNoteBox.width).toBeGreaterThanOrEqual(firstNoteBox.width * 2);
  });
});
