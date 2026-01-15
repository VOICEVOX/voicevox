import fs from "node:fs/promises";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { MessageBoxSyncOptions } from "electron";
import { getUserTestDir, setupOldVersionEngine } from "./helper";

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

/** エンジンテストの共通操作 */
async function runEngineTest(params: { isUpdate: boolean }) {
  const { isUpdate } = params;
  if (isUpdate) {
    await setupOldVersionEngine();
  }

  const app = await electron.launch({
    args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
    timeout: process.env.CI ? 0 : 60000,
  });

  // ダイアログのモック
  await app.evaluate((electron, isUpdate) => {
    // @ts-expect-error ２種のオーバーロードを無視する
    electron.dialog.showMessageBoxSync = (options: MessageBoxSyncOptions) => {
      // デフォルトエンジンのインストールの確認ダイアログ
      if (
        !isUpdate &&
        options.title == "デフォルトエンジンのインストール" &&
        options.buttons?.[0] == "インストールする"
      ) {
        return 0;
      }

      // デフォルトエンジンのアップデートの確認ダイアログ
      if (
        isUpdate &&
        options.title == "デフォルトエンジンのアップデート" &&
        options.buttons?.[0] == "アップデートする"
      ) {
        return 0;
      }

      throw new Error(`Unexpected dialog: ${JSON.stringify(options)}`);
    };
  }, params.isUpdate);

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
}

[
  {
    envName: ".env環境",
    envPath: ".env",
    envId: "dotenv-environment",
  },
  {
    envName: "VVPPデフォルトエンジン",
    envPath: "tests/env/.env.test-electron-default-vvpp",
    envId: "vvpp-default-engine",
  },
].forEach(({ envName, envPath, envId }) => {
  test.describe(`${envName}`, () => {
    test.beforeEach(() => {
      dotenv.config({ path: envPath, override: true });
    });

    test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
      await runEngineTest({ isUpdate: false });
    });

    if (envId === "vvpp-default-engine") {
      test("古いバージョンがインストールされている場合、アップデートが実行される", async () => {
        await runEngineTest({ isUpdate: true });
      });
    }
  });
});
