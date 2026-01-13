import {
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import type { EngineId } from "@/type/preload";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";

export interface WelcomeSandbox {
  installEngine(obj: {
    engineId: EngineId;
    target: RuntimeTarget;
  }): Promise<void>;
  fetchEnginePackageLocalInfos(): Promise<EnginePackageLocalInfo[]>;
  fetchLatestEnginePackageRemoteInfos(): Promise<EnginePackageRemoteInfo[]>;
  launchMainWindow(): Promise<void>;
  getCurrentTheme(): Promise<string>;
  registerIpcHandler(listeners: {
    updateEngineDownloadProgress: (obj: {
      engineId: EngineId;
      progress: number;
      type: "download" | "install";
    }) => void;
  }): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
}

export const welcomeSandboxKey = "welcomeBackend";
