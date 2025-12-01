import { app } from "electron";
import { ipcMainSendProxy } from "./ipc";
import { getWindowManager } from "./manager/windowManager";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";

const log = createLogger("AppStateController");

export class AppStateController {
  private quitState: "unsaved" | "clean" | "done" = "unsaved";

  onQuitRequest(DI: { preventQuit: () => void }): Promise<void> {
    switch (this.quitState) {
      case "unsaved": {
        DI.preventQuit();
        ipcMainSendProxy.CHECK_EDITED_AND_NOT_SAVE(
          getWindowManager().getWindow(),
          {
            closeOrReload: "close",
          },
        );
        break;
      }
      case "clean": {
        this.quitState = "done";
        return this.cleanupEngine();
      }
      case "done":
        break;
      default:
        throw new ExhaustiveError(this.quitState);
    }
    return Promise.resolve();
  }

  shutdown() {
    this.quitState = "clean";
    this.initiateQuit();
  }

  private initiateQuit() {
    app.quit();
  }

  private async cleanupEngine() {
    log.info("Checking ENGINE status before app quit");
    const { engineCleanupResult, configSavedResult } =
      getEngineAndVvppController().gracefulShutdown();

    // - エンジンの停止
    // - エンジン終了後処理
    // - 設定ファイルの保存
    // が完了している
    if (
      engineCleanupResult === "alreadyCompleted" &&
      configSavedResult === "alreadySaved"
    ) {
      log.info("Post engine kill process and config save done. Quitting app");
      this.quitState = "done";
      this.initiateQuit();
      return;
    }

    // すべてのエンジンプロセスのキルを開始
    if (engineCleanupResult !== "alreadyCompleted") {
      log.info("Waiting for post engine kill process");
      await engineCleanupResult;
    }
    if (configSavedResult !== "alreadySaved") {
      log.info("Waiting for config save");
      await configSavedResult;
    }

    // アプリケーションの終了を再試行する
    log.info("Attempting to quit app again");
    app.quit();
  }
}

let appStateController: AppStateController | null = null;

export function getAppStateController() {
  if (appStateController == null) {
    appStateController = new AppStateController();
  }
  return appStateController;
}
