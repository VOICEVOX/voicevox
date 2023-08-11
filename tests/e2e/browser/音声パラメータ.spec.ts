import { test, expect } from "@playwright/test";

import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

test("音声パラメータ引き継ぎの設定", async ({ page }) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);
  await page.locator(".audio-cell input").first().press("Enter");
  await page.waitForTimeout(100);
  await expect(
    page.locator(".parameters .q-field__native").first()
  ).toBeVisible();

  // 数値を変更し、変わるかどうかを確認
  const beforeChange = await page
    .locator(".parameters .q-field__native")
    .first()
    .evaluate((e: HTMLInputElement) => e.value);
  expect(beforeChange).toBe("1.00");

  await page
    .locator(".parameters .q-field__native")
    .first()
    .evaluate((e: HTMLInputElement) => {
      e.value = "0.50";
      e.dispatchEvent(new Event("change"));
    });

  const afterChange = await page
    .locator(".parameters .q-field__native")
    .first()
    .evaluate((e: HTMLInputElement) => e.value);
  expect(afterChange).toBe("0.50");

  // パラメータ引き継ぎは自動的にオンなので、パラメータ引き継ぎがされるかどうかを確認
  await page.getByRole("button").filter({ hasText: "add" }).click();
  const afterAdd = await page
    .locator(".parameters .q-field__native")
    .first()
    .evaluate((e: HTMLInputElement) => e.value);
  expect(afterAdd).toBe("0.50");

  // 設定画面を開き、パラメータ引き継ぎをオフにし、設定画面を閉じる
  await page.getByText("設定").click();
  await page.waitForTimeout(100);
  await page.getByText("オプション").click();
  await page.waitForTimeout(100);
  await page
    .locator(".q-card__actions")
    .filter({ hasText: "パラメータの引き継ぎ" })
    .getByRole("switch")
    .click();
  await page
    .locator("#q-portal--dialog--6")
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();
  // パラメータを引き継がないことの確認
  await page.locator(".audio-cell input").first().click();
  await page.getByRole("button").filter({ hasText: "add" }).click();
  const afterChangeSetting = await page
    .locator(".parameters .q-field__native")
    .first()
    .evaluate((e: HTMLInputElement) => e.value);
  expect(afterChangeSetting).toBe("1.00");
});
