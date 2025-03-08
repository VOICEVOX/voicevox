import { test, expect, Page } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

function getNthAccentPhraseInput({ page, n }: { page: Page; n: number }) {
  return page.getByLabel(`${n + 1}番目のアクセント区間の読み`);
}

test("単体アクセント句の読み変更", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  const textField = page.getByRole("textbox", { name: "1行目" });
  await textField.click();
  await textField.fill("あれもこれもそれもどれも");
  await textField.press("Enter");

  const inputs = Array.from({ length: 4 }, (_, i) =>
    getNthAccentPhraseInput({ page, n: i }),
  );

  // 読点を追加
  await page.getByText("ア", { exact: true }).click();
  await inputs[0].fill("アレモ、");
  await inputs[0].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("アレモ、")).toBeVisible();

  // 「,」が読点に変換される
  await page.getByText("コ", { exact: true }).click();
  await inputs[1].fill("コレモ,");
  await inputs[1].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("コレモ、")).toBeVisible();

  // 連続する読点を追加すると１つに集約される
  await page.getByText("ソ", { exact: true }).click();
  await inputs[2].fill("ソレモ,、,、");
  await inputs[2].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("ソレモ、")).toBeVisible();

  // 最後のアクセント区間に読点をつけても無視される
  await page.getByText("ド", { exact: true }).click();
  await inputs[3].fill("ドレモ,、,、");
  await inputs[3].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("ドレモ、")).not.toBeVisible();
});

test("詳細調整欄のコンテキストメニュー", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  // 削除
  await page.getByRole("textbox", { name: "1行目" }).click();
  await page
    .getByRole("textbox", { name: "1行目" })
    .fill("あれもこれもそれもどれも");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  await page.getByText("ソレモ").click({
    button: "right",
  });
  await page
    .getByRole("listitem")
    .filter({ has: page.getByText("削除") })
    .click();
  await page.waitForTimeout(100);
  await expect(page.getByText("ソレモ")).not.toBeVisible();
  await expect(page.getByText("コレモ")).toBeVisible();
  await expect(page.getByText("ドレモ")).toBeVisible();
});
