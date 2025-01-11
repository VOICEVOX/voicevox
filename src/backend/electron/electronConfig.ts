import { join } from "path";
import fs from "fs";
import { app } from "electron";
import { writeFileSafely } from "./fileHelper";
import { BaseConfigManager, Metadata } from "@/backend/common/ConfigManager";
import { ConfigType } from "@/type/preload";
import { isMac } from "@/helpers/platform";

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(await fs.promises.readFile(this.configPath, "utf-8"));
  }

  protected async save(config: ConfigType & Metadata) {
    writeFileSafely(this.configPath, JSON.stringify(config, undefined, 2));
  }

  private get configPath(): string {
    return join(app.getPath("userData"), "config.json");
  }
}

let configManager: ElectronConfigManager | undefined;

export function getConfigManager(): ElectronConfigManager {
  if (!configManager) {
    configManager = new ElectronConfigManager({ isMac });
  }
  return configManager;
}
