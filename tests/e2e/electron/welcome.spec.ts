import fs from "node:fs/promises";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { getUserTestDir } from "./helper";

const defaultEngineId = "208cf94d-43d2-4cf5-abc0-9783cac36d29";
const oldEngineDirName = `VOICEVOX_Nemo_Engine+${defaultEngineId}`;
const oldEngineSourceDir = "./tests/e2e/electron/oldEngine";

const installOldEngine = async () => {
  const vvppEngineDir = path.join(getUserTestDir(), "vvpp-engines");
  await fs.mkdir(vvppEngineDir, { recursive: true });
  await fs.cp(oldEngineSourceDir, path.join(vvppEngineDir, oldEngineDirName), {
    recursive: true,
  });
};

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

test("エディタウィンドウを起動できる", async () => {
  const app = await electron.launch({
    args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
    timeout: process.env.CI ? 0 : 60000,
  });

  const welcomePage =
    await test.step("デフォルトエンジンをインストールする", async () => {
      app.on("console", (msg) => {
        console.log(msg.text());
      });

      const welcomePage = await app.firstWindow({
        timeout: process.env.CI ? 90000 : 60000,
      });
      await welcomePage.waitForSelector("text=エンジンのセットアップ", {
        timeout: 60000,
      });

      const install = welcomePage.getByText(/インストール（.+?）/);
      await install.waitFor({
        timeout: 60000,
      });
      await install.click();

      const reinstall = welcomePage.getByText(/再インストール（.+?）/);
      await reinstall.waitFor({
        timeout: 60000,
      });

      return welcomePage;
    });

  await test.step("エディタを起動する", async () => {
    const launchEditor = welcomePage.getByText(/エディタを起動/);
    await expect(launchEditor).toBeEnabled({
      timeout: 60000,
    });
    await launchEditor.click();
  });

  await test.step("エディタウィンドウが開く", async () => {
    const editorPage = await app.waitForEvent("window", {
      timeout: process.env.CI ? 90000 : 60000,
    });
    await editorPage.waitForSelector("text=利用規約に関するお知らせ", {
      timeout: 60000,
    });
  });

  await app.close();
});

test("Welcome画面でエンジンをアップデートできる", async () => {
  await test.step("古いエンジンを配置する", async () => {
    await installOldEngine();
  });

  const app = await electron.launch({
    args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
    timeout: process.env.CI ? 0 : 60000,
  });

  // ダミーエンジンは起動できずに異常終了するため、エラーダイアログが表示される。
  // これをモックしてテストが失敗しないようにする。
  //
  // NOTE: このモックが差し込まれる前にエンジンが起動して異常終了する可能性がある
  // TODO: ほかの方法でエラーダイアログを抑制できないか検討する
  await app.evaluate((electron) => {
    electron.dialog.showErrorBox = (title: string, content: string) => {
      if (title === "音声合成エンジンエラー") {
        return;
      }

      throw new Error(`Unexpected dialog: title=${title}, content=${content}`);
    };
  });

  app.on("console", (msg) => {
    console.log(msg.text());
  });

  const welcomePage = await test.step("Welcome画面に移動する", async () => {
    const mainPage = await app.firstWindow({
      timeout: process.env.CI ? 90000 : 60000,
    });

    const engineMenu = mainPage.getByText("エンジン", { exact: true });
    await engineMenu.waitFor({
      timeout: 60000,
    });
    await engineMenu.click();

    const moveToWelcomePage = mainPage.getByText(/エンジンのセットアップ/);
    await moveToWelcomePage.waitFor({
      timeout: 60000,
    });
    await moveToWelcomePage.click();

    const welcomePage = await app.waitForEvent("window", {
      timeout: process.env.CI ? 90000 : 60000,
    });
    await welcomePage.waitForSelector("text=エンジンのセットアップ", {
      timeout: 60000,
    });
    return welcomePage;
  });

  await test.step("アップデートを実行する", async () => {
    const updateButton = welcomePage.getByText(/アップデート（.+?）/);
    await updateButton.waitFor({
      timeout: 60000,
    });
    await updateButton.click();
  });

  await test.step("アップデート後の状態に切り替わる", async () => {
    const reinstallButton = welcomePage.getByText(/再インストール（.+?）/);
    await reinstallButton.waitFor({
      timeout: 60000,
    });
  });

  await test.step("エディタを起動する", async () => {
    const launchEditor = welcomePage.getByText(/エディタを起動/);
    await expect(launchEditor).toBeEnabled({
      timeout: 60000,
    });
    await launchEditor.click();

    const editorPage = await app.waitForEvent("window", {
      timeout: process.env.CI ? 90000 : 60000,
    });
    await editorPage.waitForSelector("text=利用規約に関するお知らせ", {
      timeout: 60000,
    });
  });

  await app.close();
});
