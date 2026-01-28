import fs from "node:fs/promises";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { getUserTestDir } from "./helper";

test.beforeAll(async () => {
  console.log("Waiting for main.js to be built...");
  while (true) {
    try {
      await fs.access("./dist/main.js");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.log("main.js is built.");
});

test.beforeEach(async () => {
  // キャッシュなどでテスト結果が変化しないように、appDataをテスト起動時に毎回消去する。
  // cf: https://www.electronjs.org/ja/docs/latest/api/app#appgetpathname
  const userDir = getUserTestDir();
  await fs.rm(userDir, {
    recursive: true,
    force: true,
  });
});

test.describe(".env環境", () => {
  test.beforeEach(() => {
    dotenv.config({ path: ".env", override: true, quiet: true });
  });

  test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
    const app = await electron.launch({
      args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
      timeout: process.env.CI ? 0 : 60000,
    });

    // ログを表示
    app.on("console", (msg) => {
      console.log(msg.text());
    });

    const sut = await app.firstWindow({
      timeout: process.env.CI ? 90000 : 60000,
    });
    await sut.waitForSelector("text=利用規約に関するお知らせ", {
      timeout: 60000,
    });

    await app.close();
  });
});

test.describe("downloadVvpp環境", () => {
  test.beforeEach(async () => {
    dotenv.config({
      path: "./tests/env/.env.test-electron-default-vvpp",
      override: true,
      quiet: true,
    });
  });

  test("起動したら「エンジンのセットアップ」画面が表示される", async () => {
    const app = await electron.launch({
      args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
      timeout: process.env.CI ? 0 : 60000,
    });

    // ログを表示
    app.on("console", (msg) => {
      console.log(msg.text());
    });

    const sut = await app.firstWindow({
      timeout: process.env.CI ? 90000 : 60000,
    });
    await sut.waitForSelector("text=エンジンのセットアップ", {
      timeout: 60000,
    });

    await app.close();
  });
});
