import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
import semver from "semver";
import { navigateToMain, gotoHome } from "../navigators";
import { getNewestQuasarDialog } from "../locators";
import { UpdateInfo } from "@/type/preload";
import { assertNonNullable } from "@/type/utility";

// アップデート通知が出る環境にする
test.beforeEach(async ({ page }) => {
  dotenv.config();

  // 動作環境より新しいバージョン
  const latestVersion = semver.inc(
    process.env.VITE_APP_VERSION ?? process.env.npm_package_version ?? "0.0.0",
    "major",
  );
  assertNonNullable(latestVersion);

  // アップデート情報を返すAPIのモック
  if (process.env.VITE_LATEST_UPDATE_INFOS_URL == undefined) {
    throw new Error("VITE_LATEST_UPDATE_INFOS_URL is not defined");
  }
  await page.route(process.env.VITE_LATEST_UPDATE_INFOS_URL, async (route) => {
    const updateInfos: UpdateInfo[] = [
      {
        version: latestVersion,
        descriptions: [],
        contributors: [],
      },
    ];
    await route.fulfill({
      status: 200,
      body: JSON.stringify(updateInfos),
    });
  });
});

test.beforeEach(async ({ page }) => {
  await gotoHome({ page });

  await navigateToMain(page);
  await page.waitForTimeout(100);
});

test("アップデートが通知されたりスキップしたりできる", async ({ page }) => {
  await page.waitForTimeout(500);

  // 通知されている
  const dialog = getNewestQuasarDialog(page);
  await expect(dialog.getByText("アップデートのお知らせ")).toBeVisible();

  // 普通に閉じると消える
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await page.waitForTimeout(500);
  await expect(dialog).not.toBeVisible();

  // 再度開くとまた表示される
  await page.reload();
  await expect(dialog.getByText("アップデートのお知らせ")).toBeVisible({
    timeout: 10000, // 表示に時間がかかる
  });

  // スキップすると消える
  await dialog
    .getByRole("button", { name: "このバージョンをスキップ" })
    .click();
  await page.waitForTimeout(500);
  await expect(dialog).not.toBeVisible();

  // 再度開いても表示されない（スキップされた）
  await page.reload();
  await page.waitForTimeout(5000); // エンジン読み込み待機
  await expect(dialog).not.toBeVisible();
});
