"use strict";

import { spawn, ChildProcess } from "child_process";
import dotenv from "dotenv";
import treeKill from "tree-kill";
import Store from "electron-store";

import { app, protocol, BrowserWindow, dialog, Menu, shell } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";

import path from "path";
import { textEditContextMenu } from "./electron/contextMenu";
import { hasSupportedGpu } from "./electron/device";
import { ipcMainHandle, ipcMainSend } from "@/electron/ipc";

import fs from "fs";
import { CharacterInfo, SavingSetting } from "./type/preload";

import log from "electron-log";
import dayjs from "dayjs";

// silly以上のログをコンソールに出力
log.transports.console.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.console.level = "silly";

// warn以上のログをファイルに出力
const prefix = dayjs().format("YYYYMMDD_HHmmss");
log.transports.file.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.file.level = "warn";
log.transports.file.fileName = `${prefix}_error.log`;

const isDevelopment = process.env.NODE_ENV !== "production";

let win: BrowserWindow;

// 多重起動防止
if (!isDevelopment && !app.requestSingleInstanceLock()) app.quit();

process.on("uncaughtException", (error) => {
  log.error(error);
});
process.on("unhandledRejection", (reason) => {
  log.error(reason);
});

// 設定
const appDirPath = path.dirname(app.getPath("exe"));
const envPath = path.join(appDirPath, ".env");
dotenv.config({ path: envPath });
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, stream: true } },
]);

// 設定ファイル
const store = new Store<{
  useGpu: boolean;
  savingSetting: SavingSetting;
}>({
  schema: {
    useGpu: {
      type: "boolean",
    },
    savingSetting: {
      type: "object",
      properties: {
        fileEncoding: { type: "string" },
        fixedExportEnabled: { type: "boolean" },
        avoidOverwrite: { type: "boolean" },
        fixedExportDir: { type: "string" },
      },
    },
  },
  defaults: {
    useGpu: false,
    savingSetting: {
      fileEncoding: "UTF-8",
      fixedExportEnabled: false,
      avoidOverwrite: false,
      fixedExportDir: "",
    },
  },
});

// engine
let willQuitEngine = false;
let shouldKillEngineBeforeQuit = false;
let engineProcess: ChildProcess;
async function runEngine() {
  willQuitEngine = false;

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

  const useGpu = store.get("useGpu");
  log.info(`ENGINE will start in ${useGpu ? "GPU" : "CPU"} mode`);

  // エンジンプロセスの起動
  const enginePath = path.resolve(
    appDirPath,
    process.env.ENGINE_PATH ?? "run.exe"
  );
  const args = useGpu ? ["--use_gpu"] : [];

  shouldKillEngineBeforeQuit = true;
  engineProcess = spawn(enginePath, args, {
    cwd: path.dirname(enginePath),
  });

  engineProcess.stdout?.on("data", (data) => {
    log.info("ENGINE: " + data.toString("utf-8"));
  });

  engineProcess.stderr?.on("data", (data) => {
    log.error("ENGINE: " + data.toString("utf-8"));
  });

  engineProcess.on("close", (code, signal) => {
    shouldKillEngineBeforeQuit = false;

    log.info(`ENGINE: terminated due to receipt of signal ${signal}`);
    log.info(`ENGINE: exited with code ${code}`);

    if (!willQuitEngine) {
      ipcMainSend(win, "DETECTED_ENGINE_ERROR");
      dialog.showErrorBox(
        "音声合成エンジンエラー",
        "音声合成エンジンが異常終了しました。エンジンを再起動してください。"
      );
    }
  });
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
      portraitPath: path.join(dirPath, "portrait.png"),
      metas: {
        ...JSON.parse(
          fs.readFileSync(path.join(dirPath, "metas.json"), {
            encoding: "utf-8",
          })
        ),
        policy: fs.readFileSync(path.join(dirPath, "policy.md"), "utf-8"),
      },
    };
  });

// 利用規約テキストの読み込み
const policyText = fs.readFileSync(path.join(__static, "policy.md"), "utf-8");

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

// create window
async function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    minWidth: 320,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

  win.on("maximize", () => win.webContents.send("DETECT_MAXIMIZED"));
  win.on("unmaximize", () => win.webContents.send("DETECT_UNMAXIMIZED"));
  win.on("always-on-top-changed", () => {
    win.webContents.send(
      win.isAlwaysOnTop() ? "DETECT_PINNED" : "DETECT_UNPINNED"
    );
  });

  win.webContents.once("did-finish-load", () => {
    if (process.argv.length >= 2) {
      const filePath = process.argv[1];
      ipcMainSend(win, "LOAD_PROJECT_FILE", { filePath, confirm: false });
    }
  });
}

if (!isDevelopment) {
  Menu.setApplicationMenu(null);
}

// プロセス間通信
ipcMainHandle("GET_APP_INFOS", () => {
  const name = app.getName();
  const version = app.getVersion();
  return {
    name,
    version,
  };
});

ipcMainHandle("GET_TEMP_DIR", () => {
  return tempDir;
});

ipcMainHandle("GET_CHARACTER_INFOS", () => {
  return characterInfos;
});

ipcMainHandle("GET_POLICY_TEXT", () => {
  return policyText;
});

ipcMainHandle("GET_OSS_LICENSES", () => {
  return ossLicenses;
});

ipcMainHandle("GET_UPDATE_INFOS", () => {
  return updateInfos;
});

ipcMainHandle("SHOW_AUDIO_SAVE_DIALOG", (_, { title, defaultPath }) => {
  return dialog.showSaveDialogSync(win, {
    title,
    defaultPath,
    filters: [{ name: "Wave File", extensions: ["wav"] }],
    properties: ["createDirectory"],
  });
});

ipcMainHandle("SHOW_OPEN_DIRECTORY_DIALOG", (_, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    properties: ["openDirectory", "createDirectory"],
  })?.[0];
});

ipcMainHandle("SHOW_PROJECT_SAVE_DIALOG", (_, { title }) => {
  return dialog.showSaveDialogSync(win, {
    title,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["showOverwriteConfirmation"],
  });
});

ipcMainHandle("SHOW_PROJECT_LOAD_DIALOG", (_, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["openFile"],
  });
});

ipcMainHandle("SHOW_CONFIRM_DIALOG", (_, { title, message }) => {
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

ipcMainHandle("SHOW_WARNING_DIALOG", (_, { title, message }) => {
  return dialog.showMessageBox(win, {
    type: "warning",
    title: title,
    message: message,
  });
});

ipcMainHandle("SHOW_ERROR_DIALOG", (_, { title, message }) => {
  return dialog.showMessageBox(win, {
    type: "error",
    title: title,
    message: message,
  });
});

ipcMainHandle("SHOW_IMPORT_FILE_DIALOG", (_, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    filters: [{ name: "Text", extensions: ["txt"] }],
    properties: ["openFile", "createDirectory"],
  })?.[0];
});

ipcMainHandle("OPEN_TEXT_EDIT_CONTEXT_MENU", () => {
  textEditContextMenu.popup({ window: win });
});

ipcMainHandle("USE_GPU", (_, { newValue }) => {
  if (newValue !== undefined) {
    store.set("useGpu", newValue);
  }

  return store.get("useGpu", false);
});

ipcMainHandle("IS_AVAILABLE_GPU_MODE", () => {
  return hasSupportedGpu();
});

ipcMainHandle("CLOSE_WINDOW", () => {
  app.emit("window-all-closed");
  win.destroy();
});
ipcMainHandle("MINIMIZE_WINDOW", () => win.minimize());
ipcMainHandle("MAXIMIZE_WINDOW", () => {
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMainHandle("LOG_ERROR", (_, ...params) => {
  log.error(...params);
});

ipcMainHandle("LOG_INFO", (_, ...params) => {
  log.info(...params);
});

/**
 * エンジンを再起動する。
 * エンジンの起動が開始したらresolve、起動が失敗したらreject。
 */
ipcMainHandle(
  "RESTART_ENGINE",
  () =>
    new Promise((resolve, reject) => {
      // エンジンのプロセスが存在しない場合
      if (engineProcess.exitCode !== null) {
        runEngine();
        resolve();
        return;
      }

      // エンジンエラー時のエラーウィンドウ抑制用。
      willQuitEngine = true;

      // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
      // closeイベントはexitイベントよりも後に発火します。
      const closeListenerCallBack = () => {
        runEngine();
        resolve();
      };
      engineProcess.once("close", closeListenerCallBack);

      // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
      treeKill(engineProcess.pid, (error) => {
        // error変数の値がnull以外であればkillコマンドが失敗したことを意味します。
        if (error !== null) {
          log.error(error);

          // 再起動用に設定したclose listenerを削除。
          engineProcess.removeListener("close", closeListenerCallBack);

          reject();
        }
      });
    })
);

ipcMainHandle("SAVING_SETTING", (_, { newData }) => {
  if (newData !== undefined) {
    store.set("savingSetting", newData);
  }
  return store.get("savingSetting");
});

ipcMainHandle("CHECK_FILE_EXISTS", (_, { file }) => {
  return fs.existsSync(file);
});
ipcMainHandle("CHANGE_PIN_WINDOW", () => {
  if (win.isAlwaysOnTop()) {
    win.setAlwaysOnTop(false);
  } else {
    win.setAlwaysOnTop(true);
  }
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

// Called before window closing
app.on("before-quit", (event) => {
  if (shouldKillEngineBeforeQuit) {
    event.preventDefault();

    engineProcess.once("close", () => {
      shouldKillEngineBeforeQuit = false;
      log.info("Quiting app");
      app.quit();
    });

    willQuitEngine = true;
    try {
      engineProcess.pid != undefined && treeKill(engineProcess.pid);
    } catch (error) {
      log.error("engine kill error");
      log.error(error);
    }
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("ready", async () => {
  if (isDevelopment) {
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e: unknown) {
      if (e instanceof Error) {
        log.error("Vue Devtools failed to install:", e.toString());
      }
    }
  }

  createWindow().then(() => runEngine());
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
