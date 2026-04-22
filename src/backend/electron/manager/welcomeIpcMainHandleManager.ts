import { app, BrowserWindow } from "electron";
import { getEngineAndVvppController } from "../engineAndVvppController";
import { getConfigManager } from "../electronConfig";
import { type IpcMainHandle, registerIpcMainHandle } from "../ipc";
import { getAppStateController } from "../appStateController";
import { getWelcomeWindowManager } from "./windowManager/welcome";
import type { WelcomeIpcIHData } from "@/welcome/backend/ipcType";
import { createLogger } from "@/helpers/log";
import { assertNonNullable } from "@/type/utility";

const log = createLogger("WelcomeIpcMainHandle");

class WelcomeIpcMainHandleManager {
  private getHandle(): IpcMainHandle<WelcomeIpcIHData> {
    const appStateController = getAppStateController();
    const engineAndVvppController = getEngineAndVvppController();
    const configManager = getConfigManager();

    return {
      INSTALL_ENGINE: async (_, obj) => {
        const welcomeWindowManager = getWelcomeWindowManager();
        const status =
          await engineAndVvppController.fetchEnginePackageLatestInfo(
            obj.engineId,
          );

        // ダウンロードしてインストールする
        let lastUpdateTime = 0;
        let lastLogTime = 0;
        const targetPackageInfo = status.availableRuntimeTargets.find(
          (targetInfo) => targetInfo.target === obj.target,
        );
        assertNonNullable(
          targetPackageInfo,
          `Runtime target not found for engineId: ${obj.engineId}, target: ${obj.target}`,
        );

        await engineAndVvppController.downloadAndInstallVvppEngine(
          app.getPath("downloads"),
          targetPackageInfo.packageInfo,
          {
            onProgress: ({ type, progress }) => {
              if (Date.now() - lastUpdateTime > 100) {
                lastUpdateTime = Date.now();
                welcomeWindowManager.ipc.UPDATE_ENGINE_DOWNLOAD_PROGRESS({
                  engineId: obj.engineId,
                  progress,
                  type,
                });
              } else if (Date.now() - lastLogTime > 1000) {
                lastLogTime = Date.now();
                log.info(
                  `Engine ${obj.engineId} ${type} progress: ${progress.toFixed(2)}%`,
                );
              }
            },
          },
        );
      },
      GET_ENGINE_PACKAGE_IDS: () => {
        return engineAndVvppController.getEnginePackageIds();
      },
      GET_ENGINE_PACKAGE_BUILD_INFO: (_, obj) => {
        return engineAndVvppController.getEnginePackageBuildInfo(obj.engineId);
      },
      GET_ENGINE_PACKAGE_CURRENT_INFO: (_, obj) => {
        return engineAndVvppController.getEnginePackageCurrentInfo(
          obj.engineId,
        );
      },
      GET_ENGINE_PACKAGE_LATEST_INFO: async (_, obj) => {
        return engineAndVvppController.fetchEnginePackageLatestInfo(
          obj.engineId,
        );
      },
      GET_CURRENT_THEME: async () => {
        return configManager.get("currentTheme");
      },
      SWITCH_TO_MAIN_WINDOW: async () => {
        await appStateController.switchToMainWindow();
      },
      MINIMIZE_WINDOW: () => {
        const welcomeWindowManager = getWelcomeWindowManager();
        welcomeWindowManager.minimize();
      },
      TOGGLE_MAXIMIZE_WINDOW: () => {
        const welcomeWindowManager = getWelcomeWindowManager();
        welcomeWindowManager.toggleMaximizeWindow();
      },
      CLOSE_WINDOW: () => {
        appStateController.shutdown();
      },
      IS_MAXIMIZED_WINDOW: () => {
        const welcomeWindowManager = getWelcomeWindowManager();
        return welcomeWindowManager.isMaximized();
      },
    };
  }

  attachTo(win: BrowserWindow) {
    registerIpcMainHandle<WelcomeIpcIHData>(win, this.getHandle());
  }
}

let manager: WelcomeIpcMainHandleManager | undefined;

export function initializeWelcomeIpcMainHandleManager() {
  manager = new WelcomeIpcMainHandleManager();
}

export function getWelcomeIpcMainHandleManager(): WelcomeIpcMainHandleManager {
  if (manager == undefined) {
    throw new Error("WelcomeIpcMainHandleManager is not initialized");
  }
  return manager;
}
