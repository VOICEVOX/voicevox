import { test, expect } from "@playwright/test";

import { gotoHome, navigateToHelpDialog } from "../navigators";

test.beforeEach(gotoHome);

test("「ヘルプ」メニューから各項目をクリックすると、その項目の内容が表示される", async ({
  page,
}) => {
  await navigateToHelpDialog(page);

  await test.step("お問い合わせを表示する", async () => {
    await page.getByText("お問い合わせ").click();
    await expect(page.getByText("ヘルプ / お問い合わせ")).toBeVisible();
  });

  await test.step("ソフトウェアの利用規約を表示する", async () => {
    await page.getByText("ソフトウェアの利用規約", { exact: true }).click();
    await expect(page.getByText("ヘルプ / ソフトウェアの利用規約")).toBeVisible();
  });

  await test.step("音声ライブラリの利用規約を表示する", async () => {
    await page.getByText("音声ライブラリの利用規約", { exact: true }).click();
    await expect(
      page.getByText("ヘルプ / 音声ライブラリの利用規約"),
    ).toBeVisible();
  });

  await test.step("使い方を表示する", async () => {
    await page.getByText("使い方", { exact: true }).click();
    await expect(page.getByText("ヘルプ / 使い方")).toBeVisible();
  });

  await test.step("開発コミュニティを表示する", async () => {
    await page.getByText("開発コミュニティ", { exact: true }).click();
    await expect(page.getByText("ヘルプ / 開発コミュニティ")).toBeVisible();
  });

  await test.step("ライセンス情報を表示する", async () => {
    await page.getByText("ライセンス情報", { exact: true }).click();
    await expect(page.getByText("ヘルプ / ライセンス情報")).toBeVisible();
  });

  await test.step("アップデート情報を表示する", async () => {
    await page.getByText("アップデート情報", { exact: true }).click();
    await expect(page.getByText("ヘルプ / アップデート情報")).toBeVisible();
  });

  await test.step("よくあるご質問を表示する", async () => {
    await page.getByText("よくあるご質問", { exact: true }).click();
    await expect(page.getByText("ヘルプ / よくあるご質問")).toBeVisible();
  });
});
