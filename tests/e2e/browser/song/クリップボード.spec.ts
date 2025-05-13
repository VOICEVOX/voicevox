import { test, expect, Page } from "@playwright/test";
import { gotoHome, navigateToSong } from "../../navigators";
import { noteSchema } from "@/domain/project/schema";

const VOICEVOX_NOTES_MIME_TYPE = "web application/vnd.voicevox.song-notes";

async function grantClipboardPermissions(page: Page) {
  const origin = new URL(page.url()).origin;
  if (!origin) return;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
}

function getSequencer(page: Page) {
  return page.getByLabel("シーケンサ");
}

async function getRuler(page: Page) {
  const rulerLocator = page.locator(".sequencer-ruler");
  const boundingBox = await rulerLocator.boundingBox();
  if (boundingBox == null) {
    throw new Error("ルーラーが見つかりません");
  }
  return rulerLocator;
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

test.beforeEach(async ({ page }) => {
  await gotoHome({ page });
  await navigateToSong(page);
  await grantClipboardPermissions(page);
});

test("選択した単一ノートをコピー＆ペーストできる", async ({ page }) => {
  await test.step("コピー元のノートを1つ作成して選択", async () => {
    await addNotes(page, 1);
  });

  await test.step("ノートをコピーする", async () => {
    // NOTE: macOSで動かず試験できないので、macもコピーできるようにしている
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+C" : "Control+C");
  });

  await test.step("クリップボードには妥当なノートが含まれている", async () => {
    // クリップボードのカスタムMIMEタイプの内容を取得
    const clipboardData = await page.evaluate(
      async ({ mimeType }) => {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes(mimeType)) {
            const blob = await item.getType(mimeType);
            return await blob.text();
          }
        }
        return null;
      },
      { mimeType: VOICEVOX_NOTES_MIME_TYPE },
    );
    // クリップボードは空ではないはず
    expect(clipboardData).not.toBeNull();

    // クリップボードの内容はzodスキーマでパースできるはず
    const parseResult = noteSchema
      .omit({ id: true })
      .array()
      .safeParse(JSON.parse(clipboardData as string));
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      // クリップボードの内容は1つのノートであるはず
      expect(parseResult.data.length).toBe(1);
      // クリップボードの内容は作成時の位置的に"ソ"であるはず
      expect(parseResult.data[0].lyric).toBe("ソ");
    }
  });

  await test.step("別の場所にペースト", async () => {
    const ruler = await getRuler(page);
    // ルーラーをクリックして別の場所を選択
    await ruler.click({ position: { x: 300, y: 20 } });
    const isMac = process.platform === "darwin";
    // ペースト
    await page.keyboard.press(isMac ? "Meta+V" : "Control+V");
  });

  await test.step("ペーストされたノートの歌詞は妥当なものである", async () => {
    const sequencer = getSequencer(page);
    const noteLyricLocators = sequencer.locator(".note-lyric");

    // ノートはペースト分含め2つあるはず
    await expect(noteLyricLocators).toHaveCount(2);
    // ペーストされたノートは"ソ"であるはず
    const pastedNoteLyric = await noteLyricLocators.nth(1).textContent();
    expect(pastedNoteLyric).toBe("ソ");
  });
});
