import { test, expect } from "@playwright/test";

import { gotoHome, navigateToHelpDialog } from "../navigators";

test.beforeEach(gotoHome);

test("「ヘルプ」メニューから各項目をクリックすると、その項目の内容が表示される", async ({
  page,
}) => {
  await navigateToHelpDialog(page);
  // お問い合わせ
  await page.getByText("お問い合わせ").click();
  await expect(page.getByText("ヘルプ / お問い合わせ")).toBeVisible();

  // ソフトウェアの利用規約
  await page.getByText("ソフトウェアの利用規約", { exact: true }).click();
  await expect(page.getByText("ヘルプ / ソフトウェアの利用規約")).toBeVisible();

  // 音声ライブラリの利用規約
  await page.getByText("音声ライブラリの利用規約", { exact: true }).click();
  await expect(
    page.getByText("ヘルプ / 音声ライブラリの利用規約"),
  ).toBeVisible();

  // 使い方
  await page.getByText("使い方", { exact: true }).click();
  await expect(page.getByText("ヘルプ / 使い方")).toBeVisible();

  // 開発コミュニティ
  await page.getByText("開発コミュニティ", { exact: true }).click();
  await expect(page.getByText("ヘルプ / 開発コミュニティ")).toBeVisible();

  // ライセンス情報
  await page.getByText("ライセンス情報", { exact: true }).click();
  await expect(page.getByText("ヘルプ / ライセンス情報")).toBeVisible();

  // アップデート情報
  await page.getByText("アップデート情報", { exact: true }).click();
  await expect(page.getByText("ヘルプ / アップデート情報")).toBeVisible();

  // よくあるご質問
  await page.getByText("よくあるご質問", { exact: true }).click();
  await expect(page.getByText("ヘルプ / よくあるご質問")).toBeVisible();
});
