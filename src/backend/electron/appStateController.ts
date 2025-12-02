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
    log.info(`onQuitRequest called. Current quitState: ${this.quitState}`);
    switch (this.quitState) {
      case "unsaved": {
        log.info("Checking for unsaved edits before quitting");
        DI.preventQuit();
        try {
          ipcMainSendProxy.CHECK_EDITED_AND_NOT_SAVE(
            getWindowManager().getWindow(),
            {
              closeOrReload: "close",
            },
          );
        } catch (error) {
          log.error(
            "Error while sending CHECK_EDITED_AND_NOT_SAVE IPC message:",
            error,
          );
          log.info("Proceeding to shutdown without checking for unsaved edits");
          this.shutdown();
        }
        break;
      }
      case "clean": {
        log.info("Performing cleanup before quitting");
        DI.preventQuit();
        this.quitState = "done";
        return this.cleanupEngine();
      }
      case "done":
        log.info("Quit process already done. Proceeding to quit.");
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
