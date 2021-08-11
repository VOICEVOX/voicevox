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
  nativeTheme,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";

import path from "path";
import { textEditContextMenu } from "./electron/contextMenu";
import { MenuBuilder } from "./electron/menu";
import {
  GENERATE_AND_SAVE_ALL_AUDIO,
  IMPORT_FROM_FILE,
  LOAD_PROJECT_FILE,
  SAVE_PROJECT_FILE,
} from "./electron/ipc";

import fs from "fs";
import { CharactorInfo } from "./type/preload";

import si from "systeminformation";
function detectNvidia(): Promise<boolean> {
  return si
    .graphics()
    .then((data) =>
      data.controllers.some(
        (datum) =>
          datum.vendor.toUpperCase().indexOf("NVIDIA") !== -1 &&
          datum.vram >= 3072
      )
    )
    .catch(() => false);
}

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
    detectNvidia().then((result: boolean): void => {
      if (result) {
        dialog.showMessageBoxSync(win, {
          message: "「GPUモード」で起動します。",
          detail:
            "エンジンのモード変更は起動後、上部メニューの「エンジン」内にある「起動モード」からいつでも行えます。",
          title: "GPUモードで起動します",
          type: "info",
        });
        store.set("useGpu", true);
      } else {
        dialog.showMessageBoxSync(win, {
          message: "「CPUモード」で起動します。",
          detail:
            "「GPUモード」はNVIDIAかつ3GB以上のVRAMを搭載したGPUが必要です。\nエンジンのモード変更は起動後、上部メニューの「エンジン」内にある「起動モード」からいつでも行えます。",
          title: "CPUモードで起動します",
          type: "info",
        });
        store.set("useGpu", false);
      }
    });
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
  .configure(isDevelopment)
  .setOnLaunchModeItemClicked(async (useGpu) => {
    let isChangeable = true;

    if (useGpu) {
      const isAvaiableGPUMode = await detectNvidia();
      if (!isAvaiableGPUMode) {
        const response = dialog.showMessageBoxSync(win, {
          message: "警告",
          detail:
            "GPUモードはNVIDIAかつ3GB以上のVRAMを搭載したGPUが必要ですがお使いのPCからは条件を満たすGPUが検出できませんでした。\n\nGPUモードに変更しますと起動時にエンジンエラーが発生する可能性があります。\n\nその際はエラーメッセージウィンドウを閉じて、メニューからCPUモードへの変更をしてVOICEVOXの再起動をしてください。\n\n以上の警告メッセージを了解した上で変更をしたい場合は「変更する」を止める場合は「変更しない」を押してください。",
          title: "警告",
          type: "warning",
          buttons: ["変更しない", "変更する"],
          cancelId: 0,
        });

        if (response !== 1) {
          isChangeable = false;
        }
      }
    }

    if (isChangeable) {
      store.set("useGpu", useGpu);
      dialog.showMessageBoxSync(win, {
        message: "エンジンの起動モードを変更しました",
        detail: "変更を適用するためにVOICEVOXを再起動してください。",
      });
    }

    menu.setActiveLaunchMode(store.get("useGpu", false) as boolean);
  })
  .setOnSaveAllAudioItemClicked(() =>
    win.webContents.send(GENERATE_AND_SAVE_ALL_AUDIO)
  )
  .setOnImportFromFileItemClicked(() => win.webContents.send(IMPORT_FROM_FILE))
  .setOnSaveProjectFileItemClicked(() =>
    win.webContents.send(SAVE_PROJECT_FILE)
  )
  .setOnLoadProjectFileItemClicked(() =>
    win.webContents.send(LOAD_PROJECT_FILE)
  )
  .build();
Menu.setApplicationMenu(menu.instance);

menu.setActiveLaunchMode(store.get("useGpu", false) as boolean);

// create window
async function createWindow() {
  nativeTheme.themeSource = "light";
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
  child.removeMenu();

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    await child.loadURL(
      (process.env.WEBPACK_DEV_SERVER_URL as string) + "#/help/policy"
    );
  } else {
    child.loadURL("app://./index.html#/help/policy");
  }
  if (isDevelopment) child.webContents.openDevTools();
}

ipcMain.handle("GET_APP_INFOS", (event) => {
  const name = app.getName();
  const version = app.getVersion();
  return {
    name,
    version,
  };
});

// プロセス間通信
ipcMain.handle("GET_TEMP_DIR", (event) => {
  return tempDir;
});

ipcMain.handle("GET_CHARACTOR_INFOS", (event) => {
  return charactorInfos;
});

ipcMain.handle("GET_OSS_LICENSES", (event) => {
  return ossLicenses;
});

ipcMain.handle("GET_UPDATE_INFOS", (event) => {
  return updateInfos;
});

ipcMain.handle("SHOW_AUDIO_SAVE_DIALOG", (event, { title, defaultPath }) => {
  return dialog.showSaveDialogSync(win, {
    title,
    defaultPath,
    filters: [{ name: "Wave File", extensions: ["wav"] }],
    properties: ["createDirectory"],
  });
});

ipcMain.handle("SHOW_OPEN_DIRECOTRY_DIALOG", (event, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    properties: ["openDirectory", "createDirectory"],
  })?.[0];
});

ipcMain.handle("SHOW_PROJECT_SAVE_DIALOG", (event, { title }) => {
  return dialog.showSaveDialogSync(win, {
    title,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["showOverwriteConfirmation"],
  });
});

ipcMain.handle("SHOW_PROJECT_LOAD_DIALOG", (event, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["openFile"],
  });
});

ipcMain.handle("SHOW_CONFIRM_DIALOG", (event, { title, message }) => {
  return dialog
    .showMessageBox(win, {
      type: "info",
      buttons: ["OK", "Cancel"],
      title: title,
      message: message,
    })
    .then((value) => {
      return value.response == 0;
    });
});

ipcMain.handle("SHOW_IMPORT_FILE_DIALOG", (event, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    filters: [{ name: "Text", extensions: ["txt"] }],
    properties: ["openFile", "createDirectory"],
  })?.[0];
});

ipcMain.handle("CREATE_HELP_WINDOW", (event) => {
  createHelpWindow();
});

ipcMain.handle("OPEN_TEXT_EDIT_CONTEXT_MENU", () => {
  textEditContextMenu.popup({ window: win });
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
