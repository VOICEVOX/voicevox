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
    getNthAccentPhraseInput({ page, n: i })
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

test("アクセント区間全体の値変更", async ({ page }) => {
  const otherSliderValue = process.env.CI ? "0.106" : "0.064";

  await navigateToMain(page);
  await page.waitForTimeout(100);

  const textField = page.getByRole("textbox", { name: "1行目" });
  await textField.click();
  await textField.fill("1234");
  await textField.press("Enter");

  await page.getByText("長さ").click();
  await page.waitForTimeout(1000);

  const moraTable = page.locator(".mora-table").last();
  await moraTable.hover({
    // Alt 押下中はスライダー以外にも当たり判定があることを確認するため
    position: { x: 20, y: 20 },
  });
  await page.keyboard.down("Alt");

  // Alt 押下中は hover 中のアクセント区間の他モーラの値ラベルも表示される
  await expect(page.getByText(otherSliderValue)).toBeVisible();

  const sliderThumb = page.locator(".q-slider__thumb").last();
  await sliderThumb.hover();
  await page.mouse.down();
  await page.waitForTimeout(1000);

  // alt 押下中に pan しても値ラベルが表示されたまま
  // pan 中は Quasar によって当たり判定が消える都合で別処理のため、個別にテストが必要。
  await expect(page.getByText(otherSliderValue)).toBeVisible();

  await page.mouse.move(0, 0);
  await page.mouse.up();

  await moraTable.hover({
    position: { x: 20, y: 20 },
  });
  await page.keyboard.down("Alt");
  await page.waitForTimeout(1000);

  // 他モーラの変更ができるかどうかを確認
  await expect(page.getByText(otherSliderValue)).not.toBeVisible();

  await page.mouse.up();
  await page.keyboard.up("Alt");
});
