import { autoUpdater as electronUpdater } from "electron-updater";
import { DisplayableError } from "@/helpers/errorHelper";
import { createLogger } from "@/helpers/log";

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
});

electronUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info);
});

export class UpdateManager {
  constructor() {}
  async updateApp(version: string) {
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
