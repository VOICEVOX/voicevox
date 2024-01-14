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

test("labファイルの生成", async ({ page }) => {
  // labファイルを生成しない
  await navigateToMain(page);
  const DownloadLab = true;
  await commonAction(page, DownloadLab, "おはようございます");
  const downloads = await downloadAction(page, 6100);
  expect(downloads.length).toBe(1);

  // labファイルを生成する
  const notDownloadLab = false;
  await commonAction(page, notDownloadLab, "");
  const downloads2 = await downloadAction(page, 6000);
  expect(downloads2.length).toBe(2);
  expect(downloads2[0]).toBe(downloads[0]);
});
