import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain, toggleSetting } from "../../navigators";

test.beforeEach(gotoHome);

test("ファイル書き込み関連", async ({ page }) => {
  await navigateToMain(page);
  await toggleSetting(page, "字幕ファイルを書き出し");

  await page.locator(".audio-cell input").first().fill("おはようございます");
  await page.getByRole("button", { name: "ファイル" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByText("音声を繋げて書き出し").click();
  const wavFile = (await downloadPromise).suggestedFilename();

  const downloadpromise2 = page.waitForEvent("download");
  const srtFile = (await downloadpromise2).suggestedFilename();

  expect(wavFile).toBe("おはようございます.wav");
  expect(srtFile).toBe("おはようございます.srt");
});
