import AsyncLock from "async-lock";
import { defaultEngine } from "../browser/contract";

import { getConfig, setConfig } from "./ipc";
import { BaseConfigManager, Metadata } from "@/backend/common/ConfigManager";
import { ConfigType, EngineId, engineSettingSchema } from "@/type/preload";
import { UnreachableError } from "@/type/utility";

let configManager: VstConfigManager | undefined;
const configManagerLock = new AsyncLock();
const defaultEngineId = EngineId(defaultEngine.uuid);

export async function getConfigManager() {
  await configManagerLock.acquire("configManager", async () => {
    if (!configManager) {
      configManager = new VstConfigManager();
      await configManager.initialize();
    }
  });

  if (!configManager) {
    throw new Error("configManager is undefined");
  }

  return configManager;
}

class VstConfigManager extends BaseConfigManager {
  protected getAppVersion() {
    return import.meta.env.VITE_APP_VERSION;
  }
  protected async exists() {
    const memory = await getConfig();
    return memory != null;
  }
  protected async load(): Promise<Record<string, unknown> & Metadata> {
    const memory = await getConfig();
    if (!memory) {
      throw new UnreachableError("memory is null");
    }
    return memory;
  }

  protected async save(data: ConfigType & Metadata) {
    await setConfig(data);
  }

  protected getDefaultConfig() {
    const baseConfig = super.getDefaultConfig();
    baseConfig.engineSettings[defaultEngineId] ??= engineSettingSchema.parse(
      {},
    );
    return baseConfig;
  }
}
