"use strict";

import { execFile, ChildProcess } from "child_process";
import dotenv from "dotenv";
import treeKill from "tree-kill";
import Store from "electron-store";

import { app, protocol, BrowserWindow, dialog, shell } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";

import path from "path";
import { textEditContextMenu } from "./electron/contextMenu";
import { hasSupportedGpu } from "./electron/device";
import { ipcMainHandle, ipcMainSend } from "@/electron/ipc";

import fs from "fs";
import { CharacterInfo, Encoding } from "./type/preload";
import { HotkeySetting, MouseWheelSetting, SimpleMode } from "./store/type";

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
    fileEncoding: {
      type: "string",
    },
    hotkeySetting: {
      type: "array",
      description: "A bunch of hotkey settings",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { type: "string" },
          combination: { type: "string" },
        },
      },
    },
    simpleMode: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        dir: { type: "string" },
      },
    },
    mouseWheelSetting: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          enabled: { type: "boolean" },
          reversed: { type: "boolean" },
        },
      },
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
    (error) => {
      console.log(error);
      if (!willQuitEngine) {
        ipcMainSend(win, "DETECTED_ENGINE_ERROR");
        dialog.showErrorBox(
          "音声合成エンジンエラー",
          "音声合成エンジンが異常終了しました。ソフトウェアを再起動してください。"
        );
      }
    }
  );
}

// initialize settings
// GPU mode is handled by runEngine()
const initSetting = () => {
  if (!store.has("hotkeySetting")) {
    const defaultHotkeys = [
      {
        id: "0",
        action: "書き出し",
        combination: "Ctrl E",
      },
      {
        id: "1",
        action: "一つだけ書き出し",
        combination: "",
      },
      {
        id: "2",
        action: "再生/停止",
        combination: "space",
      },
      {
        id: "3",
        action: "連続再生/停止",
        combination: "",
      },
      {
        id: "4",
        action: "ｱｸｾﾝﾄ欄を表示",
        combination: "1",
      },
      {
        id: "5",
        action: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
        combination: "2",
      },
      {
        id: "6",
        action: "テキスト欄を追加",
        combination: "Shift enter",
      },
      {
        id: "7",
        action: "テキスト欄を削除",
        combination: "Shift delete",
      },
      {
        id: "8",
        action: "テキスト欄からフォーカスを外す",
        combination: "escape",
      },
      {
        id: "9",
        action: "テキスト欄にフォーカスを戻す",
        combination: "backspace",
      },
      {
        id: "10",
        action: "元に戻す",
        combination: "Ctrl Z",
      },
      {
        id: "11",
        action: "やり直す",
        combination: "Ctrl Y",
      },
      {
        id: "12",
        action: "プロジェクトを保存する",
        combination: "Ctrl S",
      },
      {
        id: "13",
        action: "プロジェクトを読み込む",
        combination: "",
      },
      {
        id: "14",
        action: "テキストファイルを読み込む",
        combination: "",
      },
    ];
    store.set("hotkeySetting", defaultHotkeys);
    if (!store.has("fileEncoding")) {
      const defaultFileEncoding = "UTF-8";
      store.set("fileEncoding", defaultFileEncoding);
    }
  }
  if (!store.has("simpleMode")) {
    const defaultSimpleMode = {
      enabled: false,
      dir: "",
    };
    store.set("simpleMode", defaultSimpleMode);
  }
  if (!store.has("mouseWheelSetting")) {
    const defaultMouseWheelSetting: MouseWheelSetting[] = [];
    for (let i = 0; i < 6; i++) {
      defaultMouseWheelSetting.push({
        id: i.toString(),
        enabled: true,
        reversed: false,
      });
    }
    store.set("mouseWheelSetting", defaultMouseWheelSetting);
  }
};

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
      metas: JSON.parse(
        fs.readFileSync(path.join(dirPath, "metas.json"), { encoding: "utf-8" })
      ),
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
    width: 880,
    height: 680,
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

  return store.get("useGpu", false) as boolean;
});

ipcMainHandle("IS_AVAILABLE_GPU_MODE", () => {
  return hasSupportedGpu();
});

ipcMainHandle("FILE_ENCODING", (_, { newValue }) => {
  if (newValue !== undefined) {
    store.set("fileEncoding", newValue);
  }

  return store.get("fileEncoding", "UTF-8") as Encoding;
});

ipcMainHandle("HOTKEY_SETTING", (_, { newValue, id }) => {
  if (newValue !== undefined && id !== -1 && id !== undefined) {
    const hotkey = store.get("hotkeySetting") as HotkeySetting[];
    hotkey[id].combination = newValue;
    store.set("hotkeySetting", hotkey);
    return hotkey;
  }
  return store.get("hotkeySetting") as HotkeySetting[];
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
ipcMainHandle("PIN_WINDOW", () => {
  if (win.isAlwaysOnTop()) {
    win.setAlwaysOnTop(false);
  } else {
    win.setAlwaysOnTop(true);
  }
});

ipcMainHandle("MOUSE_WHEEL_SETTING", (_, { enabled, reversed, id }) => {
  const mouseWheelSetting = store.get(
    "mouseWheelSetting"
  ) as MouseWheelSetting[];
  if (id > -1) {
    mouseWheelSetting[id].enabled = enabled;
    mouseWheelSetting[id].reversed = reversed;
    store.set("mouseWheelSetting", mouseWheelSetting);
  }
  return mouseWheelSetting as MouseWheelSetting[];
});

ipcMainHandle("SIMPLE_MODE_SETTING", (_, { newData }) => {
  if (newData !== undefined) {
    store.set("simpleMode", newData);
  }
  return store.get("simpleMode") as SimpleMode;
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
  if (isDevelopment) {
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }

  initSetting();

  createWindow().then(() => {
    runEngine();
  });
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
