import type {
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import type { EngineId } from "@/type/preload";
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";

export interface WelcomeSandbox {
  installEngine(obj: {
    engineId: EngineId;
    target: RuntimeTarget;
  }): Promise<void>;
  fetchEnginePackageLocalInfos(): Promise<EnginePackageCurrentInfo[]>;
  fetchLatestEnginePackageRemoteInfos(): Promise<EnginePackageLatestInfo[]>;
  launchMainWindow(): Promise<void>;
  getCurrentTheme(): Promise<string>;
  registerIpcHandler(listeners: {
    updateEngineDownloadProgress?: (obj: {
      engineId: EngineId;
      progress: number;
      type: "download" | "install";
    }) => void;
    detectMaximized?: () => void;
    detectUnmaximized?: () => void;
    detectEnterFullscreen?: () => void;
    detectLeaveFullscreen?: () => void;
  }): void;
  isMaximizedWindow(): Promise<boolean>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
}

export const welcomeSandboxKey = "welcomeBackend";
