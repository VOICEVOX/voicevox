"use strict";

import path from "path";

import fs from "fs";
import {
  app,
  protocol,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  nativeTheme,
  net,
} from "electron";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import Store, { Schema } from "electron-store";
import dotenv from "dotenv";

import log from "electron-log";
import dayjs from "dayjs";
import windowStateKeeper from "electron-window-state";
import zodToJsonSchema from "zod-to-json-schema";
import { hasSupportedGpu } from "./electron/device";
import {
  HotkeySetting,
  ThemeConf,
  AcceptTermsStatus,
  EngineInfo,
  ElectronStoreType,
  SystemError,
  electronStoreSchema,
  defaultHotkeySettings,
  isMac,
  defaultToolbarButtonSetting,
  engineSettingSchema,
  EngineId,
} from "./type/preload";
import {
  ContactTextFileName,
  HowToUseTextFileName,
  OssCommunityInfosFileName,
  OssLicensesJsonFileName,
  PolicyTextFileName,
  PrivacyPolicyTextFileName,
  QAndATextFileName,
  UpdateInfosJsonFileName,
} from "./type/staticResources";

import EngineManager from "./background/engineManager";
import VvppManager, { isVvppFile } from "./background/vvppManager";
import configMigration014 from "./background/configMigration014";
import { failure, success } from "./type/result";
import { ipcMainHandle, ipcMainSend } from "@/electron/ipc";

type SingleInstanceLockData = {
  filePath: string | undefined;
};

const isDevelopment = import.meta.env.DEV;
const isTest = import.meta.env.MODE === "test";

if (isDevelopment) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

let suffix = "";
if (isTest) {
  suffix = "-test";
} else if (isDevelopment) {
  suffix = "-dev";
}
console.log(`Environment: ${import.meta.env.MODE}, appData: voicevox${suffix}`);

//appnameをVoiceVoxとしてsetする
app.setName(`voicevox${suffix}`);

// Electronの設定ファイルの保存場所を変更
const beforeUserDataDir = app.getPath("userData"); // 設定ファイルのマイグレーション用
const fixedUserDataDir = path.join(app.getPath("appData"), `voicevox${suffix}`);
if (!fs.existsSync(fixedUserDataDir)) {
  fs.mkdirSync(fixedUserDataDir);
}
app.setPath("userData", fixedUserDataDir);
if (!isDevelopment) {
  configMigration014({ fixedUserDataDir, beforeUserDataDir }); // 以前のファイルがあれば持ってくる
}

// silly以上のログをコンソールに出力
log.transports.console.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.console.level = "silly";

// warn以上のログをファイルに出力
const prefix = dayjs().format("YYYYMMDD_HHmmss");
const logPath = app.getPath("logs");
log.transports.file.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.file.level = "warn";
log.transports.file.fileName = `${prefix}_error.log`;
log.transports.file.resolvePath = (variables) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return path.join(logPath, variables.fileName!);
};

let win: BrowserWindow;

process.on("uncaughtException", (error) => {
  log.error(error);
});
process.on("unhandledRejection", (reason) => {
  log.error(reason);
});

// .envから設定をprocess.envに読み込み
let appDirPath: string;
let __static: string;

// NOTE: 開発版では、カレントディレクトリにある .env ファイルを読み込む。
//       一方、配布パッケージ版では .env ファイルが実行ファイルと同じディレクトリに配置されているが、
//       Linux・macOS ではそのディレクトリはカレントディレクトリとはならないため、.env ファイルの
//       パスを明示的に指定する必要がある。Windows の配布パッケージ版でもこの設定で起動できるため、
//       全 OS で共通の条件分岐とした。
if (isDevelopment) {
  // __dirnameはdist_electronを指しているので、一つ上のディレクトリに移動する
  appDirPath = path.resolve(__dirname, "..");
  dotenv.config({ override: true });
  __static = path.join(appDirPath, "public");
} else {
  appDirPath = path.dirname(app.getPath("exe"));
  const envPath = path.join(appDirPath, ".env");
  dotenv.config({ path: envPath });
  process.chdir(appDirPath);
  __static = __dirname;
}

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, stream: true } },
]);

const firstUrl = process.env.VITE_DEV_SERVER_URL ?? "app://./index.html";

// 設定ファイル
const electronStoreJsonSchema = zodToJsonSchema(electronStoreSchema);
if (!("properties" in electronStoreJsonSchema)) {
  throw new Error("electronStoreJsonSchema must be object");
}
let store: Store<ElectronStoreType>;
try {
  store = new Store<ElectronStoreType>({
    schema: electronStoreJsonSchema.properties as Schema<ElectronStoreType>,
    migrations: {
      ">=0.13": (store) => {
        // acceptTems -> acceptTerms
        const prevIdentifier = "acceptTems";
        const prevValue = store.get(prevIdentifier, undefined) as
          | AcceptTermsStatus
          | undefined;
        if (prevValue) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          store.delete(prevIdentifier as any);
          store.set("acceptTerms", prevValue);
        }
      },
      ">=0.14": (store) => {
        // FIXME: できるならEngineManagerからEnginIDを取得したい
        if (process.env.DEFAULT_ENGINE_INFOS == undefined)
          throw new Error("DEFAULT_ENGINE_INFOS == undefined");
        const engineId = EngineId(
          JSON.parse(process.env.DEFAULT_ENGINE_INFOS)[0].uuid
        );
        if (engineId == undefined)
          throw new Error("DEFAULT_ENGINE_INFOS[0].uuid == undefined");
        const prevDefaultStyleIds = store.get("defaultStyleIds");
        store.set(
          "defaultStyleIds",
          prevDefaultStyleIds.map((defaultStyle) => ({
            engineId,
            speakerUuid: defaultStyle.speakerUuid,
            defaultStyleId: defaultStyle.defaultStyleId,
          }))
        );

        const outputSamplingRate: number =
          // @ts-expect-error 削除されたパラメータ。
          store.get("savingSetting").outputSamplingRate;
        store.set(`engineSettings.${engineId}`, {
          useGpu: store.get("useGpu"),
          outputSamplingRate:
            outputSamplingRate === 24000 ? "engineDefault" : outputSamplingRate,
        });
        // @ts-expect-error 削除されたパラメータ。
        store.delete("savingSetting.outputSamplingRate");
        // @ts-expect-error 削除されたパラメータ。
        store.delete("useGpu");
      },
    },
  });
} catch (e) {
  log.error(e);
  app.whenReady().then(() => {
    dialog
      .showMessageBox({
        type: "error",
        title: "設定ファイルの読み込みエラー",
        message: `設定ファイルの読み込みに失敗しました。${app.getPath(
          "userData"
        )} にある config.json の名前を変えることで解決することがあります（ただし設定がすべてリセットされます）。設定ファイルがあるフォルダを開きますか？`,
        buttons: ["いいえ", "はい"],
        noLink: true,
        cancelId: 0,
      })
      .then(async ({ response }) => {
        if (response === 1) {
          await shell.openPath(app.getPath("userData"));
          // 直後にexitするとフォルダが開かないため
          await new Promise((resolve) => {
            setTimeout(resolve, 500);
          });
        }
      })
      .finally(() => {
        app.exit(1);
      });
  });
  throw e;
}

// engine
const vvppEngineDir = path.join(app.getPath("userData"), "vvpp-engines");

if (!fs.existsSync(vvppEngineDir)) {
  fs.mkdirSync(vvppEngineDir);
}

const onEngineProcessError = (engineInfo: EngineInfo, error: Error) => {
  const engineId = engineInfo.uuid;
  log.error(`ENGINE ${engineId} ERROR: ${error}`);

  // winが作られる前にエラーが発生した場合はwinへの通知を諦める
  // FIXME: winが作られた後にエンジンを起動させる
  if (win != undefined) {
    ipcMainSend(win, "DETECTED_ENGINE_ERROR", { engineId });
  } else {
    log.error(`onEngineProcessError: win is undefined`);
  }

  dialog.showErrorBox("音声合成エンジンエラー", error.message);
};

const engineManager = new EngineManager({
  store,
  defaultEngineDir: appDirPath,
  vvppEngineDir,
  onEngineProcessError,
});
const vvppManager = new VvppManager({ vvppEngineDir });

// エンジンのフォルダを開く
function openEngineDirectory(engineId: EngineId) {
  const engineDirectory = engineManager.fetchEngineDirectory(engineId);

  // Windows環境だとスラッシュ区切りのパスが動かない。
  // path.resolveはWindowsだけバックスラッシュ区切りにしてくれるため、path.resolveを挟む。
  shell.openPath(path.resolve(engineDirectory));
}

/**
 * VVPPエンジンをインストールする。
 */
async function installVvppEngine(vvppPath: string) {
  try {
    await vvppManager.install(vvppPath);
    return true;
  } catch (e) {
    dialog.showErrorBox(
      "インストールエラー",
      `${vvppPath} をインストールできませんでした。`
    );
    log.error(`Failed to install ${vvppPath}, ${e}`);
    return false;
  }
}

/**
 * 危険性を案内してからVVPPエンジンをインストールする。
 * FIXME: こちらで案内せず、GUIでのインストール側に合流させる
 */
async function installVvppEngineWithWarning({
  vvppPath,
  reloadNeeded,
}: {
  vvppPath: string;
  reloadNeeded: boolean;
}) {
  const result = dialog.showMessageBoxSync(win, {
    type: "warning",
    title: "エンジン追加の確認",
    message: `この操作はコンピュータに損害を与える可能性があります。エンジンの配布元が信頼できない場合は追加しないでください。`,
    buttons: ["追加", "キャンセル"],
    noLink: true,
    cancelId: 1,
  });
  if (result == 1) {
    return;
  }

  await installVvppEngine(vvppPath);

  if (reloadNeeded) {
    dialog
      .showMessageBox(win, {
        type: "info",
        title: "再読み込みが必要です",
        message:
          "VVPPファイルを読み込みました。反映には再読み込みが必要です。今すぐ再読み込みしますか？",
        buttons: ["再読み込み", "キャンセル"],
        noLink: true,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          ipcMainSend(win, "CHECK_EDITED_AND_NOT_SAVE", {
            closeOrReload: "reload",
          });
        }
      });
  }
}

/**
 * マルチエンジン機能が有効だった場合はtrueを返す。
 * 無効だった場合はダイアログを表示してfalseを返す。
 */
function checkMultiEngineEnabled(): boolean {
  const enabled = store.get("experimentalSetting").enableMultiEngine;
  if (!enabled) {
    dialog.showMessageBoxSync(win, {
      type: "info",
      title: "マルチエンジン機能が無効です",
      message: `マルチエンジン機能が無効です。vvppファイルを使用するには設定からマルチエンジン機能を有効にしてください。`,
      buttons: ["OK"],
      noLink: true,
    });
  }
  return enabled;
}

/**
 * VVPPエンジンをアンインストールする。
 * 関数を呼んだタイミングでアンインストール処理を途中まで行い、アプリ終了時に完遂する。
 */
async function uninstallVvppEngine(engineId: EngineId) {
  let engineInfo: EngineInfo | undefined = undefined;
  try {
    engineInfo = engineManager.fetchEngineInfo(engineId);
    if (!engineInfo) {
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);
    }

    if (!vvppManager.canUninstall(engineInfo)) {
      throw new Error(`Cannot uninstall: engineId == ${engineId}`);
    }

    // Windows環境だとエンジンを終了してから削除する必要がある。
    // そのため、アプリの終了時に削除するようにする。
    vvppManager.markWillDelete(engineId);
    return true;
  } catch (e) {
    const engineName = engineInfo?.name ?? engineId;
    dialog.showErrorBox(
      "アンインストールエラー",
      `${engineName} をアンインストールできませんでした。`
    );
    log.error(`Failed to uninstall ${engineId}, ${e}`);
    return false;
  }
}

// 使い方テキストの読み込み
const howToUseText = fs.readFileSync(
  path.join(__static, HowToUseTextFileName),
  "utf-8"
);

// OSSコミュニティ情報の読み込み
const ossCommunityInfos = fs.readFileSync(
  path.join(__static, OssCommunityInfosFileName),
  "utf-8"
);

// 利用規約テキストの読み込み
const policyText = fs.readFileSync(
  path.join(__static, PolicyTextFileName),
  "utf-8"
);

// OSSライセンス情報の読み込み
const ossLicenses = JSON.parse(
  fs.readFileSync(path.join(__static, OssLicensesJsonFileName), {
    encoding: "utf-8",
  })
);

// 問い合わせの読み込み
const contactText = fs.readFileSync(
  path.join(__static, ContactTextFileName),
  "utf-8"
);

// Q&Aの読み込み
const qAndAText = fs.readFileSync(
  path.join(__static, QAndATextFileName),
  "utf-8"
);

// アップデート情報の読み込み
const updateInfos = JSON.parse(
  fs.readFileSync(path.join(__static, UpdateInfosJsonFileName), {
    encoding: "utf-8",
  })
);

const privacyPolicyText = fs.readFileSync(
  path.join(__static, PrivacyPolicyTextFileName),
  "utf-8"
);

// hotkeySettingsのマイグレーション
function migrateHotkeySettings() {
  const COMBINATION_IS_NONE = "####";
  const loadedHotkeys = store.get("hotkeySettings");
  const hotkeysWithoutNewCombination = defaultHotkeySettings.map(
    (defaultHotkey) => {
      const loadedHotkey = loadedHotkeys.find(
        (loadedHotkey) => loadedHotkey.action === defaultHotkey.action
      );
      const hotkeyWithoutCombination: HotkeySetting = {
        action: defaultHotkey.action,
        combination: COMBINATION_IS_NONE,
      };
      return loadedHotkey || hotkeyWithoutCombination;
    }
  );
  const migratedHotkeys = hotkeysWithoutNewCombination.map((hotkey) => {
    if (hotkey.combination === COMBINATION_IS_NONE) {
      const newHotkey =
        defaultHotkeySettings.find(
          (defaultHotkey) => defaultHotkey.action === hotkey.action
        ) || hotkey; // ここの find が undefined を返すケースはないが、ts のエラーになるので入れた
      const combinationExists = hotkeysWithoutNewCombination.some(
        (hotkey) => hotkey.combination === newHotkey.combination
      );
      if (combinationExists) {
        const emptyHotkey = {
          action: newHotkey.action,
          combination: "",
        };
        return emptyHotkey;
      } else {
        return newHotkey;
      }
    } else {
      return hotkey;
    }
  });
  store.set("hotkeySettings", migratedHotkeys);
}
migrateHotkeySettings();

const appState = {
  willQuit: false,
};
let filePathOnMac: string | undefined = undefined;
// create window
async function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
  });

  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    frame: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 6, y: 4 },
    minWidth: 320,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // TODO: 外しても問題ないか検証して外す
    },
    icon: path.join(__static, "icon.png"),
  });

  let projectFilePath = "";
  if (isMac) {
    if (filePathOnMac) {
      if (filePathOnMac.endsWith(".vvproj")) {
        projectFilePath = encodeURI(filePathOnMac);
      }
      filePathOnMac = undefined;
    }
  } else {
    if (process.argv.length >= 2) {
      const filePath = process.argv[1];
      if (
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile() &&
        filePath.endsWith(".vvproj")
      ) {
        projectFilePath = encodeURI(filePath);
      }
    }
  }

  // ソフトウェア起動時はプロトコルを app にする
  if (process.env.VITE_DEV_SERVER_URL == undefined) {
    protocol.handle("app", (request) => {
      const filePath = path.join(__dirname, new URL(request.url).pathname);
      return net.fetch(`file://${filePath}`);
    });
  }

  await loadUrl({ projectFilePath });

  if (isDevelopment && !isTest) win.webContents.openDevTools();

  win.on("maximize", () => win.webContents.send("DETECT_MAXIMIZED"));
  win.on("unmaximize", () => win.webContents.send("DETECT_UNMAXIMIZED"));
  win.on("enter-full-screen", () =>
    win.webContents.send("DETECT_ENTER_FULLSCREEN")
  );
  win.on("leave-full-screen", () =>
    win.webContents.send("DETECT_LEAVE_FULLSCREEN")
  );
  win.on("always-on-top-changed", () => {
    win.webContents.send(
      win.isAlwaysOnTop() ? "DETECT_PINNED" : "DETECT_UNPINNED"
    );
  });
  win.on("close", (event) => {
    if (!appState.willQuit) {
      event.preventDefault();
      ipcMainSend(win, "CHECK_EDITED_AND_NOT_SAVE", {
        closeOrReload: "close",
      });
      return;
    }
  });

  win.on("resize", () => {
    const windowSize = win.getSize();
    win.webContents.send("DETECT_RESIZED", {
      width: windowSize[0],
      height: windowSize[1],
    });
  });

  mainWindowState.manage(win);
}

/**
 * 画面の読み込みを開始する。
 * @param obj.isMultiEngineOffMode マルチエンジンオフモードにするかどうか。無指定時はfalse扱いになる。
 * @param obj.projectFilePath 初期化時に読み込むプロジェクトファイル。無指定時は何も読み込まない。
 * @returns ロードの完了を待つPromise。
 */
async function loadUrl(obj: {
  isMultiEngineOffMode?: boolean;
  projectFilePath?: string;
}) {
  const fragment =
    "#/home" +
    `?isMultiEngineOffMode=${obj?.isMultiEngineOffMode ?? false}` +
    `&projectFilePath=${obj?.projectFilePath ?? ""}`;
  return win.loadURL(`${firstUrl}${fragment}`);
}

// 開始。その他の準備が完了した後に呼ばれる。
async function start() {
  await launchEngines();
  await createWindow();
}

// エンジンの準備と起動
async function launchEngines() {
  // エンジンの追加と削除を反映させるためEngineInfoとAltPortInfoを再生成する。
  engineManager.initializeEngineInfosAndAltPortInfo();
  const engineInfos = engineManager.fetchEngineInfos();
  const engineSettings = store.get("engineSettings");
  for (const engineInfo of engineInfos) {
    if (!engineSettings[engineInfo.uuid]) {
      // 空オブジェクトをパースさせることで、デフォルト値を取得する
      engineSettings[engineInfo.uuid] = engineSettingSchema.parse({});
    }
  }
  store.set("engineSettings", engineSettings);

  await engineManager.runEngineAll();
}

/**
 * エンジンの停止とエンジン終了後処理を行う。
 * 全処理が完了済みの場合 alreadyCompleted を返す。
 * そうでない場合は Promise を返す。
 */
function cleanupEngines(): Promise<void> | "alreadyCompleted" {
  const killingProcessPromises = engineManager.killEngineAll();
  const numLivingEngineProcess = Object.entries(killingProcessPromises).length;

  // 前処理が完了している場合
  if (numLivingEngineProcess === 0 && !vvppManager.hasMarkedEngineDirs()) {
    return "alreadyCompleted";
  }

  let numEngineProcessKilled = 0;

  // 非同期的にすべてのエンジンプロセスをキル
  const waitingKilledPromises: Promise<void>[] = Object.entries(
    killingProcessPromises
  ).map(([engineId, promise]) => {
    return promise
      .catch((error) => {
        // TODO: 各エンジンプロセスキルの失敗をUIに通知する
        log.error(`ENGINE ${engineId}: Error during killing process: ${error}`);
        // エディタを終了するため、エラーが起きてもエンジンプロセスをキルできたとみなす
      })
      .finally(() => {
        numEngineProcessKilled++;
        log.info(
          `ENGINE ${engineId}: Process killed. ${numEngineProcessKilled} / ${numLivingEngineProcess} processes killed`
        );
      });
  });

  // すべてのエンジンプロセスキル処理が完了するまで待機
  return Promise.all(waitingKilledPromises).then(() => {
    // エンジン終了後の処理を実行
    log.info(
      "All ENGINE process kill operations done. Running post engine kill process"
    );
    return vvppManager.handleMarkedEngineDirs();
  });
}

const menuTemplateForMac: Electron.MenuItemConstructorOptions[] = [
  {
    label: "VOICEVOX",
    submenu: [{ role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
];

// For macOS, set the native menu to enable shortcut keys such as 'Cmd + V'.
if (isMac) {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplateForMac));
} else {
  if (!isDevelopment) {
    Menu.setApplicationMenu(null);
  }
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

ipcMainHandle("GET_OSS_COMMUNITY_INFOS", () => {
  return ossCommunityInfos;
});

ipcMainHandle("GET_CONTACT_TEXT", () => {
  return contactText;
});

ipcMainHandle("GET_Q_AND_A_TEXT", () => {
  return qAndAText;
});

ipcMainHandle("GET_PRIVACY_POLICY_TEXT", () => {
  return privacyPolicyText;
});

ipcMainHandle("GET_ALT_PORT_INFOS", () => {
  return engineManager.altPortInfo;
});

ipcMainHandle("SHOW_AUDIO_SAVE_DIALOG", async (_, { title, defaultPath }) => {
  const result = await dialog.showSaveDialog(win, {
    title,
    defaultPath,
    filters: [{ name: "Wave File", extensions: ["wav"] }],
    properties: ["createDirectory"],
  });
  return result.filePath;
});

ipcMainHandle("SHOW_TEXT_SAVE_DIALOG", async (_, { title, defaultPath }) => {
  const result = await dialog.showSaveDialog(win, {
    title,
    defaultPath,
    filters: [{ name: "Text File", extensions: ["txt"] }],
    properties: ["createDirectory"],
  });
  return result.filePath;
});

ipcMainHandle("SHOW_VVPP_OPEN_DIALOG", async (_, { title, defaultPath }) => {
  const result = await dialog.showOpenDialog(win, {
    title,
    defaultPath,
    filters: [
      { name: "VOICEVOX Plugin Package", extensions: ["vvpp", "vvppp"] },
    ],
    properties: ["openFile", "createDirectory", "treatPackageAsDirectory"],
  });
  return result.filePaths[0];
});

ipcMainHandle("SHOW_OPEN_DIRECTORY_DIALOG", async (_, { title }) => {
  const result = await dialog.showOpenDialog(win, {
    title,
    properties: ["openDirectory", "createDirectory", "treatPackageAsDirectory"],
  });
  if (result.canceled) {
    return undefined;
  }
  return result.filePaths[0];
});

ipcMainHandle("SHOW_PROJECT_SAVE_DIALOG", async (_, { title, defaultPath }) => {
  const result = await dialog.showSaveDialog(win, {
    title,
    defaultPath,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["showOverwriteConfirmation"],
  });
  if (result.canceled) {
    return undefined;
  }
  return result.filePath;
});

ipcMainHandle("SHOW_PROJECT_LOAD_DIALOG", async (_, { title }) => {
  const result = await dialog.showOpenDialog(win, {
    title,
    filters: [{ name: "VOICEVOX Project file", extensions: ["vvproj"] }],
    properties: ["openFile", "createDirectory", "treatPackageAsDirectory"],
  });
  if (result.canceled) {
    return undefined;
  }
  return result.filePaths;
});

ipcMainHandle("SHOW_MESSAGE_DIALOG", (_, { type, title, message }) => {
  return dialog.showMessageBox(win, {
    type,
    title,
    message,
  });
});

ipcMainHandle(
  "SHOW_QUESTION_DIALOG",
  (_, { type, title, message, buttons, cancelId, defaultId }) => {
    return dialog
      .showMessageBox(win, {
        type,
        buttons,
        title,
        message,
        noLink: true,
        cancelId,
        defaultId,
      })
      .then((value) => {
        return value.response;
      });
  }
);

ipcMainHandle("SHOW_WARNING_DIALOG", (_, { title, message }) => {
  return dialog.showMessageBox(win, {
    type: "warning",
    title,
    message,
  });
});

ipcMainHandle("SHOW_ERROR_DIALOG", (_, { title, message }) => {
  return dialog.showMessageBox(win, {
    type: "error",
    title,
    message,
  });
});

ipcMainHandle("SHOW_IMPORT_FILE_DIALOG", (_, { title }) => {
  return dialog.showOpenDialogSync(win, {
    title,
    filters: [{ name: "Text", extensions: ["txt"] }],
    properties: ["openFile", "createDirectory", "treatPackageAsDirectory"],
  })?.[0];
});

ipcMainHandle("IS_AVAILABLE_GPU_MODE", () => {
  return hasSupportedGpu(process.platform);
});

ipcMainHandle("IS_MAXIMIZED_WINDOW", () => {
  return win.isMaximized();
});

ipcMainHandle("CLOSE_WINDOW", () => {
  appState.willQuit = true;
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

ipcMainHandle("LOG_WARN", (_, ...params) => {
  log.warn(...params);
});

ipcMainHandle("LOG_INFO", (_, ...params) => {
  log.info(...params);
});

ipcMainHandle("OPEN_LOG_DIRECTORY", () => {
  shell.openPath(app.getPath("logs"));
});

ipcMainHandle("ENGINE_INFOS", () => {
  // エンジン情報を設定ファイルに保存しないためにstoreは使わない
  return engineManager.fetchEngineInfos();
});

/**
 * エンジンを再起動する。
 * エンジンの起動が開始したらresolve、起動が失敗したらreject。
 */
ipcMainHandle("RESTART_ENGINE", async (_, { engineId }) => {
  await engineManager.restartEngine(engineId);
});

ipcMainHandle("OPEN_ENGINE_DIRECTORY", async (_, { engineId }) => {
  openEngineDirectory(engineId);
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

ipcMainHandle("THEME", (_, { newData }) => {
  if (newData !== undefined) {
    store.set("currentTheme", newData);
    return;
  }
  const dir = path.join(__static, "themes");
  const themes: ThemeConf[] = [];
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const theme = JSON.parse(fs.readFileSync(path.join(dir, file)).toString());
    themes.push(theme);
  });
  return { currentTheme: store.get("currentTheme"), availableThemes: themes };
});

ipcMainHandle("ON_VUEX_READY", () => {
  win.show();
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

ipcMainHandle("GET_DEFAULT_HOTKEY_SETTINGS", () => {
  return defaultHotkeySettings;
});

ipcMainHandle("GET_DEFAULT_TOOLBAR_SETTING", () => {
  return defaultToolbarButtonSetting;
});

ipcMainHandle("GET_SETTING", (_, key) => {
  return store.get(key);
});

ipcMainHandle("SET_SETTING", (_, key, newValue) => {
  store.set(key, newValue);
  return store.get(key);
});

ipcMainHandle("SET_ENGINE_SETTING", (_, engineId, engineSetting) => {
  store.set(`engineSettings.${engineId}`, engineSetting);
});

ipcMainHandle("SET_NATIVE_THEME", (_, source) => {
  nativeTheme.themeSource = source;
});

ipcMainHandle("INSTALL_VVPP_ENGINE", async (_, path: string) => {
  return await installVvppEngine(path);
});

ipcMainHandle("UNINSTALL_VVPP_ENGINE", async (_, engineId: EngineId) => {
  return await uninstallVvppEngine(engineId);
});

ipcMainHandle("VALIDATE_ENGINE_DIR", (_, { engineDir }) => {
  return engineManager.validateEngineDir(engineDir);
});

ipcMainHandle("RELOAD_APP", async (_, { isMultiEngineOffMode }) => {
  win.hide(); // FIXME: ダミーページ表示のほうが良い

  // FIXME: 同じようなURLだとスーパーリロードされないことがあるので一度ダミーページを読み込む
  await win.loadURL(firstUrl + "dummypage");

  log.info("Checking ENGINE status before reload app");
  const engineCleanupResult = cleanupEngines();

  // エンジンの停止とエンジン終了後処理の待機
  if (engineCleanupResult != "alreadyCompleted") {
    await engineCleanupResult;
  }
  log.info("Post engine kill process done. Now reloading app");

  await launchEngines();

  await loadUrl({ isMultiEngineOffMode: !!isMultiEngineOffMode });
  win.show();
});

ipcMainHandle("WRITE_FILE", (_, { filePath, buffer }) => {
  try {
    fs.writeFileSync(filePath, new DataView(buffer));
    return success(undefined);
  } catch (e) {
    // throwだと`.code`の情報が消えるのでreturn
    const a = e as SystemError;
    return failure(a.code, a);
  }
});

ipcMainHandle("READ_FILE", async (_, { filePath }) => {
  try {
    const result = await fs.promises.readFile(filePath);
    return success(result);
  } catch (e) {
    // throwだと`.code`の情報が消えるのでreturn
    const a = e as SystemError;
    return failure(a.code, a);
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
  log.info("All windows closed. Quitting app");
  app.quit();
});

// Called before window closing
app.on("before-quit", async (event) => {
  if (!appState.willQuit) {
    event.preventDefault();
    ipcMainSend(win, "CHECK_EDITED_AND_NOT_SAVE", { closeOrReload: "close" });
    return;
  }

  log.info("Checking ENGINE status before app quit");
  const engineCleanupResult = cleanupEngines();

  // エンジンの停止とエンジン終了後処理が完了している
  if (engineCleanupResult == "alreadyCompleted") {
    log.info("Post engine kill process done. Now quit app");
    return;
  }

  // すべてのエンジンプロセスのキルを開始

  // 同期的にbefore-quitイベントをキャンセル
  log.info("Interrupt app quit to kill ENGINE processes");
  event.preventDefault();

  await engineCleanupResult;

  // アプリケーションの終了を再試行する
  log.info("Attempting to quit app again");
  app.quit();
  return;
});

app.once("will-finish-launching", () => {
  // macOS only
  app.once("open-file", (event, filePath) => {
    event.preventDefault();
    filePathOnMac = filePath;
  });
});

app.on("ready", async () => {
  if (isDevelopment && !isTest) {
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e: unknown) {
      if (e instanceof Error) {
        log.error("Vue Devtools failed to install:", e.toString());
      }
    }
  }

  // runEngineAllの前にVVPPを読み込む
  let filePath: string | undefined;
  if (process.platform === "darwin") {
    filePath = filePathOnMac;
  } else {
    if (process.argv.length > 1) {
      filePath = process.argv[1];
    }
  }

  // 多重起動防止
  if (
    !isDevelopment &&
    !isTest &&
    !app.requestSingleInstanceLock({
      filePath,
    } as SingleInstanceLockData)
  ) {
    log.info("VOICEVOX already running. Cancelling launch.");
    log.info(`File path sent: ${filePath}`);
    appState.willQuit = true;
    app.quit();
    return;
  }

  if (filePath && isVvppFile(filePath)) {
    log.info(`vvpp file install: ${filePath}`);
    // FIXME: GUI側に合流させる
    if (checkMultiEngineEnabled()) {
      await installVvppEngineWithWarning({
        vvppPath: filePath,
        reloadNeeded: false,
      });
    }
  }

  start();
});

// 他のプロセスが起動したとき、`requestSingleInstanceLock`経由で`rawData`が送信される。
app.on("second-instance", async (event, argv, workDir, rawData) => {
  const data = rawData as SingleInstanceLockData;
  if (!data.filePath) {
    log.info("No file path sent");
  } else if (isVvppFile(data.filePath)) {
    log.info("Second instance launched with vvpp file");
    // FIXME: GUI側に合流させる
    if (checkMultiEngineEnabled()) {
      await installVvppEngineWithWarning({
        vvppPath: data.filePath,
        reloadNeeded: true,
      });
    }
  } else if (data.filePath.endsWith(".vvproj")) {
    log.info("Second instance launched with vvproj file");
    ipcMainSend(win, "LOAD_PROJECT_FILE", {
      filePath: data.filePath,
      confirm: true,
    });
  }
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        log.info("Received graceful-exit");
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
