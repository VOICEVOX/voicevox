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
import {
  CharacterInfo,
  HotkeySetting,
  MetasJson,
  SavingSetting,
} from "./type/preload";

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
  hotkeySettings: HotkeySetting[];
}>({
  schema: {
    useGpu: {
      type: "boolean",
      default: false,
    },
    savingSetting: {
      type: "object",
      properties: {
        fileEncoding: {
          type: "string",
          enum: ["UTF-8", "Shift_JIS"],
          default: "UTF-8",
        },
        fixedExportEnabled: { type: "boolean", default: false },
        avoidOverwrite: { type: "boolean", default: false },
        fixedExportDir: { type: "string", default: "" },
        exportLab: { type: "boolean", default: false },
      },
      default: {
        fileEncoding: "UTF-8",
        fixedExportEnabled: false,
        avoidOverwrite: false,
        fixedExportDir: "",
        exportLab: false,
      },
    },
    hotkeySettings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          combination: { type: "string" },
        },
      },
      default: {
        hotkeySettings: [
          {
            action: "音声書き出し",
            combination: "Ctrl E",
          },
          {
            action: "一つだけ書き出し",
            combination: "",
          },
          {
            action: "再生/停止",
            combination: "Space",
          },
          {
            action: "連続再生/停止",
            combination: "",
          },
          {
            action: "ｱｸｾﾝﾄ欄を表示",
            combination: "1",
          },
          {
            action: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
            combination: "2",
          },
          {
            action: "テキスト欄を追加",
            combination: "Shift Enter",
          },
          {
            action: "テキスト欄を削除",
            combination: "Shift Delete",
          },
          {
            action: "テキスト欄からフォーカスを外す",
            combination: "Escape",
          },
          {
            action: "テキスト欄にフォーカスを戻す",
            combination: "Backspace",
          },
          {
            action: "元に戻す",
            combination: "Ctrl Z",
          },
          {
            action: "やり直す",
            combination: "Ctrl Y",
          },
          {
            action: "新規プロジェクト",
            combination: "Ctrl N",
          },
          {
            action: "プロジェクトを名前を付けて保存",
            combination: "Ctrl Shift S",
          },
          {
            action: "プロジェクトを上書き保存",
            combination: "Ctrl S",
          },
          {
            action: "プロジェクト読み込み",
            combination: "Ctrl O",
          },
          {
            action: "テキスト読み込む",
            combination: "",
          },
        ],
      },
    },
  },
});

// engine
let willQuitEngine = false;
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
  log.info(`Starting ENGINE in ${useGpu ? "GPU" : "CPU"} mode`);

  // エンジンプロセスの起動
  const enginePath = path.resolve(
    appDirPath,
    process.env.ENGINE_PATH ?? "run.exe"
  );
  const args = useGpu ? ["--use_gpu"] : [];

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
const characterInfos: CharacterInfo[] = [];
for (const dirRelPath of fs.readdirSync(path.join(__static, "characters"))) {
  const dirPath = path.join(__static, "characters", dirRelPath);
  const iconPath = path.join(dirPath, "icon.png");
  const portraitPath = path.join(dirPath, "portrait.png");
  const policy = fs.readFileSync(path.join(dirPath, "policy.md"), "utf-8");
  const { speakerName, speakerUuid, styles }: MetasJson = JSON.parse(
    fs.readFileSync(path.join(dirPath, "metas.json"), "utf-8")
  );
  characterInfos.push({
    dirPath,
    iconPath,
    portraitPath,
    metas: {
      speakerName,
      speakerUuid,
      styles,
      policy,
    },
  });
}

// 使い方テキストの読み込み
const howToUseText = fs.readFileSync(
  path.join(__static, "howtouse.md"),
  "utf-8"
);

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

ipcMainHandle("GET_HOW_TO_USE_TEXT", () => {
  return howToUseText;
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
    new Promise<void>((resolve, reject) => {
      log.info(
        `Restarting ENGINE (last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode})`
      );

      // エンジンのプロセスがすでに終了している、またはkillされている場合
      const engineExited = engineProcess.exitCode !== null;
      const engineKilled = engineProcess.signalCode !== null;

      if (engineExited || engineKilled) {
        log.info(
          "ENGINE process is not started yet or already killed. Starting ENGINE..."
        );

        runEngine();
        resolve();
        return;
      }

      // エンジンエラー時のエラーウィンドウ抑制用。
      willQuitEngine = true;

      // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
      // closeイベントはexitイベントよりも後に発火します。
      const restartEngineOnProcessClosedCallback = () => {
        log.info("ENGINE process killed. Restarting ENGINE...");

        runEngine();
        resolve();
      };
      engineProcess.once("close", restartEngineOnProcessClosedCallback);

      // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
      log.info(`Killing current ENGINE process (PID=${engineProcess.pid})...`);
      treeKill(engineProcess.pid, (error) => {
        // error変数の値がundefined以外であればkillコマンドが失敗したことを意味します。
        if (error != null) {
          log.error("Failed to kill ENGINE");
          log.error(error);

          // killに失敗したとき、closeイベントが発生せず、once listenerが消費されない
          // listenerを削除してENGINEの意図しない再起動を防止
          engineProcess.removeListener(
            "close",
            restartEngineOnProcessClosedCallback
          );

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

ipcMainHandle("HOTKEY_SETTINGS", (_, { newData }) => {
  if (newData !== undefined) {
    const hotkeySettings = store.get("hotkeySettings");
    const hotkeySetting = hotkeySettings.find(
      (hotkey) => hotkey.action == newData.action
    );
    if (hotkeySetting !== undefined) {
      hotkeySetting.combination = newData.combination;
    }
    store.set("hotkeySettings", hotkeySettings);
  }
  return store.get("hotkeySettings");
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
  // considering the case that ENGINE process killed after checking process status
  engineProcess.once("close", () => {
    log.info("ENGINE killed. Quitting app");
    app.quit(); // attempt to quit app again
  });

  log.info(
    `Quitting app (ENGINE last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode})`
  );

  const engineNotExited = engineProcess.exitCode === null;
  const engineNotKilled = engineProcess.signalCode === null;

  if (engineNotExited && engineNotKilled) {
    log.info("Killing ENGINE before app quit");
    event.preventDefault();

    log.info(`Killing ENGINE (PID=${engineProcess.pid})...`);
    willQuitEngine = true;
    try {
      engineProcess.pid != undefined && treeKill(engineProcess.pid);
    } catch (error: unknown) {
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
