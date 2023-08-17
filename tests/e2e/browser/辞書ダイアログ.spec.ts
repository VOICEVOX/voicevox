import { test, expect } from "@playwright/test";
import { navigateToMain } from "../navigators";
import { getNewestQuasarDialog } from "../locators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("「設定」→「読み方＆アクセント辞書」で「読み方＆アクセント辞書」ページが表示される", async ({
  page,
}) => {
  await navigateToMain(page);
  // アルファベットを入力し、読み方を確認
  await page.locator(".audio-cell input").fill("abs");
  await page.locator(".audio-cell input").press("Enter");
  const text = (await page.locator(".text-cell").allInnerTexts()).join("");
  expect(text).toBe("エエビイエス");

  // 読み方の設定画面を開く
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("読み方＆アクセント辞書").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("読み方＆アクセント辞書")).toBeVisible();
  await expect(page.getByText("単語一覧")).toBeVisible();

  // 単語追加
  await page.getByRole("button").filter({ hasText: "追加" }).click();
  await page
    .locator(".word-editor .row")
    .filter({ hasText: "単語" })
    .locator(".q-field__native")
    .evaluate((e: HTMLInputElement) => {
      e.value = "abs";
      e.dispatchEvent(new Event("input"));
    });
  await page
    .locator(".word-editor .row")
    .filter({ hasText: "単語" })
    .locator(".q-field__native")
    .press("Enter");
  await page.waitForTimeout(100);

  const word = await page
    .locator(".word-editor .row")
    .filter({ hasText: "単語" })
    .locator(".q-field__native")
    .evaluate((e: HTMLInputElement) => e.value);
  expect(word).toBe("ａｂｓ");

  await page
    .locator(".word-editor .row")
    .filter({ hasText: "読み" })
    .locator(".q-field__native")
    .evaluate((e: HTMLInputElement) => {
      e.value = "アブス";
      e.dispatchEvent(new Event("input"));
    });
  await page
    .locator(".word-editor .row")
    .filter({ hasText: "読み" })
    .locator(".q-field__native")
    .press("Enter");
  await page.waitForTimeout(100);

  const reading = await page
    .locator(".word-editor .row")
    .filter({ hasText: "読み" })
    .locator(".q-field__native")
    .evaluate((e: HTMLInputElement) => e.value);
  expect(reading).toBe("アブス");

  // 保存して設定画面を閉じる
  await page.getByText("保存", { exact: true }).click();
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();
  // 辞書が登録されているかどうかを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.locator(".audio-cell input").last().fill("abs");
  await page.locator(".audio-cell input").last().press("Enter");
  await page.waitForTimeout(100);
  const afterAddText = (await page.locator(".text-cell").allInnerTexts()).join(
    ""
  );
  expect(afterAddText).toBe("アブス");

  // もう一度設定を開き
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "設定" }).click();
  await page.waitForTimeout(100);
  await page.getByText("読み方＆アクセント辞書").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("読み方＆アクセント辞書")).toBeVisible();
  await expect(page.getByText("単語一覧")).toBeVisible();

  // 辞書からabsを削除
  await page.getByRole("listitem").filter({ hasText: "ａｂｓ" }).click();
  await page
    .locator(".word-list-header")
    .getByRole("button")
    .filter({ hasText: "削除" })
    .click();
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "削除" })
    .click();

  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();

  // 辞書から削除されていることを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  await page.locator(".audio-cell input").last().fill("abs");
  await page.locator(".audio-cell input").last().press("Enter");
  await page.waitForTimeout(100);
  const afterDeleteText = (
    await page.locator(".text-cell").allInnerTexts()
  ).join("");
  expect(afterDeleteText).toBe("エエビイエス");
});
