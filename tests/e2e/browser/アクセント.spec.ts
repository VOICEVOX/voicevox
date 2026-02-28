import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("アクセント分割したらアクセント区間が増える", async ({ page }) => {
  await navigateToMain(page);

  const accentPhrases = page.locator(".accent-phrase");

  await test.step("テキストを入力する", async () => {
    await expect(page.locator(".audio-cell").first()).toBeVisible();
    await page.locator(".audio-cell input").first().fill("こんにちは");
    await page.locator(".audio-cell input").first().press("Enter");
    await page.waitForTimeout(500);
    expect(await accentPhrases.count()).toBe(1);
  });

  await test.step("アクセント分割すると区間が増える", async () => {
    await (await page.locator(".splitter-cell").all())[1].click();
    await page.waitForTimeout(500);
    expect(await accentPhrases.count()).toBe(2);
  });
});

test("アクセントの読み部分をクリックすると読みを変更できる", async ({
  page,
}) => {
  await navigateToMain(page);

  const accentPhrase = page.locator(".accent-phrase");
  const textbox = page.getByRole("textbox", { name: "1行目" });

  await test.step("テキストを入力する", async () => {
    await textbox.click();
    await textbox.fill("テストです");
    await textbox.press("Enter");
    await expect(accentPhrase).toHaveText("テストデス");
  });

  await test.step("読みを編集する", async () => {
    await expect(page.locator(".text-cell").first()).toBeVisible();
    await page.locator(".text-cell").first().click();
    const input = page.getByLabel("1番目のアクセント区間の読み");
    expect(await input.inputValue()).toBe("テストデス");
    await input.fill("テストテスト");
    await input.press("Enter");
    await expect(accentPhrase).toHaveText("テストテスト");
  });
});
