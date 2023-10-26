import { join } from "path";
import fs from "fs";
import { app, dialog, shell } from "electron";
import log from "electron-log/main";
import { BaseConfigManager, Metadata } from "@/shared/ConfigManager";
import { ConfigType } from "@/type/preload";

export class ElectronConfigManager extends BaseConfigManager {
  getAppVersion() {
    return app.getVersion();
  }

  public async exists() {
    return await fs.promises
      .stat(this.configPath)
      .then(() => true)
      .catch(() => false);
  }

  public async load(): Promise<Record<string, unknown> & Metadata> {
    return JSON.parse(await fs.promises.readFile(this.configPath, "utf-8"));
  }

  public async save(config: ConfigType) {
    await fs.promises.writeFile(
      this.configPath,
      JSON.stringify(config, undefined, 2)
    );
  }

  private get configPath(): string {
    return join(app.getPath("userData"), "config.json");
  }
}

let configManager: ElectronConfigManager | undefined;

export function getConfigManager(): ElectronConfigManager {
  try {
    if (!configManager) {
      configManager = new ElectronConfigManager();
    }
    return configManager;
  } catch (e) {
    log.error(e);
    app.whenReady().then(() => {
      dialog
        .showMessageBox({
          type: "error",
          title: "設定ファイルの読み込みエラー",
          message: `設定ファイルの読み込みに失敗しました。${app.getPath(
            "userData"
          )} にある config.json の名前を変えることで解決することがあります（ただし設定がすべてリセットされます）。設定ファイルがあるフォルダを開きますか？`,
          buttons: ["いいえ", "はい"],
          noLink: true,
          cancelId: 0,
        })
        .then(async ({ response }) => {
          if (response === 1) {
            await shell.openPath(app.getPath("userData"));
            // 直後にexitするとフォルダが開かないため
            await new Promise((resolve) => {
              setTimeout(resolve, 500);
            });
          }
        })
        .finally(async () => {
          await configManager?.ensureSaved();
          app.exit(1);
        });
    });
    throw e;
  }
}
