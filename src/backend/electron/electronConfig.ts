import { join } from "path";
import fs from "fs";
import { app } from "electron";
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
  if (!configManager) {
    configManager = new ElectronConfigManager();
  }
  return configManager;
}
