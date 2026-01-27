import { app, BrowserWindow } from "electron";
import { getEngineAndVvppController } from "../engineAndVvppController";
import { getConfigManager } from "../electronConfig";
import { IpcMainHandle, registerIpcMainHandle } from "../ipc";
import { getAppStateController } from "../appStateController";
import { getWelcomeWindowManager } from "./windowManager/welcome";
import type { WelcomeIpcIHData } from "@/welcome/backend/ipcType";
import { createLogger } from "@/helpers/log";

const log = createLogger("WelcomeIpcMainHandle");

class WelcomeIpcMainHandleManager {
  getHandle(): IpcMainHandle<WelcomeIpcIHData> {
    const appStateController = getAppStateController();
    const engineAndVvppController = getEngineAndVvppController();
    const configManager = getConfigManager();

    return {
      INSTALL_ENGINE: async (_, obj) => {
        const welcomeWindowManager = getWelcomeWindowManager();
        const packageStatuses =
          await engineAndVvppController.fetchLatestEnginePackageRemoteInfos();
        const status = packageStatuses.find(
          (s) => s.package.engineId === obj.engineId,
        );
        if (!status) {
          throw new Error(
            `Engine package status not found for engineId: ${obj.engineId}`,
          );
        }

        let lastUpdateTime = 0;
        let lastLogTime = 0;
        const targetPackageInfo =
          status.availableRuntimeTargets.find(
            (targetInfo) => targetInfo.target === obj.target,
          ) ?? status.availableRuntimeTargets[0];

        if (!targetPackageInfo) {
          throw new Error(
            `Runtime target not found for engineId: ${obj.engineId}`,
          );
        }

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
      FETCH_ENGINE_PACKAGE_LOCAL_INFOS: () => {
        return engineAndVvppController.getEnginePackageLocalInfos();
      },
      FETCH_LATEST_ENGINE_PACKAGE_REMOTE_INFOS: async () => {
        return engineAndVvppController.fetchLatestEnginePackageRemoteInfos();
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

  registerToWindow(win: BrowserWindow) {
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
