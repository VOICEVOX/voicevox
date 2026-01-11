import { app } from "electron";
import { getMainWindowManager } from "./manager/windowManager/main";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { getConfigManager } from "./electronConfig";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";
import { Mutex } from "@/helpers/mutex";
import { getWelcomeWindowManager } from "./manager/windowManager/welcome";

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

  async startup() {
    const engineAndVvppController = getEngineAndVvppController();
    const packageStatuses =
      await engineAndVvppController.fetchEnginePackageStatuses();

    const areAllEnginesLatest = packageStatuses.every((status) => {
      return status.installed.status === "latest";
    });
    if (areAllEnginesLatest) {
      log.info(
        "All default engines are already at the latest version. Skipping welcome screen.",
      );
      await this.launchMainWindow();
    } else {
      log.info("Some default engines are not at the latest version.");
      await this.launchWelcomeWindow();
    }
  }

  async launchWelcomeWindow() {
    const welcomeWindowManager = getWelcomeWindowManager();
    await welcomeWindowManager.createWindow();
  }

  async launchMainWindow() {
    const engineAndVvppController = getEngineAndVvppController();
    const windowManager = getMainWindowManager();

    await engineAndVvppController.launchEngines();
    await windowManager.createWindow();
  }

  onQuitRequest(DI: { preventQuit: () => void }): void {
    log.info(`onQuitRequest called. Current quitState: ${this.quitState}`);

    // NOTE: 同時リクエストされうることを考慮
    if (this.lock.isLocked()) {
      log.info(
        "onQuitRequest is already being processed. Preventing duplicate quit request.",
      );
      DI.preventQuit();
      return;
    }

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
    const mainWindowManager = getMainWindowManager();
    if (mainWindowManager.isInitialized()) {
      try {
        mainWindowManager.ipc.CHECK_EDITED_AND_NOT_SAVE({
          closeOrReload: "close",
        });
      } catch (error) {
        log.error(
          "Error while sending CHECK_EDITED_AND_NOT_SAVE IPC message:",
          error,
        );
        void mainWindowManager
          .showMessageBox({
            type: "error",
            title: "保存の確認に失敗しました",
            message:
              "未保存のデータがある場合、終了すると失われます。終了しますか？",
            buttons: ["終了しない", "終了する"],
            defaultId: 0,
            cancelId: 0,
          })
          .then((result) => {
            if (result.response === 1) {
              log.info("User confirmed to quit despite the error");
              this.shutdown();
            } else {
              log.info("User canceled quit due to the error");
            }
          });
      }
    } else {
      log.info(
        "Main window is not initialized. Proceeding to shutdown without checking for unsaved edits.",
      );
      this.shutdown();
    }
  }

  /** 編集状態に関わらず終了する */
  shutdown() {
    const mainWindowManager = getMainWindowManager();
    this.quitState = "dirty";
    if (mainWindowManager.isInitialized()) {
      mainWindowManager.destroyWindow();
    }
    this.initiateQuit();
  }

  /** アプリの終了を非同期に開始する */
  private initiateQuit() {
    // app.quit()を即座に呼び出すと、lockが解放される前にbefore-quitで再度onQuitRequestが呼ばれてしまうため、
    // setTimeoutで次のイベントループまで遅延させる
    setTimeout(() => {
      app.quit();
    }, 0);
  }

  /** クリーンアップ処理を行い、その後アプリを終了する */
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

  /** 後片付けを行う */
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

let appStateController: AppStateController | undefined;

export function getAppStateController() {
  if (appStateController == undefined) {
    appStateController = new AppStateController();
  }
  return appStateController;
}
