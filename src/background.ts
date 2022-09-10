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
  HotkeySetting,
  ThemeConf,
  AcceptTermsStatus,
  ToolbarSetting,
  EngineInfo,
  ElectronStoreType,
} from "./type/preload";

import log from "electron-log";
import dayjs from "dayjs";
import windowStateKeeper from "electron-window-state";

type EngineManifest = {
  name: string;
  uuid: string;
  command: string;
  port: string;
  icon: string;
};

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

function detectImageTypeFromBase64(data: string): string {
  switch (data[0]) {
    case "/":
      return "image/svg+xml";
    case "R":
      return "image/gif";
    case "i":
      return "image/png";
    case "D":
      return "image/jpeg";
    default:
      return "";
  }
}

// EngineInfoからアイコンを読み込む
function replaceEngineInfoIconData(engineInfo: EngineInfo): EngineInfo {
  if (!engineInfo.iconPath) return engineInfo;
  let b64icon;
  try {
    b64icon = fs.readFileSync(path.resolve(appDirPath, engineInfo.iconPath), {
      encoding: "base64",
    });
  } catch (e) {
    log.error("Failed to read icon file: " + engineInfo.iconPath);
    return engineInfo;
  }
  return {
    ...engineInfo,
    iconData: `data:${detectImageTypeFromBase64(b64icon)};base64,${b64icon}`,
  };
}

const defaultEngineInfos: EngineInfo[] = (() => {
  // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
  const defaultEngineInfosEnv = process.env.DEFAULT_ENGINE_INFOS;
  let engines: EngineInfo[] = [];

  if (defaultEngineInfosEnv) {
    engines = JSON.parse(defaultEngineInfosEnv) as EngineInfo[];
  }

  return engines.map(replaceEngineInfoIconData).map((engineInfo) => {
    return {
      ...engineInfo,
      path:
        engineInfo.path === undefined
          ? undefined
          : path.resolve(appDirPath, engineInfo.path),
    };
  });
})();

// ユーザーディレクトリにあるエンジンを取得する
function fetchEngineInfosFromUserDirectory(): EngineInfo[] {
  const userEngineDir = path.join(app.getPath("userData"), "engines");
  if (!fs.existsSync(userEngineDir)) {
    fs.mkdirSync(userEngineDir);
  }

  const engines: EngineInfo[] = [];
  for (const dirName of fs.readdirSync(userEngineDir)) {
    const engineDir = path.join(userEngineDir, dirName);
    if (!fs.statSync(engineDir).isDirectory()) {
      console.log(`${engineDir} is not directory`);
      continue;
    }

    const manifestPath = path.join(engineDir, "engine_manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.log(`${manifestPath} is not found`);
      continue;
    }

    const manifest: EngineManifest = JSON.parse(
      fs.readFileSync(manifestPath, { encoding: "utf8" })
    );

    engines.push({
      uuid: manifest.uuid,
      host: `http://127.0.0.1:${manifest.port}`,
      name: manifest.name,
      iconPath: path.join(engineDir, manifest.icon),
      path: engineDir,
      executionEnabled: true,
      executionFilePath: path.join(engineDir, manifest.command),
    });
  }
  return engines.map(replaceEngineInfoIconData);
}

function fetchEngineInfos(): EngineInfo[] {
  const userEngineInfos = fetchEngineInfosFromUserDirectory();
  return [...defaultEngineInfos, ...userEngineInfos];
}

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
  const engineInfos = fetchEngineInfos();
  log.info(`Starting ${engineInfos.length} engine/s...`);

  for (const engineInfo of engineInfos) {
    log.info(`ENGINE ${engineInfo.uuid}: Start launching`);
    await runEngine(engineInfo.uuid);
  }
}

async function runEngine(engineId: string) {
  const engineInfos = fetchEngineInfos();
  const engineInfo = engineInfos.find(
    (engineInfo) => engineInfo.uuid === engineId
  );
  if (!engineInfo)
    throw new Error(`No such engineInfo registered: engineId == ${engineId}`);

  if (!engineInfo.executionEnabled) {
    log.info(`ENGINE ${engineId}: Skipped engineInfo execution: disabled`);
    return;
  }

  if (!engineInfo.executionFilePath) {
    log.info(
      `ENGINE ${engineId}: Skipped engineInfo execution: empty executionFilePath`
    );
    return;
  }

  log.info(`ENGINE ${engineId}: Starting process`);

  if (!(engineId in engineProcessContainers)) {
    engineProcessContainers[engineId] = {
      willQuitEngine: false,
    };
  }

  const engineProcessContainer = engineProcessContainers[engineId];
  engineProcessContainer.willQuitEngine = false;

  // 最初のエンジンモード
  if (!store.has("useGpu")) {
    const hasGpu = await hasSupportedGpu(process.platform);
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

  log.info(`ENGINE ${engineId} mode: ${useGpu ? "GPU" : "CPU"}`);

  // エンジンプロセスの起動
  const enginePath = path.resolve(
    appDirPath,
    engineInfo.executionFilePath ?? "run.exe"
  );
  const args = useGpu ? ["--use_gpu"] : [];

  log.info(`ENGINE ${engineId} path: ${enginePath}`);
  log.info(`ENGINE ${engineId} args: ${JSON.stringify(args)}`);

  const engineProcess = spawn(enginePath, args, {
    cwd: path.dirname(enginePath),
  });
  engineProcessContainer.engineProcess = engineProcess;

  engineProcess.stdout?.on("data", (data) => {
    log.info(`ENGINE ${engineId} STDOUT: ${data.toString("utf-8")}`);
  });

  engineProcess.stderr?.on("data", (data) => {
    log.error(`ENGINE ${engineId} STDERR: ${data.toString("utf-8")}`);
  });

  engineProcess.on("close", (code, signal) => {
    log.info(
      `ENGINE ${engineId}: Process terminated due to receipt of signal ${signal}`
    );
    log.info(`ENGINE ${engineId}: Process exited with code ${code}`);

    if (!engineProcessContainer.willQuitEngine) {
      ipcMainSend(win, "DETECTED_ENGINE_ERROR", { engineId });
      dialog.showErrorBox(
        "音声合成エンジンエラー",
        "音声合成エンジンが異常終了しました。エンジンを再起動してください。"
      );
    }
  });
}

function killEngineAll(): Record<string, Promise<void>> {
  const killingProcessPromises: Record<string, Promise<void>> = {};

  for (const engineId of Object.keys(engineProcessContainers)) {
    const promise = killEngine(engineId);
    if (promise === undefined) continue;

    killingProcessPromises[engineId] = promise;
  }

  return killingProcessPromises;
}

// Promise<void> | undefined
// Promise.resolve: エンジンプロセスのキルに成功した（非同期）
// Promise.reject: エンジンプロセスのキルに失敗した（非同期）
// undefined: エンジンプロセスのキルが開始されなかった＝エンジンプロセスがすでに停止している（同期）
function killEngine(engineId: string): Promise<void> | undefined {
  const engineProcessContainer = engineProcessContainers[engineId];
  if (!engineProcessContainer) {
    log.error(`No such engineProcessContainer: engineId == ${engineId}`);

    return undefined;
  }

  const engineProcess = engineProcessContainer.engineProcess;
  if (engineProcess === undefined) {
    // nop if no process started (already killed or not started yet)
    log.info(`ENGINE ${engineId}: Process not started`);

    return undefined;
  }

  const engineNotExited = engineProcess.exitCode === null;
  const engineNotKilled = engineProcess.signalCode === null;

  log.info(
    `ENGINE ${engineId}: last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode}`
  );

  const isAlive = engineNotExited && engineNotKilled;
  if (!isAlive) {
    log.info(`ENGINE ${engineId}: Process already closed`);

    return undefined;
  }

  return new Promise<void>((resolve, reject) => {
    log.info(`ENGINE ${engineId}: Killing process (PID=${engineProcess.pid})`);

    // エラーダイアログを抑制
    engineProcessContainer.willQuitEngine = true;

    // プロセス終了時のイベントハンドラ
    engineProcess.once("close", () => {
      log.info(`ENGINE ${engineId}: Process closed`);
      resolve();
    });

    try {
      engineProcess.pid != undefined && treeKill(engineProcess.pid);
    } catch (error: unknown) {
      log.error(`ENGINE ${engineId}: Error during killing process`);
      reject(error);
    }
  });
}

async function restartEngineAll() {
  const engineInfos = fetchEngineInfos();
  for (const engineInfo of engineInfos) {
    await restartEngine(engineInfo.uuid);
  }
}

async function restartEngine(engineId: string) {
  await new Promise<void>((resolve, reject) => {
    const engineProcessContainer: EngineProcessContainer | undefined =
      engineProcessContainers[engineId];
    const engineProcess = engineProcessContainer?.engineProcess;

    log.info(
      `ENGINE ${engineId}: Restarting process (last exit code: ${engineProcess?.exitCode}, signal: ${engineProcess?.signalCode})`
    );

    // エンジンのプロセスがすでに終了している、またはkillされている場合
    const engineExited = engineProcess?.exitCode !== null;
    const engineKilled = engineProcess?.signalCode !== null;

    // engineProcess === undefinedの場合true
    if (engineExited || engineKilled) {
      log.info(
        `ENGINE ${engineId}: Process is not started yet or already killed. Starting process...`
      );

      runEngine(engineId);
      resolve();
      return;
    }

    // エンジンエラー時のエラーウィンドウ抑制用。
    engineProcessContainer.willQuitEngine = true;

    // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
    // closeイベントはexitイベントよりも後に発火します。
    const restartEngineOnProcessClosedCallback = () => {
      log.info(`ENGINE ${engineId}: Process killed. Restarting process...`);

      runEngine(engineId);
      resolve();
    };

    if (engineProcess === undefined) throw Error("engineProcess === undefined");

    engineProcess.once("close", restartEngineOnProcessClosedCallback);

    // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
    log.info(
      `ENGINE ${engineId}: Killing current process (PID=${engineProcess.pid})...`
    );
    treeKill(engineProcess.pid, (error) => {
      // error変数の値がundefined以外であればkillコマンドが失敗したことを意味します。
      if (error != null) {
        log.error(`ENGINE ${engineId}: Failed to kill process`);
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

// エンジンのフォルダを開く
function openEngineDirectory(engineId: string) {
  const engineInfos = fetchEngineInfos();
  const engineInfo = engineInfos.find(
    (engineInfo) => engineInfo.uuid === engineId
  );
  if (!engineInfo) {
    throw new Error(`No such engineInfo registered: engineId == ${engineId}`);
  }

  const engineDirectory = engineInfo.path;
  if (engineDirectory == null) {
    return;
  }

  // Windows環境だとスラッシュ区切りのパスが動かない。
  // path.resolveはWindowsだけバックスラッシュ区切りにしてくれるため、path.resolveを挟む。
  shell.openPath(path.resolve(engineDirectory));
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

  // Macではdarkモードかつウィンドウが非アクティブのときに閉じるボタンなどが見えなくなるので、lightテーマに固定
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
  return hasSupportedGpu(process.platform);
});

ipcMainHandle("CLOSE_WINDOW", () => {
  willQuit = true;
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
  // エンジン情報を設定ファイルに保存しないためにstoreは使わない
  return fetchEngineInfos();
});

/**
 * エンジンを再起動する。
 * エンジンの起動が開始したらresolve、起動が失敗したらreject。
 */
ipcMainHandle("RESTART_ENGINE_ALL", async () => {
  await restartEngineAll();
});

ipcMainHandle("RESTART_ENGINE", async (_, { engineId }) => {
  await restartEngine(engineId);
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

  log.info("Checking ENGINE status before app quit");

  const killingProcessPromises = killEngineAll();
  const numLivingEngineProcess = Object.entries(killingProcessPromises).length;

  // すべてのエンジンプロセスが停止している
  if (numLivingEngineProcess === 0) {
    log.info("All ENGINE processes killed. Now quit app");
    return;
  }

  // すべてのエンジンプロセスのキルを開始

  // 同期的にbefore-quitイベントをキャンセル
  log.info("Interrupt app quit to kill ENGINE processes");
  event.preventDefault();

  let numEngineProcessKilled = 0;

  // 非同期的にすべてのエンジンプロセスをキル
  (async () => {
    const waitingKilledPromises: Array<Promise<void>> = Object.entries(
      killingProcessPromises
    ).map(([engineId, promise]) => {
      return promise
        .catch((error) => {
          // TODO: 各エンジンプロセスキルの失敗をUIに通知する
          log.error(
            `ENGINE ${engineId}: Error during killing process: ${error}`
          );
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
    await Promise.all(waitingKilledPromises);

    // アプリケーションの終了を再試行する
    log.info(
      "All ENGINE process kill operations done. Attempting to quit app again"
    );
    app.quit();
  })();
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
