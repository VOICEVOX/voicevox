import { promises as fs } from "fs";
import path from "path";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";

test.beforeAll(async () => {
  dotenv.config(); // FIXME: エンジンの設定直読み
  // cf: https://www.electronjs.org/ja/docs/latest/api/app#:~:text=appdata%20-%20%E6%97%A2%E5%AE%9A%E3%81%AE%E3%83%A6%E3%83%BC%E3%82%B5%E3%82%99%E6%AF%8E%E3%81%AE%E3%82%A2%E3%83%95%E3%82%9A%E3%83%AA%E3%82%B1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%83%86%E3%82%99%E3%83%BC%E3%82%BF%E3%83%86%E3%82%99%E3%82%A3%E3%83%AC%E3%82%AF%E3%83%88%E3%83%AA%E3%80%82
  const appDataMap: Partial<Record<NodeJS.Platform, string>> = {
    win32: process.env.APPDATA,
    darwin: "~/Library/Application Support",
    linux: process.env.XDG_CONFIG_HOME || "~/.config",
  } as const;

  const appData = appDataMap[process.platform];
  if (!appData) {
    throw new Error("Unsupported platform");
  }
  await fs.rm(path.resolve(appData, "voicevox-test"), {
    recursive: true,
    force: true,
  });
});

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://localhost:5173",
    },
  });
  const sut = await app.firstWindow();
  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await sut.waitForSelector("text=利用規約に関するお知らせ");
  await app.close();
});
