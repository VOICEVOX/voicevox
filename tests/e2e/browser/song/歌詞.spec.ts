import { test, expect, Page, Locator } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";
import { ensureNotNullish } from "@/helpers/errorHelper";

test.beforeEach(gotoHome);

function getSequencer(page: Page) {
  return page.getByLabel("シーケンサ");
}

async function addNotes(page: Page, count: number) {
  await test.step(`ノートを${count}つ追加`, async () => {
    const sequencer = getSequencer(page);
    for (let i = 0; i < count; i++) {
      await sequencer.click({ position: { x: (i + 1) * 100, y: 171 } });
    }
    const notes = sequencer.locator(".note");
    await expect(notes).toHaveCount(count);
  });
}

/** Locator の配列を x 座標でソートする */
async function toSortedLocator(locators: Locator[]): Promise<Locator[]> {
  const locatorsWithPosition = await Promise.all(
    locators.map(async (locator) => ({
      locator,
      x: ensureNotNullish(await locator.boundingBox()).x,
    })),
  );
  locatorsWithPosition.sort((a, b) => a.x - b.x);
  return locatorsWithPosition.map(({ locator }) => locator);
}

async function getSortedNotes(page: Page): Promise<Locator[]> {
  return await test.step("ノートをソートして取得", async () => {
    const sequencer = getSequencer(page);
    const notes = await sequencer.locator(".note").all();
    return toSortedLocator(notes);
  });
}

async function getSortedNoteLylics(page: Page): Promise<string[]> {
  return await test.step("ノートをソートして歌詞を取得", async () => {
    const sequencer = getSequencer(page);
    const lyrics = await sequencer.locator(".note-lyric").all();
    const sortedLyrics = await toSortedLocator(lyrics);
    return Promise.all(
      sortedLyrics.map(async (lyric) =>
        ensureNotNullish(await lyric.textContent()),
      ),
    );
  });
}

async function editNoteLyric(page: Page, note: Locator, lyric: string) {
  await test.step("ノートをダブルクリックして歌詞を入力", async () => {
    await note.dblclick();

    const sequencer = getSequencer(page);
    const lyricInput = sequencer.locator(".lyric-input");
    await expect(lyricInput).toBeVisible();
    await lyricInput.fill(lyric);
    await lyricInput.press("Enter");
    await expect(lyricInput).not.toBeVisible();
  });
}

test("ダブルクリックで歌詞を編集できる", async ({ page }) => {
  await navigateToSong(page);

  await addNotes(page, 1);
  const note = (await getSortedNotes(page))[0];
  const beforeLyric = (await getSortedNoteLylics(page))[0];

  await editNoteLyric(page, note, "あ");

  await test.step("歌詞が変更されていることを確認", async () => {
    const afterLyric = await getSortedNoteLylics(page);
    expect(afterLyric[0]).not.toEqual(beforeLyric);
    expect(afterLyric[0]).toEqual("あ");
  });
});

test("複数ノートの歌詞を一度に編集できる", async ({ page }) => {
  await navigateToSong(page);

  await addNotes(page, 3);

  await editNoteLyric(page, (await getSortedNotes(page))[0], "あいう");
  await test.step("全てのノートの歌詞が変更されていることを確認", async () => {
    const afterLyrics = await getSortedNoteLylics(page);
    expect(afterLyrics).toEqual(["あ", "い", "う"]);
  });

  await editNoteLyric(page, (await getSortedNotes(page))[0], "かきくけこ");
  await test.step("最後のノートに残りの文字が入力されていることを確認", async () => {
    const afterLyrics = await getSortedNoteLylics(page);
    expect(afterLyrics).toEqual(["か", "き", "くけこ"]);
  });
});
