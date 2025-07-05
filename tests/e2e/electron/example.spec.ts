import fs from "fs/promises";
import os from "os";
import path from "path";
import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { MessageBoxSyncOptions } from "electron";

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

  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await sut.waitForSelector("text=利用規約に関するお知らせ", {
    timeout: 180000, // 3分（ダウンロード時間を考慮）
  });

  await app.close();
}

// 古いバージョンのエンジンを配置するヘルパー関数
async function setupOldVersionEngine() {
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
  const vvppEngineDir = path.join(userDir, "vvpp-engines");

  // vvpp-enginesディレクトリを作成
  await fs.mkdir(vvppEngineDir, { recursive: true });

  // テスト用の古いエンジンディレクトリ名とmanifest
  const engineUuid = "208cf94d-43d2-4cf5-abc0-9783cac36d29";
  const engineName = "VOICEVOX Nemo Engine";
  const oldEngineDir = path.join(vvppEngineDir, `${engineName}+${engineUuid}`);
  
  // 古いエンジンディレクトリを作成
  await fs.mkdir(oldEngineDir, { recursive: true });

  // 古いバージョンのengine_manifest.jsonを作成
  const oldManifest = {
    manifest_version: "0.13.1",
    name: engineName,
    brand_name: "VOICEVOX",
    uuid: engineUuid,
    version: "0.20.0", // 意図的に古いバージョン
    url: "https://github.com/VOICEVOX/voicevox_engine",
    command: "run",
    port: 50121,
    icon: "resources/engine_manifest_assets/icon.png",
    default_sampling_rate: 24000,
    frame_rate: 93.75,
    terms_of_service: "resources/engine_manifest_assets/terms_of_service.md",
    update_infos: "resources/engine_manifest_assets/update_infos.json",
    dependency_licenses:
      "resources/engine_manifest_assets/dependency_licenses.json",
    supported_features: {},
  };

  const manifestPath = path.join(oldEngineDir, "engine_manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(oldManifest, null, 2));

  // ダミーのrunファイルを作成（エンジン起動エラーを避けるため）
  const runPath = path.join(oldEngineDir, "run");
  await fs.writeFile(runPath, "#!/bin/bash\necho 'Dummy engine'\nsleep 60\n");
  await fs.chmod(runPath, 0o755);
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
