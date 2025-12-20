import path from "node:path";
import {
  BrowserWindow,
  dialog,
  MessageBoxOptions,
  MessageBoxSyncOptions,
  OpenDialogOptions,
  OpenDialogSyncOptions,
  SaveDialogOptions,
} from "electron";
import windowStateKeeper from "electron-window-state";
import { getConfigManager } from "../../electronConfig";
import { ipcMainSendProxy } from "../../ipc";
import { getAppStateController } from "../../appStateController";
import { themes } from "@/domain/theme";

export type WindowManagerOption = {
  staticDir: string;
  isDevelopment: boolean;
  isTest: boolean;
};

export type WindowLoadOption = {
  isMultiEngineOffMode?: boolean;
};

export abstract class WindowManager {
  private _win: BrowserWindow | undefined;
  private staticDir: string;
  private isDevelopment: boolean;
  private isTest: boolean;

  constructor(payload: WindowManagerOption) {
    this.staticDir = payload.staticDir;
    this.isDevelopment = payload.isDevelopment;
    this.isTest = payload.isTest;
  }

  /**
   * BrowserWindowを取得する
   */
  public get win() {
    return this._win;
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

  public async createWindow() {
    if (this.win != undefined) {
      throw new Error("Window has already been created");
    }
    const mainWindowState = windowStateKeeper({
      defaultWidth: 1024,
      defaultHeight: 630,
    });

    const configManager = getConfigManager();
    const currentTheme = configManager.get("currentTheme");
    const backgroundColor = themes.find((value) => value.name == currentTheme)
      ?.colors.background;

    const win = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      frame: false,
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 6, y: 4 },
      minWidth: 320,
      show: false,
      backgroundColor,
      webPreferences: {
        preload: path.join(import.meta.dirname, "preload.mjs"),
      },
      icon: path.join(this.staticDir, "icon.png"),
    });

    win.on("maximize", () => {
      ipcMainSendProxy.DETECT_MAXIMIZED(win);
    });
    win.on("unmaximize", () => {
      ipcMainSendProxy.DETECT_UNMAXIMIZED(win);
    });
    win.on("enter-full-screen", () => {
      ipcMainSendProxy.DETECT_ENTER_FULLSCREEN(win);
    });
    win.on("leave-full-screen", () => {
      ipcMainSendProxy.DETECT_LEAVE_FULLSCREEN(win);
    });
    win.on("always-on-top-changed", () => {
      if (win.isAlwaysOnTop()) {
        ipcMainSendProxy.DETECT_PINNED(win);
      } else {
        ipcMainSendProxy.DETECT_UNPINNED(win);
      }
    });
    win.on("close", (event) => {
      const appStateController = getAppStateController();
      void appStateController.onQuitRequest({
        preventQuit: () => event.preventDefault(),
      });
    });
    win.on("closed", () => {
      this._win = undefined;
    });
    win.on("resize", () => {
      const windowSize = win.getSize();
      ipcMainSendProxy.DETECT_RESIZED(win, {
        width: windowSize[0],
        height: windowSize[1],
      });
    });
    mainWindowState.manage(win);
    this._win = win;

    await this.load(this.getDefaultLoadOptions());

    if (this.isDevelopment && !this.isTest) win.webContents.openDevTools();
  }

  protected getDefaultLoadOptions(): WindowLoadOption {
    return {};
  }

  protected buildBaseUrl(entryHtml: string) {
    const devServerUrl = import.meta.env.VITE_DEV_SERVER_URL;
    if (devServerUrl != undefined) {
      const url = new URL(devServerUrl);
      url.pathname = entryHtml.startsWith("/") ? entryHtml : `/${entryHtml}`;
      return url;
    }
    return new URL(`app://./${entryHtml}`);
  }

  protected abstract buildLoadUrl(obj: WindowLoadOption): URL;

  /**
   * 画面の読み込みを開始する。
   * @param obj.isMultiEngineOffMode マルチエンジンオフモードにするかどうか。無指定時はfalse扱いになる。
   * @returns ロードの完了を待つPromise。
   */
  public async load(obj?: WindowLoadOption) {
    const win = this.getWindow();
    const url = this.buildLoadUrl(obj ?? this.getDefaultLoadOptions());
    await win.loadURL(url.toString());
  }

  public async reload(isMultiEngineOffMode: boolean | undefined) {
    await this.load({
      isMultiEngineOffMode: !!isMultiEngineOffMode,
    });
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
