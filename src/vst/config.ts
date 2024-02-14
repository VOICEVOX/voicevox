import AsyncLock from "async-lock";
import { defaultEngine } from "../browser/contract";

import { getMemory, setMemory } from "./ipc";
import { BaseConfigManager, Metadata } from "@/shared/ConfigManager";
import { ConfigType, EngineId, engineSettingSchema } from "@/type/preload";

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
    const memory = await getMemory();
    return memory.config != undefined;
  }
  protected async load(): Promise<Record<string, unknown> & Metadata> {
    const memory = await getMemory();
    return memory.config;
  }

  protected async save(data: ConfigType & Metadata) {
    const memory = await getMemory();
    memory.config = data;
    setMemory(memory);
  }

  protected getDefaultConfig() {
    const baseConfig = super.getDefaultConfig();
    baseConfig.engineSettings[defaultEngineId] ??= engineSettingSchema.parse(
      {}
    );
    return baseConfig;
  }
}
