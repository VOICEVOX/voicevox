import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { MessageBoxSyncOptions } from "electron";

test.beforeAll(async () => {
  console.log("Waiting for main.js to be built...");
  while (true) {
    try {
      await fs.access("./dist/main.js");
      break;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.log("main.js is built.");
});

test.beforeEach(async () => {
  // キャッシュなどでテスト結果が変化しないように、appDataをテスト起動時に毎回消去する。
  // cf: https://www.electronjs.org/ja/docs/latest/api/app#appgetpathname
  const appDataMap: Partial<Record<NodeJS.Platform, string>> = {
    win32: process.env.APPDATA,
    darwin: os.homedir() + "/Library/Application Support",
    linux: process.env.XDG_CONFIG_HOME || os.homedir() + "/.config",
  } as const;

  const appData = appDataMap[process.platform];
  if (!appData) {
    throw new Error("Unsupported platform");
  }
  const userDir = path.resolve(appData, `${process.env.VITE_APP_NAME}-test`);

  await fs.rm(userDir, {
    recursive: true,
    force: true,
  });
});

[
  {
    envName: ".env環境",
    envPath: ".env",
  },
  {
    envName: "VVPPデフォルトエンジン",
    envPath: "tests/env/.env.test-electron-default-vvpp",
  },
].forEach(({ envName, envPath }) => {
  test.describe(`${envName}`, () => {
    test.beforeEach(() => {
      dotenv.config({ path: envPath, override: true });
    });

    test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
      const app = await electron.launch({
        args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
        timeout: process.env.CI ? 0 : 60000,
      });

      // ダイアログのモック
      await app.evaluate((electron) => {
        // @ts-expect-error ２種のオーバーロードを無視する
        electron.dialog.showMessageBoxSync = (
          options: MessageBoxSyncOptions,
        ) => {
          // デフォルトエンジンのインストールの確認ダイアログ
          if (
            options.title == "デフォルトエンジンのインストール" &&
            options.buttons?.[0] == "インストール"
          ) {
            return 0;
          }

          throw new Error(`Unexpected dialog: ${JSON.stringify(options)}`);
        };
      });

      // ログを表示
      app.on("console", (msg) => {
        console.log(msg.text());
      });

      const sut = await app.firstWindow({
        timeout: process.env.CI ? 60000 : 30000,
      });
      // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
      await sut.waitForSelector("text=利用規約に関するお知らせ", {
        timeout: 60000,
      });
      await app.close();
    });
  });
});
