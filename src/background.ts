"use strict";

import { execFile, ChildProcess } from "child_process";
import dotenv from "dotenv";
import treeKill from "tree-kill";
import Store from "electron-store";

import {
  app,
  protocol,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";

import path from "path";
import {
  CREATE_HELP_WINDOW,
  GET_CHARACTOR_INFOS,
  GET_OSS_LICENSES,
  GET_UPDATE_INFOS,
  GET_TEMP_DIR,
  SHOW_OPEN_DIRECOTRY_DIALOG,
  SHOW_IMPORT_FILE_DIALOG,
  SHOW_SAVE_DIALOG,
} from "./electron/ipc";
import { MenuBuilder } from "./electron/menu";

import fs from "fs";
import { CharactorInfo } from "./type/preload";

let win: BrowserWindow;

// 多重起動防止
if (!app.requestSingleInstanceLock()) app.quit();

// 設定
dotenv.config();
const isDevelopment = process.env.NODE_ENV !== "production";
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, stream: true } },
]);

// 設定ファイル
const store = new Store({
  schema: {
    useGpu: {
      type: "boolean",
    },
  },
});

// engine
let willQuitEngine = false;
let engineProcess: ChildProcess;
function runEngine() {
  if (!store.has("useGpu")) {
    const useGpu =
      dialog.showMessageBoxSync(win, {
        message: "エンジンをCPUモード・GPUモードどちらで起動しますか？",
        detail:
          "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。",
        title: "エンジンの起動モード選択",
        type: "question",
        buttons: ["CPUモード", "GPUモード"],
      }) == 1;
    store.set("useGpu", useGpu);
  }

  const args = store.get("useGpu") ? ["--use_gpu"] : null;

  engineProcess = execFile(
    process.env.ENGINE_PATH!,
    args,
    { cwd: path.dirname(process.env.ENGINE_PATH!) },
    () => {
      if (!willQuitEngine) {
        dialog.showErrorBox(
          "音声合成エンジンエラー",
          "音声合成エンジンが異常終了しました。ソフトウェアを再起動してください。"
        );
      }
    }
  );
}

// temp dir
const tempDir = path.join(app.getPath("temp"), "VOICEVOX");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// キャラクター情報の読み込み
declare let __static: string;
const charactorInfos = fs
  .readdirSync(path.join(__static, "charactors"))
  .map((dirRelPath): CharactorInfo => {
    const dirPath = path.join(__static, "charactors", dirRelPath);
    return {
      dirPath,
      iconPath: path.join(dirPath, "icon.png"),
      metas: JSON.parse(
        fs.readFileSync(path.join(dirPath, "metas.json"), { encoding: "utf-8" })
      ),
    };
  });

// OSSライセンス情報の読み込み
const ossLicenses = JSON.parse(
  fs.readFileSync(path.join(__static, "licenses.json"), { encoding: "utf-8" })
);

// アップデート情報の読み込み
const updateInfos = JSON.parse(
  fs.readFileSync(path.join(__static, "updateInfos.json"), {
    encoding: "utf-8",
  })
);

// initialize menu
const menu = MenuBuilder()
  .setOnLaunchModeItemClicked((useGpu) => {
    store.set("useGpu", useGpu);

    dialog.showMessageBoxSync(win, {
      message: "音声合成エンジン起動モードの変更が完了しました",
      detail: "起動モード変更の反映は次回のソフトウェア起動時に行われます。",
    });

    menu.setActiveLaunchMode(store.get("useGpu", false) as boolean);
  })
  .build();
Menu.setApplicationMenu(menu.instance);

menu.setActiveLaunchMode(store.get("useGpu", false) as boolean);

// create window
async function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),

      enableRemoteModule: !!process.env.IS_TEST,

      nodeIntegration: true,
      contextIsolation: true,
    },
    icon: path.join(__static, "icon.png"),
  });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    await win.loadURL(
      (process.env.WEBPACK_DEV_SERVER_URL as string) + "#/home"
    );
  } else {
    createProtocol("app");
    win.loadURL("app://./index.html#/home");
  }
  if (isDevelopment) win.webContents.openDevTools();
}

// create help window
async function createHelpWindow() {
  const child = new BrowserWindow({
    parent: win,
    width: 700,
    height: 500,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),

      enableRemoteModule: !!process.env.IS_TEST,

      nodeIntegration: true,
      contextIsolation: true,
    },
    icon: path.join(__static, "icon.png"),
  });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    await child.loadURL(
      (process.env.WEBPACK_DEV_SERVER_URL as string) + "#/help/policy"
    );
  } else {
    child.loadURL("app://./index.html#/help/policy");
  }
  if (isDevelopment) child.webContents.openDevTools();
}

// プロセス間通信
ipcMain.handle(GET_TEMP_DIR, (event) => {
  return tempDir;
});

ipcMain.handle(GET_CHARACTOR_INFOS, (event) => {
  return charactorInfos;
});

ipcMain.handle(GET_OSS_LICENSES, (event) => {
  return ossLicenses;
});

ipcMain.handle(GET_UPDATE_INFOS, (event) => {
  return updateInfos;
});

ipcMain.handle(
  SHOW_SAVE_DIALOG,
  (event, { title, defaultPath }: { title: string; defaultPath?: string }) => {
    return dialog.showSaveDialogSync(win, {
      title,
      defaultPath,
      filters: [{ name: "Wave File", extensions: ["wav"] }],
      properties: ["createDirectory"],
    });
  }
);

ipcMain.handle(
  SHOW_OPEN_DIRECOTRY_DIALOG,
  (event, { title }: { title: string }) => {
    return dialog.showOpenDialogSync(win, {
      title,
      properties: ["openDirectory", "createDirectory"],
    })?.[0];
  }
);

ipcMain.handle(
  SHOW_IMPORT_FILE_DIALOG,
  (event, { title }: { title: string }) => {
    return dialog.showOpenDialogSync(win, {
      title,
      filters: [{ name: "Text", extensions: ["txt"] }],
      properties: ["openFile", "createDirectory"],
    })?.[0];
  }
);

ipcMain.handle(CREATE_HELP_WINDOW, (event) => {
  createHelpWindow();
});

// app callback
app.on("web-contents-created", (e, contents) => {
  // リンククリック時はブラウザを開く
  contents.setWindowOpenHandler(({ url }) => {
    if (url.match(/^http/)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  willQuitEngine = true;
  try {
    treeKill(engineProcess.pid);
  } catch {
    console.error("engine kill error");
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("ready", async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  createWindow();
  runEngine();
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
