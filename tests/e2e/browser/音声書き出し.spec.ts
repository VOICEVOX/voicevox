import { test, expect, Page } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";
import { mockShowSaveFileDialog, mockWriteFile } from "./mockUtility";

test.beforeEach(gotoHome);

async function exportSelectedAudioAndSnapshot(page: Page, name: string) {
  const { getFileIds } = await mockShowSaveFileDialog(page);
  const { getWrittenFileBuffers } = await mockWriteFile(page);

  await test.step("選択音声を書き出す", async () => {
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "選択音声を書き出し").click();
  });

  await test.step("書き出し完了の通知を確認して閉じる", async () => {
    const notify = page.locator("#q-notify");
    await expect(notify.getByText("音声を書き出しました")).toBeVisible();
    await notify.getByRole("button", { name: "閉じる" }).click();
    await expect(notify).not.toBeVisible();
  });

  await test.step("音声ファイルのバイナリをスナップショット", async () => {
    const fileId = (await getFileIds())[0];
    const buffer = (await getWrittenFileBuffers())[fileId];
    expect(buffer).toMatchSnapshot(`${name}.wav`);
  });
}

test.describe("音声書き出し", () => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");

  test.beforeEach(async ({ page }) => {
    await navigateToMain(page);

    await test.step("テキスト欄にテキストを入力", async () => {
      const audioCell = page.getByRole("textbox", { name: "1行目" });
      const accentPhrase = page.locator(".accent-phrase");

      await audioCell.click();
      await audioCell.fill("こんにちは、テストです");
      await audioCell.press("Enter");
      await expect(accentPhrase).not.toHaveCount(0);
    });
  });

  test("各パラメータを変更して音声書き出し", async ({ page }) => {
    await exportSelectedAudioAndSnapshot(page, "デフォルト");

    const parameters = [
      ["話速", "1.5"],
      ["音高", "0.5"],
      ["抑揚", "1.5"],
      ["音量", "1.5"],
      ["間の長さ", "1.5"],
      ["開始無音", "0.3"],
      ["終了無音", "0.3"],
    ] as const;

    for (const [name, newValue] of parameters) {
      await test.step(`${name}変更`, async () => {
        const input = page.getByLabel(name);
        const originalValue = await input.inputValue();

        await test.step("パラメータを変更", async () => {
          await input.fill(newValue);
          await input.press("Enter");
        });

        await exportSelectedAudioAndSnapshot(page, `${name}変更`);

        await test.step("元の値に戻す", async () => {
          await input.fill(originalValue);
          await input.press("Enter");
        });
      });
    }
  });
});
