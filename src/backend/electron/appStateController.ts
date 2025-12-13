import { app } from "electron";
import { ipcMainSendProxy } from "./ipc";
import { getWindowManager } from "./manager/windowManager";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { getConfigManager } from "./electronConfig";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";
import { Mutex } from "@/helpers/mutex";

const log = createLogger("AppStateController");

/**
 * アプリの状態を管理するシングルトン。
 *
 * TODO: アプリの起動処理をここに移す
 */
export class AppStateController {
  /**
   * アプリの終了状態を表す。
   * - unconfirmed：ユーザーが終了をリクエストした状態
   * - dirty：クリーンアップ前の状態
   * - done：クリーンアップ処理が完了し、アプリが終了する準備が整った状態
   */
  private quitState: "unconfirmed" | "dirty" | "done" = "unconfirmed";

  private lock = new Mutex();

  onQuitRequest(DI: { preventQuit: () => void }): void {
    if (this.lock.isLocked()) {
      log.info(
        "onQuitRequest is already being processed. Preventing duplicate quit request.",
      );
      DI.preventQuit();
      return;
    }
    log.info(`onQuitRequest called. Current quitState: ${this.quitState}`);
    switch (this.quitState) {
      case "unconfirmed": {
        DI.preventQuit();
        void (async () => {
          await using _lock = await this.lock.acquire();
          this.checkUnsavedEdit();
        })();
        break;
      }
      case "dirty": {
        log.info("Performing cleanup before quitting");
        DI.preventQuit();
        void (async () => {
          await using _lock = await this.lock.acquire();
          await this.onQuitRequestOnDirty();
        })();
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
    getWindowManager().destroyWindow();
    this.initiateQuit();
  }

  private initiateQuit() {
    // app.quit()を即座に呼び出すと、lockが解放される前にbefore-quitで再度onQuitRequestが呼ばれてしまうため、
    // setTimeoutで次のイベントループまで遅延させる
    setTimeout(() => {
      app.quit();
    }, 0);
  }

  private async onQuitRequestOnDirty() {
    log.info("Starting app cleanup process");
    try {
      await this.cleanup();
      log.info("App cleanup process completed");
    } catch (error) {
      log.error("Error during app cleanup process:", error);
    } finally {
      this.quitState = "done";
      this.initiateQuit();
    }
  }

  private async cleanup() {
    try {
      log.info("Cleaning up engines before quitting");
      await getEngineAndVvppController().cleanupEngines();
    } catch (error) {
      log.error("Error while cleaning up engines:", error);
    }
    try {
      log.info("Saving configuration before quitting");
      await getConfigManager().ensureSaved();
    } catch (error) {
      log.error("Error while saving configuration:", error);
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
