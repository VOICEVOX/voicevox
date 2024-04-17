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
  await textField.fill("1234");
  await textField.press("Enter");

  const inputs = Array.from({ length: 4 }, (_, i) =>
    getNthAccentPhraseInput({ page, n: i }),
  );

  // 読点を追加
  await page.getByText("セ", { exact: true }).click();
  await inputs[0].fill("セン、");
  await inputs[0].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("セン、")).toBeVisible();

  // 「,」が読点に変換される
  await page.getByText("ヒャ", { exact: true }).click();
  await inputs[1].fill("ニヒャク,");
  await inputs[1].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("ニヒャク、")).toBeVisible();

  // 連続する読点を追加すると１つに集約される
  await page.getByText("ジュ", { exact: true }).click();
  await inputs[2].fill("サンジュウ,、,、");
  await inputs[2].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("サンジュウ、")).toBeVisible();

  // 最後のアクセント区間に読点をつけても無視される
  await page.getByText("ヨ", { exact: true }).click();
  await inputs[3].fill("ヨン,、,、");
  await inputs[3].press("Enter");
  await page.waitForTimeout(100);
  await expect(page.getByText("ヨン、")).not.toBeVisible();
});

test("詳細調整欄のコンテキストメニュー", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  // 削除
  await page.getByRole("textbox", { name: "1行目" }).click();
  await page.getByRole("textbox", { name: "1行目" }).fill("1234");
  await page.getByRole("textbox", { name: "1行目" }).press("Enter");
  await page.getByText("サンジュウ").click({
    button: "right",
  });
  await page
    .getByRole("listitem")
    .filter({ has: page.getByText("削除") })
    .click();
  await page.waitForTimeout(100);
  await expect(page.getByText("サンジュウ")).not.toBeVisible();
  await expect(page.getByText("ニヒャク")).toBeVisible();
  await expect(page.getByText("ヨン")).toBeVisible();
});
