import fs from "node:fs/promises";
import { _electron as electron, expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { getUserTestDir } from "./helper";

test.beforeEach(async () => {
  // キャッシュなどでテスト結果が変化しないように、appDataをテスト起動時に毎回消去する。
  // cf: https://www.electronjs.org/ja/docs/latest/api/app#appgetpathname
  const userDir = getUserTestDir();
  await fs.rm(userDir, {
    recursive: true,
    force: true,
  });
});

test.beforeEach(async () => {
  dotenv.config({
    path: "./tests/env/.env.test-electron-default-vvpp",
    override: true,
    quiet: true,
  });
});

test("エンジンをインストールできる", async () => {
  const app = await electron.launch({
    args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
    timeout: process.env.CI ? 0 : 60000,
  });

  // ログを表示
  app.on("console", (msg) => {
    console.log(msg.text());
  });

  const page = await app.firstWindow({
    timeout: process.env.CI ? 90000 : 60000,
  });
  await page.waitForSelector("text=エンジンのセットアップ", {
    timeout: 60000,
  });

  const install = page.getByText(/インストール（.+?）/);
  await install.waitFor({
    timeout: 60000,
  });
  await install.click();

  const reinstall = page.getByText(/再インストール（.+?）/);
  await reinstall.waitFor({
    timeout: 60000,
  });

  const launchEditor = page.getByText(/エディタを起動/);
  await expect(launchEditor).toBeEnabled({
    timeout: 60000,
  });

  await app.close();
});
