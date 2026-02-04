import path from "node:path";
import {
  BrowserWindow,
  dialog,
  type MessageBoxOptions,
  type MessageBoxSyncOptions,
  type OpenDialogOptions,
  type OpenDialogSyncOptions,
  type SaveDialogOptions,
} from "electron";
import { getConfigManager } from "../../electronConfig";
import { getAppStateController } from "../../appStateController";
import {
  createIpcSendProxy,
  type IpcMainHandle,
  type IpcSendProxy,
  registerIpcMainHandle,
} from "../../ipc";
import { themes } from "@/domain/theme";
import type {
  WelcomeIpcIHData,
  WelcomeIpcSOData,
} from "@/welcome/backend/ipcType";

type WindowManagerOption = {
  staticDir: string;
  isDevelopment: boolean;
  isTest: boolean;
  ipcMainHandle: IpcMainHandle<WelcomeIpcIHData>;
};

class WelcomeWindowManager {
  private _win: BrowserWindow | undefined;
  private _ipc: IpcSendProxy<WelcomeIpcSOData> | undefined;
  private staticDir: string;
  private isDevelopment: boolean;
  private isTest: boolean;
  private ipcMainHandle: IpcMainHandle<WelcomeIpcIHData>;

  constructor(payload: WindowManagerOption) {
    this.staticDir = payload.staticDir;
    this.isDevelopment = payload.isDevelopment;
    this.isTest = payload.isTest;
    this.ipcMainHandle = payload.ipcMainHandle;
  }

  /**
   * BrowserWindowを取得する
   */
  public get win() {
    return this._win;
  }

  public isInitialized() {
    return this._win != undefined;
  }

  /**
   * BrowserWindowを取得するが存在しない場合は例外を投げる
   */
  public getWindow() {
    if (this._win == undefined) {
      throw new Error("_win == undefined");
    }
    return this._win;
  }

  /**
   * BrowserWindowのIPC送信用プロキシを取得する
   */
  public get ipc() {
    if (this._ipc == undefined) {
      throw new Error("_ipc == undefined");
    }
    return this._ipc;
  }

  public async createWindow() {
    if (this.win != undefined) {
      throw new Error("Window has already been created");
    }
    const configManager = getConfigManager();
    const currentTheme = configManager.get("currentTheme");
    const backgroundColor = themes.find((value) => value.name == currentTheme)
      ?.colors.background;

    const win = new BrowserWindow({
      minWidth: 320,
      backgroundColor,
      webPreferences: {
        preload: path.join(import.meta.dirname, "welcomePreload.cjs"),
      },
      icon: path.join(this.staticDir, "icon.png"),
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 6, y: 4 },
      frame: false,
    });
    const ipc = createIpcSendProxy<WelcomeIpcSOData>(win);
    this._ipc = ipc;
    registerIpcMainHandle<WelcomeIpcIHData>(win, this.ipcMainHandle);

    win.on("maximize", () => {
      ipc.DETECT_MAXIMIZED();
    });
    win.on("unmaximize", () => {
      ipc.DETECT_UNMAXIMIZED();
    });
    win.on("enter-full-screen", () => {
      ipc.DETECT_ENTER_FULLSCREEN();
    });
    win.on("leave-full-screen", () => {
      ipc.DETECT_LEAVE_FULLSCREEN();
    });
    win.on("close", (event) => {
      const appStateController = getAppStateController();
      void appStateController.onQuitRequest({
        preventQuit: () => event.preventDefault(),
      });
    });
    win.on("closed", () => {
      this._win = undefined;
      this._ipc = undefined;
    });
    this._win = win;

    await this.load();

    if (this.isDevelopment && !this.isTest) win.webContents.openDevTools();
  }

  public async load() {
    const win = this.getWindow();
    let firstUrl: URL;
    if (import.meta.env.VITE_DEV_SERVER_URL != undefined) {
      firstUrl = new URL(import.meta.env.VITE_DEV_SERVER_URL);
      firstUrl.pathname = "/welcome/index.html";
    } else {
      firstUrl = new URL(`app://./welcome/index.html`);
    }
    await win.loadURL(firstUrl.toString());
  }

  public async reload() {
    const win = this.getWindow();
    win.hide(); // FIXME: ダミーページ表示のほうが良い

    // 一旦適当なURLに飛ばしてページをアンロードする
    await win.loadURL("about:blank");

    await this.load();
    win.show();
  }

  public togglePinWindow() {
    const win = this.getWindow();
    if (win.isAlwaysOnTop()) {
      win.setAlwaysOnTop(false);
    } else {
      win.setAlwaysOnTop(true);
    }
  }

  public toggleMaximizeWindow() {
    const win = this.getWindow();
    // 全画面表示中は、全画面表示解除のみを行い、最大化解除処理は実施しない
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    } else if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }

  public toggleFullScreen() {
    const win = this.getWindow();
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    } else {
      win.setFullScreen(true);
    }
  }

  public restoreAndFocus() {
    const win = this.getWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  }

  public zoomIn() {
    const win = this.getWindow();
    win.webContents.setZoomFactor(
      Math.min(Math.max(win.webContents.getZoomFactor() + 0.1, 0.5), 3),
    );
  }

  public zoomOut() {
    const win = this.getWindow();
    win.webContents.setZoomFactor(
      Math.min(Math.max(win.webContents.getZoomFactor() - 0.1, 0.5), 3),
    );
  }

  public zoomReset() {
    const win = this.getWindow();
    win.webContents.setZoomFactor(1);
  }

  public destroyWindow() {
    this.getWindow().destroy();
  }

  public show() {
    this.getWindow().show();
  }

  public minimize() {
    this.getWindow().minimize();
  }

  public isMaximized() {
    return this.getWindow().isMaximized();
  }

  public showOpenDialogSync(options: OpenDialogSyncOptions) {
    return this._win == undefined
      ? dialog.showOpenDialogSync(options)
      : dialog.showOpenDialogSync(this.getWindow(), options);
  }

  public showOpenDialog(options: OpenDialogOptions) {
    return this._win == undefined
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(this.getWindow(), options);
  }

  public showSaveDialog(options: SaveDialogOptions) {
    return this._win == undefined
      ? dialog.showSaveDialog(options)
      : dialog.showSaveDialog(this.getWindow(), options);
  }

  public showMessageBoxSync(options: MessageBoxSyncOptions) {
    return this._win == undefined
      ? dialog.showMessageBoxSync(options)
      : dialog.showMessageBoxSync(this.getWindow(), options);
  }

  public showMessageBox(options: MessageBoxOptions) {
    return this._win == undefined
      ? dialog.showMessageBox(options)
      : dialog.showMessageBox(this.getWindow(), options);
  }
}

let windowManager: WelcomeWindowManager | undefined;

export function initializeWelcomeWindowManager(payload: WindowManagerOption) {
  windowManager = new WelcomeWindowManager(payload);
}

export function getWelcomeWindowManager() {
  if (windowManager == undefined) {
    throw new Error("WindowManager is not initialized");
  }
  return windowManager;
}
