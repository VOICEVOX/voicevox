import { join } from "path";
import fs from "fs";
import { app, dialog, shell } from "electron";
import log from "electron-log";
import { Config } from "@/infrastructures/Config";
import { ConfigType } from "@/type/preload";

export class ElectronConfig extends Config {
  public configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  public loadConfig(): Record<string, unknown> & {
    __internal__: { migrations: { version: string } };
  } {
    return JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  public save(data: ConfigType) {
    fs.writeFileSync(this.configPath, JSON.stringify(data, undefined, 2));
  }

  private get configPath(): string {
    return join(app.getPath("userData"), "config.json");
  }
}

let store: ElectronConfig | undefined;

export function getConfigWithError(): ElectronConfig {
  try {
    if (!store) {
      store = new ElectronConfig();
    }
    return store;
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
        .finally(() => {
          app.exit(1);
        });
    });
    throw e;
  }
}
