import { test, expect, Page, Locator } from "@playwright/test";
import { navigateToMain } from "../navigators";
import { getNewestQuasarDialog } from "../locators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

async function validateAbsYomi(
  page: Page,
  expectedText: string
): Promise<void> {
  await page.locator(".audio-cell input").last().fill("abs");
  await page.waitForTimeout(100);
  await page.locator(".audio-cell input").last().press("Enter");
  await page.waitForTimeout(100);
  const text = (await page.locator(".text-cell").allInnerTexts()).join("");
  expect(text).toBe(expectedText);
}

async function openDictDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("読み方＆アクセント辞書").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("読み方＆アクセント辞書")).toBeVisible();
  await expect(page.getByText("単語一覧")).toBeVisible();
}

async function validateInputTag(
  page: Page,
  inputTag: Locator,
  expectedWord: string
) {
  await inputTag.press("Enter");
  await page.waitForTimeout(100);
  const text = await inputTag.evaluate((e: HTMLInputElement) => e.value);
  expect(text).toBe(expectedWord);
}

test("「設定」→「読み方＆アクセント辞書」で「読み方＆アクセント辞書」ページが表示される", async ({
  page,
}) => {
  test.skip(!process.env.CI, "環境変数CIが未設定のためスキップします");
  await navigateToMain(page);
  // アルファベットを入力し、読み方を確認
  await validateAbsYomi(page, "エエビイエス");

  // 読み方の設定画面を開く
  await openDictDialog(page);

  // 単語追加
  await page.getByRole("button").filter({ hasText: "追加" }).click();
  const wordInputTag = page
    .locator(".word-editor .row")
    .filter({ hasText: "単語" })
    .locator(".q-field__native");
  wordInputTag.evaluate((e: HTMLInputElement) => {
    e.value = "abs";
    e.dispatchEvent(new Event("input"));
  });
  await page.waitForTimeout(100);
  await validateInputTag(page, wordInputTag, "ａｂｓ");

  const yomiInputTag = page
    .locator(".word-editor .row")
    .filter({ hasText: "読み" })
    .locator(".q-field__native");

  await yomiInputTag.evaluate((e: HTMLInputElement) => {
    e.value = "アブス";
    e.dispatchEvent(new Event("input"));
  });
  await page.waitForTimeout(100);
  await validateInputTag(page, yomiInputTag, "アブス");

  // 保存して設定画面を閉じる
  await page.getByText("保存", { exact: true }).click();
  await page.waitForTimeout(100);
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();
  await page.waitForTimeout(100);
  // 辞書が登録されているかどうかを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  await validateAbsYomi(page, "アブス");

  // もう一度設定を開き辞書からabsを削除
  await openDictDialog(page);
  await page.getByRole("listitem").filter({ hasText: "ａｂｓ" }).click();
  await page.waitForTimeout(100);
  await page
    .locator(".word-list-header")
    .getByRole("button")
    .filter({ hasText: "削除" })
    .click();
  await page.waitForTimeout(100);
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "削除" })
    .click();
  await page.waitForTimeout(100);

  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();
  await page.waitForTimeout(100);

  // 辞書から削除されていることを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  await validateAbsYomi(page, "エエビイエス");
});
