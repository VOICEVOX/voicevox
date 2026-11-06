import { test, expect, Download, Page } from "@playwright/test";

import { gotoHome, navigateToMain, toggleSetting } from "../navigators";

test.beforeEach(gotoHome);

async function commonAction(
  page: Page,
  toggleCheck: boolean,
  testText: string
) {
  if (toggleCheck) {
    await toggleSetting(page, "labファイルを書き出し");
  }
  await page.locator(".audio-cell input").first().fill(testText);
  await page.getByRole("button", { name: "ファイル" }).click();
  await page.getByText("音声を繋げて書き出し").click();
}

/**
 * 一定時間の間でダウンロードを行う。
 * 一定時間を超えた場合は、ダウンロードを終了
 */
async function downloadAction(page: Page, timeout: number) {
  const downloads: string[] = [];
  for (let _ = 0; _ < 2; _++) {
    const downloadPromise = page.waitForEvent("download");
    const timeoutPromise = new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(null);
        } catch (error) {
          reject(error);
        }
      }, timeout)
    );

    const result = await Promise.race([downloadPromise, timeoutPromise]);
    if (result instanceof Error) {
      throw result;
    } else {
      if (result == null) {
        continue;
      }
      const File: string = ((await result) as Download).suggestedFilename();
      downloads.push(File);
    }
  }
  return downloads;
}

test("「labファイルを書き出し」のトグルがオンの場合のみ、labファイルが書き出される", async ({
  page,
}) => {
  // labファイルを生成しない
  await navigateToMain(page);
  await commonAction(page, false, "おはようございます");
  const downloadWav = await downloadAction(page, 5100); // labファイル生成時より長く待つ(ダウンロード漏れがないことを保証したい)
  await expect(downloadWav.length).toBe(1);
  await expect(downloadWav[0]).toBe("おはようございます.wav");

  // labファイルを生成する
  await commonAction(page, true, ""); // 「おはようございます」が既に入力されているため、空文字列にする
  const downloads = await downloadAction(page, 5000);
  await expect(downloads.length).toBe(2);
  await expect(downloads[0]).toBe("おはようございます.wav");
  await expect(downloads[1]).toBe("おはようございます.lab");
});
