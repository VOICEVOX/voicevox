import { EnginePackageStatus } from "@/backend/electron/engineAndVvppController";
import type { EngineId } from "@/type/preload";

export interface WelcomeSandbox {
  installEngine(obj: { engineId: EngineId; target: string }): Promise<void>;
  fetchLatestEnginePackageStatuses(): Promise<EnginePackageStatus[]>;
  registerIpcHandler(listeners: {
    updateEngineDownloadProgress: (obj: {
      engineId: EngineId;
      progress: number;
    }) => void;
  }): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
}

export const welcomeSandboxKey = "welcomeBackend";
