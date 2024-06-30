import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";

test.beforeAll(async () => {
  dotenv.config(); // FIXME: エンジンの設定直読み

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

test.beforeEach(async () => {
  await fs.rm(userDir, {
    recursive: true,
    force: true,
  });
});

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  const app = await electron.launch({
    args: ["."],
    timeout: process.env.CI ? 0 : 60000,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://localhost:7357",
    },
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
