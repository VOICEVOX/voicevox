import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("「設定」→「デフォルトスタイル」で「設定 / デフォルトスタイル・試聴」ダイアログが表示される", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByText("デフォルトスタイル").click();
  await expect(page.getByText("設定 / デフォルトスタイル・試聴")).toBeVisible();
});
