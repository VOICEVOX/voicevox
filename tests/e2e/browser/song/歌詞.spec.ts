import { test, expect } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";

test.beforeEach(gotoHome);

test("ダブルクリックで歌詞を編集できる", async ({ page }) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");

  const getCurrentNoteLyric = async () =>
    await sequencer.locator(".note-lyric").first().textContent();

  // ノートを追加し、表示されるまで待つ
  await sequencer.click({ position: { x: 107, y: 171 } });
  await page.waitForSelector(".note");

  // ノートの歌詞を取得
  const note = sequencer.locator(".note").first();
  const beforeLyric = await getCurrentNoteLyric();

  // ノートをダブルクリックし、入力フィールドが表示されるまで待つ
  await note.dblclick();
  await page.waitForSelector(".lyric-input");

  // 歌詞を入力し、Enterキーを押す
  const lyricInput = sequencer.locator(".lyric-input");
  await lyricInput.fill("あ");
  await lyricInput.press("Enter");

  // 変更が反映されるまで待つ
  await page.waitForFunction(() => {
    const lyricElement = document.querySelector(".note-lyric");
    return lyricElement && lyricElement.textContent === "あ";
  });

  // 歌詞が変更されたことを確認
  const afterLyric = await getCurrentNoteLyric();
  expect(afterLyric).not.toEqual(beforeLyric);
  expect(afterLyric).toEqual("あ");
});
