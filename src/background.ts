"use strict";

import { spawn, ChildProcess } from "child_process";
import dotenv from "dotenv";
import treeKill from "tree-kill";
import Store from "electron-store";

import {
  app,
  protocol,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  nativeTheme,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";

import path from "path";
import { textEditContextMenu } from "./electron/contextMenu";
import { hasSupportedGpu } from "./electron/device";
import { ipcMainHandle, ipcMainSend } from "@/electron/ipc";

import fs from "fs";
import {
  DefaultStyleId,
  HotkeySetting,
  SavingSetting,
  PresetConfig,
  ThemeConf,
  ExperimentalSetting,
  AcceptRetrieveTelemetryStatus,
  AcceptTermsStatus,
  ToolbarSetting,
  ActivePointScrollMode,
  EngineInfo,
  SplitTextWhenPasteType,
  SplitterPosition,
  ElectronStoreType,
} from "./type/preload";

import log from "electron-log";
import dayjs from "dayjs";
import windowStateKeeper from "electron-window-state";

// silly以上のログをコンソールに出力
log.transports.console.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.console.level = "silly";

// warn以上のログをファイルに出力
const prefix = dayjs().format("YYYYMMDD_HHmmss");
log.transports.file.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.file.level = "warn";
log.transports.file.fileName = `${prefix}_error.log`;

const isDevelopment = process.env.NODE_ENV !== "production";

if (isDevelopment) {
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), `${app.getName()}-dev`)
  );
}

let win: BrowserWindow;

// 多重起動防止
if (!isDevelopment && !app.requestSingleInstanceLock()) {
  log.info("VOICEVOX already running. Cancelling launch");
  app.quit();
}

process.on("uncaughtException", (error) => {
  log.error(error);
});
process.on("unhandledRejection", (reason) => {
  log.error(reason);
});

// .envから設定をprocess.envに読み込み
const appDirPath = path.dirname(app.getPath("exe"));

// NOTE: 開発版では、カレントディレクトリにある .env ファイルを読み込む。
//       一方、配布パッケージ版では .env ファイルが実行ファイルと同じディレクトリに配置されているが、
//       Linux・macOS ではそのディレクトリはカレントディレクトリとはならないため、.env ファイルの
//       パスを明示的に指定する必要がある。Windows の配布パッケージ版でもこの設定で起動できるため、
//       全 OS で共通の条件分岐とした。
if (isDevelopment) {
  dotenv.config({ override: true });
} else {
  const envPath = path.join(appDirPath, ".env");
  dotenv.config({ path: envPath });
}

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, stream: true } },
]);

const isMac = process.platform === "darwin";

const engineInfos: EngineInfo[] = (() => {
  const defaultEngineInfosEnv = process.env.DEFAULT_ENGINE_INFOS;

  if (defaultEngineInfosEnv) {
    return JSON.parse(defaultEngineInfosEnv) as EngineInfo[];
  }

  return [];
})();

const defaultHotkeySettings: HotkeySetting[] = [
  {
    action: "音声書き出し",
    combination: !isMac ? "Ctrl E" : "Meta E",
  },
  {
    action: "一つだけ書き出し",
    combination: "E",
  },
  {
    action: "音声を繋げて書き出し",
    combination: "",
  },
  {
    action: "再生/停止",
    combination: "Space",
  },
  {
    action: "連続再生/停止",
    combination: "Shift Space",
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
    action: "長さ欄を表示",
    combination: "3",
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
    combination: "Enter",
  },
  {
    action: "元に戻す",
    combination: !isMac ? "Ctrl Z" : "Meta Z",
  },
  {
    action: "やり直す",
    combination: !isMac ? "Ctrl Y" : "Shift Meta Z",
  },
  {
    action: "新規プロジェクト",
    combination: !isMac ? "Ctrl N" : "Meta N",
  },
  {
    action: "プロジェクトを名前を付けて保存",
    combination: !isMac ? "Ctrl Shift S" : "Shift Meta S",
  },
  {
    action: "プロジェクトを上書き保存",
    combination: !isMac ? "Ctrl S" : "Meta S",
  },
  {
    action: "プロジェクト読み込み",
    combination: !isMac ? "Ctrl O" : "Meta O",
  },
  {
    action: "テキスト読み込む",
    combination: "",
  },
  {
    action: "全体のイントネーションをリセット",
    combination: !isMac ? "Ctrl G" : "Meta G",
  },
  {
    action: "選択中のアクセント句のイントネーションをリセット",
    combination: "R",
  },
];

const defaultToolbarButtonSetting: ToolbarSetting = [
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_ONE",
  "EMPTY",
  "UNDO",
  "REDO",
];

// 設定ファイル
const store = new Store<ElectronStoreType>({
  schema: {
    useGpu: {
      type: "boolean",
      default: false,
    },
    inheritAudioInfo: {
      type: "boolean",
      default: true,
    },
    activePointScrollMode: {
      type: "string",
      enum: ["CONTINUOUSLY", "PAGE", "OFF"],
      default: "OFF",
    },
    savingSetting: {
      type: "object",
      properties: {
        fileEncoding: {
          type: "string",
          enum: ["UTF-8", "Shift_JIS"],
          default: "UTF-8",
        },
        fileNamePattern: {
          type: "string",
          default: "",
        },
        fixedExportEnabled: { type: "boolean", default: false },
        avoidOverwrite: { type: "boolean", default: false },
        fixedExportDir: { type: "string", default: "" },
        exportLab: { type: "boolean", default: false },
        exportText: { type: "boolean", default: false },
        outputStereo: { type: "boolean", default: false },
        outputSamplingRate: { type: "number", default: 24000 },
        audioOutputDevice: { type: "string", default: "default" },
      },
      default: {
        fileEncoding: "UTF-8",
        fileNamePattern: "",
        fixedExportEnabled: false,
        avoidOverwrite: false,
        fixedExportDir: "",
        exportLab: false,
        exportText: false,
        outputStereo: false,
        outputSamplingRate: 24000,
        audioOutputDevice: "default",
        splitTextWhenPaste: "PERIOD_AND_NEW_LINE",
      },
    },
    // To future developers: if you are to modify the store schema with array type,
    // for example, the hotkeySettings below,
    // please remember to add a corresponding migration
    // Learn more: https://github.com/sindresorhus/electron-store#migrations
    hotkeySettings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          combination: { type: "string" },
        },
      },
      default: defaultHotkeySettings,
    },
    toolbarSetting: {
      type: "array",
      items: {
        type: "string",
      },
      default: defaultToolbarButtonSetting,
    },
    userCharacterOrder: {
      type: "array",
      items: {
        type: "string",
      },
      default: [],
    },
    defaultStyleIds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speakerUuid: { type: "string" },
          defaultStyleId: { type: "number" },
        },
      },
      default: [],
    },
    presets: {
      type: "object",
      properties: {
        items: {
          type: "object",
          patternProperties: {
            // uuid
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}": {
              type: "object",
              properties: {
                name: { type: "string" },
                speedScale: { type: "number" },
                pitchScale: { type: "number" },
                intonationScale: { type: "number" },
                volumeScale: { type: "number" },
                prePhonemeLength: { type: "number" },
                postPhonemeLength: { type: "number" },
              },
            },
          },
          additionalProperties: false,
        },
        keys: {
          type: "array",
          items: {
            type: "string",
            pattern:
              "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
          },
        },
      },
      default: { items: {}, keys: [] },
    },
    currentTheme: {
      type: "string",
      default: "Default",
    },
    experimentalSetting: {
      type: "object",
      properties: {
        enablePreset: { type: "boolean", default: false },
        enableInterrogativeUpspeak: {
          type: "boolean",
          default: false,
        },
      },
      default: {
        enablePreset: false,
        enableInterrogativeUpspeak: false,
      },
    },
    acceptRetrieveTelemetry: {
      type: "string",
      enum: ["Unconfirmed", "Accepted", "Refused"],
      default: "Unconfirmed",
    },
    acceptTerms: {
      type: "string",
      enum: ["Unconfirmed", "Accepted", "Rejected"],
      default: "Unconfirmed",
    },
    splitTextWhenPaste: {
      type: "string",
      enum: ["PERIOD_AND_NEW_LINE", "NEW_LINE", "OFF"],
      default: "PERIOD_AND_NEW_LINE",
    },
    splitterPosition: {
      type: "object",
      properties: {
        portraitPaneWidth: { type: "number" },
        audioInfoPaneWidth: { type: "number" },
        audioDetailPaneHeight: { type: "number" },
      },
      default: {},
    },
    confirmedTips: {
      type: "object",
      properties: {
        tweakableSliderByScroll: { type: "boolean", default: false },
      },
      default: {
        tweakableSliderByScroll: false,
      },
    },
  },
  migrations: {
    "0.13": (store) => {
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
  },
});

// engine
type EngineProcessContainer = {
  willQuitEngine: boolean;
  engineProcess?: ChildProcess;
};

const engineProcessContainers: Record<string, EngineProcessContainer> = {};

async function runEngineAll() {
  log.info(`Starting ${engineInfos.length} engine/s...`);

  for (const engineInfo of engineInfos) {
    log.info(`ENGINE ${engineInfo.key}: Start launching`);
    await runEngine(engineInfo.key);
  }
}

async function runEngine(engineKey: string) {
  const engineInfo = engineInfos.find(
    (engineInfo) => engineInfo.key === engineKey
  );
  if (!engineInfo)
    throw new Error(`No such engineInfo registered: engineKey == ${engineKey}`);

  if (!engineInfo.executionEnabled) {
    log.info(`ENGINE ${engineKey}: Skipped engineInfo execution: disabled`);
    return;
  }

  if (!engineInfo.executionFilePath) {
    log.info(
      `ENGINE ${engineKey}: Skipped engineInfo execution: empty executionFilePath`
    );
    return;
  }

  log.info(`ENGINE ${engineKey}: Starting process`);

  if (!(engineKey in engineProcessContainers)) {
    engineProcessContainers[engineKey] = {
      willQuitEngine: false,
    };
  }

  const engineProcessContainer = engineProcessContainers[engineKey];
  engineProcessContainer.willQuitEngine = false;

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
  if (!store.has("inheritAudioInfo")) {
    store.set("inheritAudioInfo", true);
  }
  const useGpu = store.get("useGpu");

  log.info(`ENGINE ${engineKey} mode: ${useGpu ? "GPU" : "CPU"}`);

  // エンジンプロセスの起動
  const enginePath = path.resolve(
    appDirPath,
    engineInfo.executionFilePath ?? "run.exe"
  );
  const args = useGpu ? ["--use_gpu"] : [];

  log.info(`ENGINE ${engineKey} path: ${enginePath}`);
  log.info(`ENGINE ${engineKey} args: ${JSON.stringify(args)}`);

  const engineProcess = spawn(enginePath, args, {
    cwd: path.dirname(enginePath),
  });
  engineProcessContainer.engineProcess = engineProcess;

  engineProcess.stdout?.on("data", (data) => {
    log.info(`ENGINE ${engineKey} STDOUT: ${data.toString("utf-8")}`);
  });

  engineProcess.stderr?.on("data", (data) => {
    log.error(`ENGINE ${engineKey} STDERR: ${data.toString("utf-8")}`);
  });

  engineProcess.on("close", (code, signal) => {
    log.info(
      `ENGINE ${engineKey}: Process terminated due to receipt of signal ${signal}`
    );
    log.info(`ENGINE ${engineKey}: Process exited with code ${code}`);

    if (!engineProcessContainer.willQuitEngine) {
      ipcMainSend(win, "DETECTED_ENGINE_ERROR", { engineKey });
      dialog.showErrorBox(
        "音声合成エンジンエラー",
        "音声合成エンジンが異常終了しました。エンジンを再起動してください。"
      );
    }
  });
}

function killEngineAll({
  onFirstKillStart,
  onAllKilled,
  onError,
}: {
  onFirstKillStart?: VoidFunction;
  onAllKilled?: VoidFunction;
  onError?: (engineKey: string, message: unknown) => void;
}) {
  let anyKillStart = false;

  const numEngineProcess = Object.keys(engineProcessContainers).length;
  let numEngineProcessKilled = 0;

  for (const [engineKey] of Object.entries(engineProcessContainers)) {
    killEngine({
      engineKey,
      onKillStart: () => {
        if (!anyKillStart) {
          anyKillStart = true;
          onFirstKillStart?.();
        }
      },
      onKilled: () => {
        numEngineProcessKilled++;
        log.info(
          `ENGINE ${numEngineProcessKilled} / ${numEngineProcess} processes killed`
        );

        if (numEngineProcessKilled === numEngineProcess) {
          onAllKilled?.();
        }
      },
      onError: (message) => {
        onError?.(engineKey, message);

        // エディタを終了するため、エラーが起きてもエンジンプロセスをキルできたとみなして次のエンジンプロセスをキルする
        numEngineProcessKilled++;
        log.info(
          `ENGINE ${engineKey}: process kill errored, but assume to have been killed`
        );
        log.info(
          `ENGINE ${numEngineProcessKilled} / ${numEngineProcess} processes killed`
        );

        if (numEngineProcessKilled === numEngineProcess) {
          onAllKilled?.();
        }
      },
    });
  }
}

function killEngine({
  engineKey,
  onKillStart,
  onKilled,
  onError,
}: {
  engineKey: string;
  onKillStart?: VoidFunction;
  onKilled?: VoidFunction;
  onError?: (error: unknown) => void;
}) {
  // この関数では、呼び出し元に結果を通知するためonKilledまたはonErrorを同期または非同期で必ず呼び出さなければならない

  const engineProcessContainer = engineProcessContainers[engineKey];
  if (!engineProcessContainer) {
    onError?.(`No such engineProcessContainer: key == ${engineKey}`);
    return;
  }

  const engineProcess = engineProcessContainer.engineProcess;
  if (engineProcess == undefined) {
    // nop if no process started (already killed or not started yet)
    log.info(`ENGINE ${engineKey}: Process not started`);
    onKilled?.();
    return;
  }

  // considering the case that ENGINE process killed after checking process status
  engineProcess.once("close", () => {
    log.info(`ENGINE ${engineKey}: Process closed`);
    onKilled?.();
  });

  log.info(
    `ENGINE ${engineKey}: last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode}`
  );

  const engineNotExited = engineProcess.exitCode === null;
  const engineNotKilled = engineProcess.signalCode === null;

  if (engineNotExited && engineNotKilled) {
    log.info(`ENGINE ${engineKey}: Killing process (PID=${engineProcess.pid})`);
    onKillStart?.();

    engineProcessContainer.willQuitEngine = true;
    try {
      engineProcess.pid != undefined && treeKill(engineProcess.pid);
    } catch (error: unknown) {
      log.error(`ENGINE ${engineKey}: Error during killing process`);
      onError?.(error);
    }
  } else {
    log.info(`ENGINE ${engineKey}: Process already closed`);
    onKilled?.();
  }
}

async function restartEngineAll() {
  for (const engineInfo of engineInfos) {
    await restartEngine(engineInfo.key);
  }
}

async function restartEngine(engineKey: string) {
  await new Promise<void>((resolve, reject) => {
    const engineProcessContainer: EngineProcessContainer | undefined =
      engineProcessContainers[engineKey];
    const engineProcess = engineProcessContainer?.engineProcess;

    log.info(
      `ENGINE ${engineKey}: Restarting process (last exit code: ${engineProcess?.exitCode}, signal: ${engineProcess?.signalCode})`
    );

    // エンジンのプロセスがすでに終了している、またはkillされている場合
    const engineExited = engineProcess?.exitCode !== null;
    const engineKilled = engineProcess?.signalCode !== null;

    // engineProcess === undefinedの場合true
    if (engineExited || engineKilled) {
      log.info(
        `ENGINE ${engineKey}: Process is not started yet or already killed. Starting process...`
      );

      runEngine(engineKey);
      resolve();
      return;
    }

    // エンジンエラー時のエラーウィンドウ抑制用。
    engineProcessContainer.willQuitEngine = true;

    // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
    // closeイベントはexitイベントよりも後に発火します。
    const restartEngineOnProcessClosedCallback = () => {
      log.info(`ENGINE ${engineKey}: Process killed. Restarting process...`);

      runEngine(engineKey);
      resolve();
    };
    engineProcess.once("close", restartEngineOnProcessClosedCallback);

    // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
    log.info(
      `ENGINE ${engineKey}: Killing current process (PID=${engineProcess.pid})...`
    );
    treeKill(engineProcess.pid, (error) => {
      // error変数の値がundefined以外であればkillコマンドが失敗したことを意味します。
      if (error != null) {
        log.error(`ENGINE ${engineKey}: Failed to kill process`);
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
  });
}

// temp dir
const tempDir = path.join(app.getPath("temp"), "VOICEVOX");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 使い方テキストの読み込み
declare let __static: string;
const howToUseText = fs.readFileSync(
  path.join(__static, "howtouse.md"),
  "utf-8"
);

// OSSコミュニティ情報の読み込み
const ossCommunityInfos = fs.readFileSync(
  path.join(__static, "ossCommunityInfos.md"),
  "utf-8"
);

// 利用規約テキストの読み込み
const policyText = fs.readFileSync(path.join(__static, "policy.md"), "utf-8");

// OSSライセンス情報の読み込み
const ossLicenses = JSON.parse(
  fs.readFileSync(path.join(__static, "licenses.json"), { encoding: "utf-8" })
);

// 問い合わせの読み込み
const contactText = fs.readFileSync(path.join(__static, "contact.md"), "utf-8");

// Q&Aの読み込み
const qAndAText = fs.readFileSync(path.join(__static, "qAndA.md"), "utf-8");

// アップデート情報の読み込み
const updateInfos = JSON.parse(
  fs.readFileSync(path.join(__static, "updateInfos.json"), {
    encoding: "utf-8",
  })
);

const privacyPolicyText = fs.readFileSync(
  path.join(__static, "privacyPolicy.md"),
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

let willQuit = false;
let filePathOnMac: string | null = null;
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

  // Macではdarkモードかつウィンドウが非アクティブのときに閉じるボタンなどが見えなくなるので、lightモードに固定
  if (isMac) nativeTheme.themeSource = "light";

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
    if (!willQuit) {
      event.preventDefault();
      ipcMainSend(win, "CHECK_EDITED_AND_NOT_SAVE");
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

  win.webContents.once("did-finish-load", () => {
    if (isMac) {
      if (filePathOnMac != null) {
        ipcMainSend(win, "LOAD_PROJECT_FILE", {
          filePath: filePathOnMac,
          confirm: false,
        });
        filePathOnMac = null;
      }
    } else {
      if (process.argv.length >= 2) {
        const filePath = process.argv[1];
        ipcMainSend(win, "LOAD_PROJECT_FILE", { filePath, confirm: false });
      }
    }
  });

  mainWindowState.manage(win);
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

ipcMainHandle("GET_TEMP_DIR", () => {
  return tempDir;
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

ipcMainHandle("SHOW_OPEN_DIRECTORY_DIALOG", async (_, { title }) => {
  const result = await dialog.showOpenDialog(win, {
    title,
    properties: ["openDirectory", "createDirectory"],
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
    properties: ["openFile"],
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
  (_, { type, title, message, buttons, cancelId }) => {
    return dialog
      .showMessageBox(win, {
        type,
        buttons,
        title,
        message,
        noLink: true,
        cancelId,
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
    properties: ["openFile", "createDirectory"],
  })?.[0];
});

ipcMainHandle("OPEN_TEXT_EDIT_CONTEXT_MENU", () => {
  textEditContextMenu.popup({ window: win });
});

ipcMainHandle("IS_AVAILABLE_GPU_MODE", () => {
  return hasSupportedGpu();
});

ipcMainHandle("CLOSE_WINDOW", () => {
  willQuit = true;
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

ipcMainHandle("ENGINE_INFOS", () => {
  // エンジン情報を設定ファイルに保存しないためにstoreではなくグローバル変数を使用する
  return engineInfos;
});

/**
 * エンジンを再起動する。
 * エンジンの起動が開始したらresolve、起動が失敗したらreject。
 */
ipcMainHandle("RESTART_ENGINE_ALL", async () => {
  await restartEngineAll();
});

ipcMainHandle("RESTART_ENGINE", async (_, { engineKey }) => {
  await restartEngine(engineKey);
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

ipcMainHandle("IS_UNSET_DEFAULT_STYLE_ID", (_, speakerUuid) => {
  const defaultStyleIds = store.get("defaultStyleIds");
  return !defaultStyleIds.find((style) => style.speakerUuid === speakerUuid);
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
app.on("before-quit", (event) => {
  if (!willQuit) {
    event.preventDefault();
    ipcMainSend(win, "CHECK_EDITED_AND_NOT_SAVE");
    return;
  }

  let anyKillStart = false;

  log.info("Checking ENGINE status before app quit");
  killEngineAll({
    onFirstKillStart: () => {
      anyKillStart = true;

      // executed synchronously to cancel before-quit event
      log.info("Interrupt app quit to kill ENGINE processes");
      event.preventDefault();
    },
    onAllKilled: () => {
      // executed asynchronously
      if (anyKillStart) {
        log.info("All ENGINE process killed. Quitting app");
        app.quit(); // attempt to quit app again
      }
      // else: before-quit event is not cancelled
    },
    onError: (engineKey, message) => {
      log.error(
        `ENGINE ${engineKey}: Error during killing process: ${message}`
      );
    },
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.once("will-finish-launching", () => {
  // macOS only
  app.once("open-file", (event, filePath) => {
    event.preventDefault();
    filePathOnMac = filePath;
  });
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

  createWindow().then(() => runEngineAll());
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
