import fs from "fs/promises";
import path from "path";
import { autoUpdater as electronUpdater } from "electron-updater";
import { ipcMainSendProxy } from "../ipc";
import { getWindowManager } from "./windowManager";
import { DisplayableError, errorToMessage } from "@/helpers/errorHelper";
import { createLogger } from "@/helpers/log";
import { isProduction, isMac } from "@/helpers/platform";

const log = createLogger("AutoUpdateManager");

// ログの設定
electronUpdater.logger = createLogger("electron-updater");
// 手動でアップデートをダウンロードするために自動ダウンロードを無効化
electronUpdater.autoDownload = false;
// アプリ終了時に自動的にインストールする挙動を無効化
electronUpdater.autoInstallOnAppQuit = false;
// 開発版でもアップデートを有効化する
electronUpdater.forceDevUpdateConfig = true;

electronUpdater.on("error", (error) => {
  log.error("AutoUpdater error:", error);
  void getWindowManager().showMessageBox({
    message: `アップデート中にエラーが発生しました。\n${errorToMessage(error)}`,
    type: "error",
  });
});

electronUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info);
});

electronUpdater.on("download-progress", (info) => {
  const win = getWindowManager().win;
  if (win == null) {
    log.error("Window is not available for sending download progress.");
    return;
  }
  ipcMainSendProxy.ON_UPDATE_DOWNLOAD_PROGRESS(win, {
    numBytes: info.transferred,
    totalBytes: info.total,
  });
  log.info(
    `Download progress: ${info.percent}% (${info.bytesPerSecond} bytes/s)`,
  );
});

export class UpdateManager {
  constructor() {}
  async updateApp(version: string) {
    if (isMac) {
      throw new DisplayableError(
        `macOSではアプリ内からのアップデートはサポートされていません。`,
      );
    }

    const appUpdateYmlExists = await fs
      .stat(path.join(process.resourcesPath, "app-update.yml"))
      .catch(() => false);

    if (isProduction && !appUpdateYmlExists) {
      log.error(
        "app-update.yml does not exist in resources path, probably not an installer build.",
      );
      throw new DisplayableError(
        `アプリ内からのアップデートはインストーラー版でのみ利用可能です。`,
      );
    }

    const latest = await electronUpdater.checkForUpdates();
    if (latest == null || latest.updateInfo == null) {
      log.error("Assertion failed: Latest update info is null");
      throw new DisplayableError(
        `アップデートサーバーからの情報が取得できませんでした。時間をおいてからもう一度やり直してください。`,
      );
    }
    if (latest.updateInfo.version !== version) {
      log.error(
        `Assertion failed: Server's latest: ${latest?.updateInfo.version}, Current: ${version}`,
      );
      throw new DisplayableError(
        `アップデートサーバーのバージョンが現在のバージョンと異なります。時間をおいてからもう一度やり直してください。`,
      );
    }

    await electronUpdater.downloadUpdate();
    log.info("Quitting and installing update...");
    electronUpdater.quitAndInstall();
  }
}

let managerInstance: UpdateManager | null = null;
export function getUpdateManager(): UpdateManager {
  if (managerInstance == null) {
    managerInstance = new UpdateManager();
  }
  return managerInstance;
}
