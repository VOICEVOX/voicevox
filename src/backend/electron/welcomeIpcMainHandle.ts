import { app } from "electron";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { getConfigManager } from "./electronConfig";
import { IpcMainHandle } from "./ipc";
import { getWelcomeWindowManager } from "./manager/windowManager/welcome";
import { getAppStateController } from "./appStateController";
import type { WelcomeIpcIHData } from "@/welcome/backend/ipcType";
import { createLogger } from "@/helpers/log";

const log = createLogger("WelcomeIpcMainHandle");

export function getWelcomeIpcMainHandle(): IpcMainHandle<WelcomeIpcIHData> {
  const engineAndVvppController = getEngineAndVvppController();
  const configManager = getConfigManager();

  return {
    INSTALL_ENGINE: async (_, obj) => {
      const welcomeWindowManager = getWelcomeWindowManager();
      const packageStatuses =
        await engineAndVvppController.fetchEnginePackageStatuses();
      const status = packageStatuses.find(
        (s) => s.package.engineId === obj.engineId,
      );
      if (!status) {
        throw new Error(
          `Engine package status not found for engineId: ${obj.engineId}`,
        );
      }

      // ダウンロードしてインストールする
      let lastLogTime = 0; // とりあえずログを0.1秒に1回だけ出力する
      await engineAndVvppController.downloadAndInstallVvppEngine(
        app.getPath("downloads"),
        status.package.packageInfo,
        {
          onProgress: ({ type, progress }) => {
            if (Date.now() - lastLogTime > 100) {
              log.info(
                `VVPP default engine progress: ${type}: ${Math.floor(progress)}%`,
              );
              lastLogTime = Date.now();
              welcomeWindowManager.ipc.UPDATE_ENGINE_DOWNLOAD_PROGRESS({
                engineId: obj.engineId,
                progress,
                type,
              });
            }
          },
        },
      );
    },
    FETCH_LATEST_ENGINE_PACKAGE_STATUSES: async () => {
      return engineAndVvppController.fetchEnginePackageStatuses();
    },
    GET_CURRENT_THEME: async () => {
      return configManager.get("currentTheme");
    },
    SWITCH_TO_MAIN_WINDOW: async () => {
      // TODO: ちゃんと消していいかチェックしてからメインウィンドウを起動する
      const appStateController = getAppStateController();
      await appStateController.switchToMainWindow();
    },
  };
}
