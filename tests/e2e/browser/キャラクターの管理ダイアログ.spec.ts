import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

test("「設定」→「キャラクターの管理」で「設定 / キャラクターの管理」ページが表示される", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.getByText("設定").click();
  await page.waitForTimeout(100);
  await page.getByText("キャラクターの管理").click();
  await page.waitForTimeout(100);
  await expect(page.getByText("設定 / キャラクターの管理")).toBeVisible();
});
