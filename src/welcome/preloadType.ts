import type { EngineId } from "@/type/preload";

export interface WelcomeSandbox {
  installEngine(obj: { filePath: string }): Promise<void>;
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

export const WelcomeSandboxKey = "welcomeBackend";
