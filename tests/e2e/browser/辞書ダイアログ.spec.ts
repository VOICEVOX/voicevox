import { test, expect, Page, Locator } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getNewestQuasarDialog } from "../locators";

test.beforeEach(gotoHome);

// 読み方を確認する。
// エンジン起動直後など、たまに読みが反映されないことがあるので、
// 一度空にする -> テキストが消えたことを確認（消えてなかったらもう一度Enter）->
// 再度入力する -> 読み方が表示されたことを確認（表示されてなかったらもう一度Enter）
// という流れで読み方を確認する。
async function getYomi(page: Page, inputText: string): Promise<string> {
  const audioCellInput = page.locator(".audio-cell input").last();
  await audioCellInput.fill("");
  let text = "";
  do {
    await page.waitForTimeout(100);
    await audioCellInput.press("Enter");
    text = (await page.locator(".text-cell").allInnerTexts()).join("");
  } while (text.length > 0);

  await audioCellInput.fill(inputText);
  do {
    await page.waitForTimeout(100);
    await audioCellInput.press("Enter");
    text = (await page.locator(".text-cell").allInnerTexts()).join("");
  } while (text.length === 0);

  return text;
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
  wordInputTag.evaluate((e: HTMLInputElement, rs: string) => {
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
    .filter({ hasText: "削除" })
    .click();
  await page.waitForTimeout(100);

  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();
  await page.waitForTimeout(100);

  // 辞書から削除されていることを確認
  // （＝最初の読み方と同じになっていることを確認）
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.waitForTimeout(100);
  const yomi3 = await getYomi(page, randomString);
  expect(yomi3).toBe(yomi);
});
