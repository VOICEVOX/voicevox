import { test, expect, Page, Locator } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getNewestQuasarDialog } from "../locators";

test.beforeEach(gotoHome);

/**
 * 最後のテキスト欄にテキストを入力し、その読みを取得する。
 * 確実に読みを反映させるために、一度空にしてから入力する。
 */
async function getYomi(page: Page, inputText: string): Promise<string> {
  const audioCellInput = page.getByRole("textbox", { name: "行目" }).last();
  const accentPhrase = page.locator(".accent-phrase");

  // 空にする
  await audioCellInput.click();
  await audioCellInput.fill("");
  await audioCellInput.press("Enter");
  await expect(accentPhrase).not.toBeVisible();

  // 入力する
  await audioCellInput.click();
  await audioCellInput.fill(inputText);
  await audioCellInput.press("Enter");
  await expect(accentPhrase).toBeVisible();

  return (await accentPhrase.allTextContents()).join("");
}

async function openDictDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("読み方＆アクセント辞書").click();
  await page.waitForTimeout(500);
  await expect(page.getByText("読み方＆アクセント辞書")).toBeVisible();
  await expect(page.getByText("単語一覧")).toBeVisible();
}

async function validateInputTag(
  page: Page,
  inputTag: Locator,
  expectedWord: string,
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

  // テスト用にランダムな文字列を生成
  const randomString = Math.random().toString(36).slice(-8);
  const zenkakuRandomString = randomString.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });

  // 文字列を入力して読み方を記憶する
  const yomi = await getYomi(page, randomString);

  // 読み方の設定画面を開く
  await openDictDialog(page);

  // 単語追加
  await page.getByRole("button").filter({ hasText: "追加" }).click();
  const wordInputTag = page
    .locator(".word-editor .row")
    .filter({ hasText: "単語" })
    .locator(".q-field__native");
  await wordInputTag.evaluate((e: HTMLInputElement, rs: string) => {
    e.value = rs;
    e.dispatchEvent(new Event("input"));
  }, randomString);
  await page.waitForTimeout(100);
  await validateInputTag(page, wordInputTag, zenkakuRandomString);

  const yomiInputTag = page
    .locator(".word-editor .row")
    .filter({ hasText: "読み" })
    .locator(".q-field__native");

  await yomiInputTag.evaluate((e: HTMLInputElement) => {
    e.value = "テスト";
    e.dispatchEvent(new Event("input"));
  });
  await page.waitForTimeout(100);
  await validateInputTag(page, yomiInputTag, "テスト");

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
  const yomi2 = await getYomi(page, randomString);
  expect(yomi2).toBe("テスト");

  // もう一度設定を開き辞書からabsを削除
  await openDictDialog(page);
  await page
    .getByRole("listitem")
    .filter({ hasText: zenkakuRandomString })
    .click();
  await page.waitForTimeout(100);
  await page
    .getByRole("listitem")
    .filter({ hasText: zenkakuRandomString })
    .getByText("delete")
    .click();
  await page.waitForTimeout(100);
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "削除する" })
    .click();
  await page.waitForTimeout(100);

  await page
    .locator("header", { hasText: "読み方＆アクセント辞書" })
    .filter({ hasText: "close" })
    .getByRole("button")
    .click();
  await page.waitForTimeout(100);

  // 辞書から削除されていることを確認
  // （＝最初の読み方と同じになっていることを確認）
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  const yomi3 = await getYomi(page, randomString);
  expect(yomi3).toBe(yomi);
});
