import { createLogger } from "@/helpers/log";
import { autoUpdater, CancellationToken } from "electron-updater";

const log = createLogger("AutoUpdateManager");

// ログの設定
autoUpdater.logger = createLogger("electron-updater");
// 手動でアップデートをダウンロードするために自動ダウンロードを無効化
autoUpdater.autoDownload = false;
// アプリ終了時に自動的にインストールする挙動を無効化
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.forceDevUpdateConfig = true;

const cancel = new CancellationToken();

autoUpdater.on("error", (error) => {
  log.error("AutoUpdater error:", error);
});

autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info);
  info.files.map((file) => {
    log.info(`File: ${file.url} (${file.sha512})`);
  });
});

autoUpdater.on("download-progress", (progress) => {
  log.info("Download progress:", progress);
  cancel.cancel();
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info);

  const manager = getAutoUpdateManager();
  manager.updateDownloaded = true;
});

export class AutoUpdateManager {
  updateDownloaded: boolean = false;
  constructor() {}
  async downloadUpdate(version: string) {
    const latest = await autoUpdater.checkForUpdates();
    if (latest?.updateInfo.version !== version) {
      throw new Error(`Version ${version} is not latest version.`);
    }
    await autoUpdater.downloadUpdate(cancel);
  }
  quitAndInstall() {
    if (!this.updateDownloaded) {
      throw new Error("No update downloaded to install.");
    }
    log.info("Quitting and installing update...");
    autoUpdater.quitAndInstall();
  }
}

let managerInstance: AutoUpdateManager | null = null;
export function getAutoUpdateManager(): AutoUpdateManager {
  if (managerInstance === null) {
    managerInstance = new AutoUpdateManager();
  }
  return managerInstance;
}
