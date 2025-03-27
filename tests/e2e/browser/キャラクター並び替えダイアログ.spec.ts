import { test, expect } from "@playwright/test";

import { gotoHome, navigateToTalk } from "../navigators";

test.beforeEach(gotoHome);

test("「設定」→「キャラクター並び替え・視聴」で「設定 / キャラクター並び替え・視聴」ページが表示される", async ({
  page,
}) => {
  await navigateToTalk(page);
  await page.getByText("設定").click();
  await page.waitForTimeout(100);
  await page.getByText("キャラクター並び替え・試聴").click();
  await page.waitForTimeout(100);
  await expect(
    page.getByText("設定 / キャラクター並び替え・試聴"),
  ).toBeVisible();
});
