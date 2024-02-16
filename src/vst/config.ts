import AsyncLock from "async-lock";
import { defaultEngine } from "../browser/contract";

import { getConfig } from "./ipc";
import { BaseConfigManager, Metadata } from "@/shared/ConfigManager";
import { EngineId, engineSettingSchema } from "@/type/preload";

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
    // 本家（Electron版）が存在する前提で実装されているため、常にtrueを返す。
    // TODO: 本家が存在しない場合の挙動を検討する
    return true;
  }
  protected async load(): Promise<Record<string, unknown> & Metadata> {
    const memory = await getConfig();
    return memory;
  }

  protected async save(/* data: ConfigType & Metadata */) {
    // VST版には保存処理を実装しない
  }

  protected getDefaultConfig() {
    const baseConfig = super.getDefaultConfig();
    baseConfig.engineSettings[defaultEngineId] ??= engineSettingSchema.parse(
      {}
    );
    return baseConfig;
  }
}
