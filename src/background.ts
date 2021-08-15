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
import { hasSupportedGpu } from "./electron/device";

import fs from "fs";
import { CharacterInfo } from "./type/preload";

let win: BrowserWindow;

// 多重起動防止
if (!app.requestSingleInstanceLock()) app.quit();

// 設定
const appDirPath = path.dirname(app.getPath("exe"));
const envPath = path.join(appDirPath, ".env");
dotenv.config({ path: envPath });
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
async function runEngine() {
  // 最初のエンジンモード
  if (!store.has("useGpu")) {
    const hasGpu = await hasSupportedGpu();
    store.set("useGpu", hasGpu);

    dialog.showMessageBox(win, {
      message: `音声合成エンジンを${
        hasGpu ? "GPU" : "CPU"
      }モードで起動しました`,
      detail:
        "エンジンの起動モードは、画面上部の「エンジン」メニューから変更できます。",
      title: "エンジンの起動モード",
      type: "info",
    });
  }

  menu.setActiveLaunchMode(store.get("useGpu", false) as boolean);

  // エンジンプロセスの起動
  const enginePath = path.resolve(
    appDirPath,
    process.env.ENGINE_PATH ?? "run.exe"
  );
  const args = store.get("useGpu") ? ["--use_gpu"] : null;
  engineProcess = execFile(
    enginePath,
    args,
    { cwd: path.dirname(enginePath) },
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
const characterInfos = fs
  .readdirSync(path.join(__static, "characters"))
  .map((dirRelPath): CharacterInfo => {
    const dirPath = path.join(__static, "characters", dirRelPath);
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
    if ((store.get("useGpu", false) as boolean) == useGpu) {
      return;
    }

    let isChangeable = true;

    if (useGpu) {
      const isAvailableGPUMode = await hasSupportedGpu();
      if (!isAvailableGPUMode) {
        const response = dialog.showMessageBoxSync(win, {
          message: "対応するGPUデバイスが見つかりません",
          detail:
            "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。\nこのままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
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

  win.webContents.once("did-finish-load", () => {
    if (process.argv.length >= 2) {
      const filePath = process.argv[1];
      win.webContents.send(LOAD_PROJECT_FILE, { filePath, confirm: false });
    }
  });
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

ipcMain.handle("GET_APP_INFOS", () => {
  const name = app.getName();
  const version = app.getVersion();
  return {
    name,
    version,
  };
});

// プロセス間通信
ipcMain.handle("GET_TEMP_DIR", () => {
  return tempDir;
});

ipcMain.handle("GET_CHARACTER_INFOS", () => {
  return characterInfos;
});

ipcMain.handle("GET_OSS_LICENSES", () => {
  return ossLicenses;
});

ipcMain.handle("GET_UPDATE_INFOS", () => {
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

ipcMain.handle("SHOW_OPEN_DIRECTORY_DIALOG", (event, { title }) => {
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

ipcMain.handle("CREATE_HELP_WINDOW", () => {
  createHelpWindow();
});

ipcMain.handle("OPEN_TEXT_EDIT_CONTEXT_MENU", () => {
  textEditContextMenu.popup({ window: win });
});

ipcMain.handle("UPDATE_MENU", (_, uiLocked) => {
  menu.updateLockMenuItems(uiLocked);
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
    engineProcess.pid != undefined && treeKill(engineProcess.pid);
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
