import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { getNewestQuasarDialog, getQuasarMenu } from "../locators";

test.beforeEach(gotoHome);

test("ツールバーのカスタマイズでボタンを追加でき、デフォルトに戻すこともできる", async ({
  page,
}) => {
  await navigateToMain(page);
  // 全部書き出しボタンはデフォルトでないことを確認
  expect(
    await page
      .locator("header")
      .getByRole("toolbar")
      .getByText("全部書き出し")
      .count(),
  ).toBe(0);

  // ツールバーのカスタマイズページに移動
  await page.getByText("設定").click();
  await page.waitForTimeout(100);
  await getQuasarMenu(page, "ツールバーのカスタマイズ").click();
  await expect(
    getNewestQuasarDialog(page).getByText("ツールバーのカスタマイズ"),
  ).toBeVisible();

  // 全部書き出しボタンを追加する
  expect(
    await page.getByRole("button").filter({ hasText: "全部書き出し" }).count(),
  ).toBe(0);
  await page.getByRole("listitem").filter({ hasText: "全部書き出し" }).click();
  expect(
    await page.getByRole("button").filter({ hasText: "全部書き出し" }).count(),
  ).toBe(1);
  await page.getByText("保存", { exact: true }).click();
  await getNewestQuasarDialog(page)
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();

  // 閉じたあとに全部書き出しボタンが追加されてることを確認
  await page.waitForTimeout(100);
  expect(
    await page
      .locator("header")
      .getByRole("toolbar")
      .getByText("全部書き出し")
      .count(),
  ).toBe(1);

  // 再度ツールバーのカスタマイズページに移動し、デフォルトに戻すボタンを押す
  await page.getByText("設定").click();
  await page.waitForTimeout(100);
  await getQuasarMenu(page, "ツールバーのカスタマイズ").click();
  await page.waitForTimeout(100);
  expect(
    await page
      .locator("main")
      .getByRole("button")
      .filter({ hasText: "全部書き出し" })
      .count(),
  ).toBe(1);
  await page.getByText("デフォルトに戻す").click();
  await page.locator(".q-card").getByText("デフォルトに戻す").click();
  await page.getByText("保存", { exact: true }).click();
  expect(
    await page
      .locator("main")
      .getByRole("button")
      .filter({ hasText: "全部書き出し" })
      .count(),
  ).toBe(0);

  // 閉じるボタンを再度押し、全部書き出しボタンが消えてることを確認
  await page
    .locator("header")
    .getByRole("button")
    .filter({ hasText: "close" })
    .click();

  await page.waitForTimeout(100);
  expect(
    await page
      .locator("header")
      .getByRole("toolbar")
      .getByText("全部書き出し")
      .count(),
  ).toBe(0);
});
