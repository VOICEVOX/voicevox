import { join } from "path";
import fs from "fs";
import { app } from "electron";
import { moveFile } from "move-file";
import { BaseConfigManager, Metadata } from "@/backend/common/ConfigManager";
import { ConfigType } from "@/type/preload";

export class ElectronConfigManager extends BaseConfigManager {
  protected getAppVersion() {
    return app.getVersion();
  }

  protected async exists() {
    return await fs.promises
      .stat(this.configPath)
      .then(() => true)
      .catch(() => false);
  }

  protected async load(): Promise<Record<string, unknown> & Metadata> {
    return JSON.parse(await fs.promises.readFile(this.configPath, "utf-8"));
  }

  protected async save(config: ConfigType & Metadata) {
    // ファイル書き込みに失敗したときに設定が消えないように、tempファイル書き込み後上書き移動する
    const temp_path = `${this.configPath}.tmp`;
    await fs.promises.writeFile(
      temp_path,
      JSON.stringify(config, undefined, 2),
    );

    await moveFile(temp_path, this.configPath, {
      overwrite: true,
    });
  }

  private get configPath(): string {
    return join(app.getPath("userData"), "config.json");
  }
}

let configManager: ElectronConfigManager | undefined;

export function getConfigManager(): ElectronConfigManager {
  if (!configManager) {
    configManager = new ElectronConfigManager();
  }
  return configManager;
}
