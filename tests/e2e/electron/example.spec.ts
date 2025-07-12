import fs from "fs/promises";
import os from "os";
import path from "path";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { MessageBoxSyncOptions } from "electron";

/** テスト用のユーザーディレクトリパスを取得する */
function getUserTestDir(): string {
  const appDataMap: Partial<Record<NodeJS.Platform, string>> = {
    win32: process.env.APPDATA,
    darwin: os.homedir() + "/Library/Application Support",
    linux: process.env.XDG_CONFIG_HOME || os.homedir() + "/.config",
  } as const;

  const appData = appDataMap[process.platform];
  if (!appData) {
    throw new Error("Unsupported platform");
  }
  return path.resolve(appData, `${process.env.VITE_APP_NAME}-test`);
}

// 共通のエンジンテスト関数
async function runEngineTest(isUpdate: boolean = false) {
  if (isUpdate) {
    await setupOldVersionEngine();
  }

  const app = await electron.launch({
    args: ["--no-sandbox", "."],
    timeout: process.env.CI ? 0 : 60000,
  });

  // ダイアログのモック
  await app.evaluate((electron) => {
    // @ts-expect-error ２種のオーバーロードを無視する
    electron.dialog.showMessageBoxSync = (options: MessageBoxSyncOptions) => {
      // デフォルトエンジンのインストールの確認ダイアログ
      if (
        options.title == "デフォルトエンジンのインストール" &&
        options.buttons?.[0] == "インストール"
      ) {
        return 0;
      }
      // アップデート通知ダイアログ
      if (
        options.title == "デフォルトエンジンのアップデート" &&
        options.buttons?.[0] == "はい"
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
  await sut.waitForSelector("text=利用規約に関するお知らせ", {
    timeout: 180000, // 3分。ダウンロード時間を考慮して長めに
  });

  await app.close();
}

// 古いバージョンのvvpp-enginesディレクトリを作る
async function setupOldVersionEngine() {
  const userDir = getUserTestDir();
  const vvppEngineDir = path.join(userDir, "vvpp-engines");

  await fs.mkdir(vvppEngineDir, { recursive: true });
  const sourceOldEngineDir = path.join(__dirname, "oldEngine");
  const manifestPath = path.join(sourceOldEngineDir, "engine_manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) as {
    uuid: string;
    name: string;
  };

  const oldEngineDir = path.join(
    vvppEngineDir,
    `${manifest.name}+${manifest.uuid}`,
  );
  await fs.cp(sourceOldEngineDir, oldEngineDir, { recursive: true });
}

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
      await runEngineTest(false);
    });

    // VVPPデフォルトエンジンの場合のみアップデートテストを実行
    if (envName === "VVPPデフォルトエンジン") {
      test("古いバージョンがインストールされている場合、アップデートが実行される", async () => {
        await runEngineTest(true);
      });
    }
  });
});
