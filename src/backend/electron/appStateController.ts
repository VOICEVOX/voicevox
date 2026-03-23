import { app } from "electron";
import { getMainWindowManager } from "./manager/windowManager/main";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { getConfigManager } from "./electronConfig";
import { getWelcomeWindowManager } from "./manager/windowManager/welcome";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";
import { Mutex } from "@/helpers/mutex";

const log = createLogger("AppStateController");

/**
 * アプリの状態を管理するシングルトン。
 */
export class AppStateController {
  /**
   * アプリの終了状態を表す。
   * - unconfirmed：ユーザーが終了をリクエストした状態
   * - dirty：クリーンアップ前の状態
   * - done：クリーンアップ処理が完了し、アプリが終了する準備が整った状態
   * - switch: ウィンドウ切替のために終了処理をキャンセルしている状態
   */
  private quitState: "unconfirmed" | "dirty" | "done" | "switch" =
    "unconfirmed";
  /** 現在アクティブなウィンドウ */
  private activeWindow: "main" | "welcome" | null = null;

  private lock = new Mutex();

  /**
   * アプリ起動時の初期化処理を行う。
   *
   * 責務:
   * - エンジンパッケージの状態を確認し、適切なウィンドウを起動する
   *
   * 副作用:
   * - ウィンドウを起動する（`launchMainWindow()` または `launchWelcomeWindow()`）
   */
  async startup() {
    const engineAndVvppController = getEngineAndVvppController();
    if (engineAndVvppController.hasInstalledDefaultEngine()) {
      log.info("Default engine found. Launching main window.");
      await this.launchMainWindow();
    } else {
      log.info("No default engine found. Launching welcome window.");
      await this.launchWelcomeWindow();
    }
  }

  /**
   * メインウィンドウに切り替える。
   *
   * 責務:
   * - ウェルカムウィンドウを破棄する（`welcomeWindowManager.destroyWindow()`）
   * - メインウィンドウを起動する（`launchMainWindow()`）
   *
   * 副作用:
   * - `quitState` を "switch" に設定して、切り替え中であることを示す
   * - ウィンドウの切り替えが完了した後に `quitState` を "unconfirmed" にリセットする
   */
  async switchToMainWindow() {
    log.info("Switching to main window");
    this.quitState = "switch";

    const welcomeWindowManager = getWelcomeWindowManager();
    if (welcomeWindowManager.isInitialized()) {
      log.info("Destroying welcome window");
      welcomeWindowManager.destroyWindow();
    }

    await this.launchMainWindow();
    this.quitState = "unconfirmed";
  }

  /**
   * ウェルカムウィンドウに切り替える。
   *
   * 責務:
   * - メインウィンドウを破棄し、必要なエンジンをクリーンアップする（`mainWindowManager.destroyWindow()` と `engineAndVvppController.cleanupEngines()`）
   * - ウェルカムウィンドウを起動する（`launchWelcomeWindow()`）
   *
   *副作用:
   * - `quitState` を "switch" に設定して、切り替え中であることを示す
   * - ウィンドウの切り替えが完了した後に `quitState` を "unconfirmed" にリセットする
   */
  async switchToWelcomeWindow() {
    log.info("Switching to welcome window");
    this.quitState = "switch";

    const mainWindowManager = getMainWindowManager();
    if (mainWindowManager.isInitialized()) {
      log.info("Destroying main window and cleaning up engines");
      const engineAndVvppController = getEngineAndVvppController();
      mainWindowManager.destroyWindow();
      await engineAndVvppController.cleanupEngines();
    }

    await this.launchWelcomeWindow();
    this.quitState = "unconfirmed";
  }

  /**
   * ウェルカムウィンドウを起動する。
   *
   * 責務:
   * - ウェルカムウィンドウを作成する（`welcomeWindowManager.createWindow()`）
   *
   * 副作用:
   * - `activeWindow` を "welcome" に設定する
   */
  private async launchWelcomeWindow() {
    this.activeWindow = "welcome";

    const welcomeWindowManager = getWelcomeWindowManager();
    await welcomeWindowManager.createWindow();
  }

  /**
   * メインウィンドウを起動する。
   *
   * 責務:
   * - エンジンを起動する（`engineAndVvppController.launchEngines()`）
   * - メインウィンドウを作成する（`mainWindowManager.createWindow()`）
   *
   * 副作用:
   * - `activeWindow` を "main" に設定する
   */
  private async launchMainWindow() {
    this.activeWindow = "main";

    const engineAndVvppController = getEngineAndVvppController();
    const mainWindowManager = getMainWindowManager();
    await engineAndVvppController.launchEngines();
    await mainWindowManager.createWindow();
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
          if (this.activeWindow === "main") {
            this.checkUnsavedEdit();
          } else {
            log.info("Main window is not active. Proceeding to shutdown.");
            this.shutdown();
          }
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
      case "switch":
        log.info("Quit process is in switch state. Preventing quit request.");
        DI.preventQuit();
        break;
      default:
        throw new ExhaustiveError(this.quitState);
    }
  }

  private checkUnsavedEdit() {
    log.info("Checking for unsaved edits before quitting");
    const mainWindowManager = getMainWindowManager();
    try {
      // TODO: ipcの送信以外で失敗した場合はシャットダウンしないようにする
      mainWindowManager.ipc.CHECK_EDITED_AND_NOT_SAVE({
        nextAction: "close",
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

export function initializeAppStateController() {
  appStateController = new AppStateController();
}

export function getAppStateController() {
  if (appStateController == undefined) {
    throw new Error("AppStateController is not initialized");
  }
  return appStateController;
}
