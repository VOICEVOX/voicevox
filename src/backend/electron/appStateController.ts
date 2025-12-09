import { app } from "electron";
import { ipcMainSendProxy } from "./ipc";
import { getWindowManager } from "./manager/windowManager";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";

const log = createLogger("AppStateController");

// アプリの状態を管理するシングルトン。
//
// TODO: アプリの起動処理をここに移す
export class AppStateController {
  // NOTE:
  // - unconfirmed：ユーザーが終了をリクエストした状態
  // - dirty：クリーンアップ前の状態
  // - done：クリーンアップ処理が完了し、アプリが終了する準備が整った状態
  private quitState: "unconfirmed" | "dirty" | "done" = "unconfirmed";

  onQuitRequest(DI: { preventQuit: () => void }): void {
    log.info(`onQuitRequest called. Current quitState: ${this.quitState}`);
    switch (this.quitState) {
      case "unconfirmed": {
        DI.preventQuit();
        this.checkUnsavedEdit();
        break;
      }
      case "dirty": {
        log.info("Performing cleanup before quitting");
        DI.preventQuit();
        void this.cleanup();
        break;
      }
      case "done":
        log.info("Quit process already done. Proceeding to quit.");
        break;
      default:
        throw new ExhaustiveError(this.quitState);
    }
  }

  private checkUnsavedEdit() {
    log.info("Checking for unsaved edits before quitting");
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
  }

  /** 編集状態に関わらず終了する */
  shutdown() {
    this.quitState = "dirty";
    this.initiateQuit();
  }

  private initiateQuit() {
    app.quit();
  }

  private async cleanupEngine() {
    log.info("Checking ENGINE status before app quit");
    const { engineCleanupResult, configSavedResult } =
      getEngineAndVvppController().gracefulShutdown();

    // すべてのエンジンプロセスのキルを開始
    if (engineCleanupResult !== "alreadyCompleted") {
      log.info("Waiting for post engine kill process");
      await engineCleanupResult;
    }
    if (configSavedResult !== "alreadySaved") {
      log.info("Waiting for config save");
      await configSavedResult;
    }
  }

  private async cleanup() {
    log.info("Starting app cleanup process");
    try {
      await this.cleanupEngine();
      log.info("App cleanup process completed");
    } catch (error) {
      log.error("Error during app cleanup process:", error);
    } finally {
      this.quitState = "done";
      this.initiateQuit();
    }
  }
}

let appStateController: AppStateController | null = null;

export function getAppStateController() {
  if (appStateController == null) {
    appStateController = new AppStateController();
  }
  return appStateController;
}
