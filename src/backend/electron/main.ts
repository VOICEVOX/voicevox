import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { app, dialog, Menu, net, protocol, session, shell } from "electron";
import electronLog from "electron-log/main";
import dayjs from "dayjs";
import { initializeEngineInfoManager } from "./manager/engineInfoManager";
import { initializeEngineProcessManager } from "./manager/engineProcessManager";
import { initializeVvppManager, isVvppFile } from "./manager/vvppManager";
import {
  getMainWindowManager,
  initializeMainWindowManager,
} from "./manager/windowManager/main";
import configMigration014 from "./configMigration014";
import { initializeRuntimeInfoManager } from "./manager/RuntimeInfoManager";
import { getConfigManager } from "./electronConfig";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { getIpcMainHandle } from "./ipcMainHandle";
import { getWelcomeIpcMainHandle } from "./welcomeIpcMainHandle";
import { getAppStateController } from "./appStateController";
import { initializeWelcomeWindowManager } from "./manager/windowManager/welcome";
import { assertNonNullable } from "@/type/utility";
import { EngineInfo } from "@/type/preload";
import { isDevelopment, isMac, isProduction, isTest } from "@/helpers/platform";
import { createLogger } from "@/helpers/log";

type SingleInstanceLockData = {
  filePath: string | undefined;
};

if (isDevelopment) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

let suffix = "";
if (isTest) {
  suffix = "-test";
} else if (isDevelopment) {
  suffix = "-dev";
}
const appName = import.meta.env.VITE_APP_NAME + suffix;
console.log(`Environment: ${import.meta.env.MODE}, appData: ${appName}`);

// バージョン0.14より前の設定ファイルの保存場所
const beforeUserDataDir = app.getPath("userData"); // マイグレーション用

// app.getPath("userData")を呼ぶとディレクトリが作成されてしまうため空なら削除する。
let errorForRemoveBeforeUserDataDir: Error | undefined;
try {
  fs.rmdirSync(beforeUserDataDir, { recursive: false });
} catch (e) {
  const err = e as NodeJS.ErrnoException;
  if (err?.code !== "ENOTEMPTY") {
    // electron-logを初期化してからエラーを出力する
    errorForRemoveBeforeUserDataDir = err;
  }
}

// appnameをvoicevoxとしてsetする
app.setName(appName);

// Electronの設定ファイルの保存場所を変更
const fixedUserDataDir = path.join(app.getPath("appData"), appName);
if (!fs.existsSync(fixedUserDataDir)) {
  fs.mkdirSync(fixedUserDataDir);
}
app.setPath("userData", fixedUserDataDir);
if (!isDevelopment) {
  configMigration014({ fixedUserDataDir, beforeUserDataDir }); // 以前のファイルがあれば持ってくる
}

electronLog.initialize({ preload: false });
// silly以上のログをコンソールに出力
electronLog.transports.console.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
electronLog.transports.console.level = "silly";

// warn以上のログをファイルに出力
const prefix = dayjs().format("YYYYMMDD_HHmmss");
electronLog.transports.file.format = "[{h}:{i}:{s}.{ms}] [{level}] {text}";
electronLog.transports.file.level = "warn";
electronLog.transports.file.fileName = `${prefix}_error.log`;

const log = createLogger("main");

if (errorForRemoveBeforeUserDataDir != undefined) {
  log.error(errorForRemoveBeforeUserDataDir);
}

process.on("uncaughtException", (error) => {
  log.error(error);

  if (isDevelopment) {
    app.exit(1);
  } else {
    const { message, name } = error;
    let detailedMessage = "";
    detailedMessage += `メインプロセスで原因不明のエラーが発生しました。\n`;
    detailedMessage += `エラー名: ${name}\n`;
    detailedMessage += `メッセージ: ${message}\n`;
    if (error.stack) {
      detailedMessage += `スタックトレース: \n${error.stack}`;
    }

    dialog.showErrorBox("エラー", detailedMessage);
  }
});
process.on("unhandledRejection", (reason) => {
  log.error(reason);
});

function getAppPaths() {
  let appDirPath: string;
  let staticDir: string;

  if (isDevelopment) {
    // import.meta.dirnameはdist_electronを指しているので、一つ上のディレクトリに移動する
    appDirPath = path.resolve(import.meta.dirname, "..");
    staticDir = path.join(appDirPath, "public");
  } else {
    appDirPath = path.dirname(app.getPath("exe"));
    staticDir = import.meta.dirname;
  }

  return { appDirPath, staticDir };
}
const { appDirPath, staticDir } = getAppPaths();

// 製品版はカレントディレクトリを.exeのパスにする
// TODO: ディレクトリを移動しないようにしたい
if (!isDevelopment) {
  process.chdir(appDirPath);
}

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, stream: true } },
]);

// ソフトウェア起動時はプロトコルを app にする
void app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    // 読み取り先のファイルがインストールディレクトリ内であることを確認する
    // ref: https://www.electronjs.org/ja/docs/latest/api/protocol#protocolhandlescheme-handler
    const { pathname } = new URL(request.url);
    const pathToServe = path.resolve(path.join(import.meta.dirname, pathname));
    const relativePath = path.relative(import.meta.dirname, pathToServe);
    const isUnsafe =
      path.isAbsolute(relativePath) ||
      relativePath.startsWith("..") ||
      relativePath === "";
    if (isUnsafe) {
      log.error(`Bad Request URL: ${request.url}`);
      return new Response("bad", {
        status: 400,
        headers: { "content-type": "text/html" },
      });
    }
    return net.fetch(pathToFileURL(pathToServe).toString());
  });
});

// 信頼できるオリジン（開発サーバーまたは app プロトコル）からのセッション権限リクエストのみ許可し、それ以外は拒否
void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, { requestingUrl }) => {
      const parsedUrl = new URL(webContents.getURL());
      const parsedRequestingUrl = new URL(requestingUrl);
      let isAllowedResource: boolean;
      if (isDevelopment) {
        assertNonNullable(import.meta.env.VITE_DEV_SERVER_URL);
        const { origin } = new URL(import.meta.env.VITE_DEV_SERVER_URL);
        isAllowedResource =
          parsedUrl.origin === origin && parsedRequestingUrl.origin === origin;
      } else {
        isAllowedResource =
          parsedUrl.protocol === "app:" &&
          parsedRequestingUrl.protocol === "app:";
      }
      return callback(isAllowedResource);
    },
  );
});

// engine
const vvppEngineDir = path.join(app.getPath("userData"), "vvpp-engines");

if (!fs.existsSync(vvppEngineDir)) {
  fs.mkdirSync(vvppEngineDir);
}

const onEngineProcessError = (engineInfo: EngineInfo, error: Error) => {
  const engineId = engineInfo.uuid;
  log.error(`ENGINE ${engineId} ERROR:`, error);

  // winが作られる前にエラーが発生した場合はwinへの通知を諦める
  // FIXME: winが作られた後にエンジンを起動させる
  const win = mainWindowManager.win;
  if (win != undefined) {
    mainWindowManager.ipc.DETECTED_ENGINE_ERROR({ engineId });
  } else {
    log.error(`onEngineProcessError: win is undefined`);
  }

  dialog.showErrorBox("音声合成エンジンエラー", error.message);
};

initializeRuntimeInfoManager({
  runtimeInfoPath: path.join(app.getPath("userData"), "runtime-info.json"),
  appVersion: app.getVersion(),
});
initializeEngineInfoManager({
  defaultEngineDir: appDirPath,
  vvppEngineDir,
});
initializeEngineProcessManager({ onEngineProcessError });
initializeVvppManager({ vvppEngineDir, tmpDir: app.getPath("temp") });

initializeMainWindowManager({
  isDevelopment,
  isTest,
  staticDir: staticDir,
  ipcMainHandle: getIpcMainHandle({
    staticDirPath: staticDir,
    appDirPath,
    initialFilePathGetter: () => initialFilePath,
  }),
});
initializeWelcomeWindowManager({
  isDevelopment,
  isTest,
  staticDir: staticDir,
  ipcMainHandle: getWelcomeIpcMainHandle(),
});

const configManager = getConfigManager();
const appStateController = getAppStateController();
const mainWindowManager = getMainWindowManager();
const engineAndVvppController = getEngineAndVvppController();

/**
 * マルチエンジン機能が有効だった場合はtrueを返す。
 * 無効だった場合はダイアログを表示してfalseを返す。
 */
function checkMultiEngineEnabled(): boolean {
  const enabled = configManager.get("enableMultiEngine");
  if (!enabled) {
    mainWindowManager.showMessageBoxSync({
      type: "info",
      title: "マルチエンジン機能が無効です",
      message: `マルチエンジン機能が無効です。vvppファイルを使用するには設定からマルチエンジン機能を有効にしてください。`,
      buttons: ["OK"],
      noLink: true,
    });
  }
  return enabled;
}

/** コマンドライン引数を取得する */
function getArgv(): string[] {
  // 製品版でmacOS以外の場合、引数はargv[1]以降をそのまま
  if (isProduction) {
    if (!isMac) {
      return process.argv.slice(1);
    }
  }
  // 開発版の場合、引数は`--`がある場合は`--`以降、無い場合は引数なしとして扱う
  else {
    const index = process.argv.indexOf("--");
    if (index !== -1) {
      return process.argv.slice(index + 1);
    }
  }
  return [];
}

let initialFilePath: string | undefined = getArgv()[0]; // TODO: カプセル化する

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

// app callback
app.on("web-contents-created", (_e, contents) => {
  // リンククリック時はブラウザを開く
  contents.setWindowOpenHandler(({ url }) => {
    const { protocol } = new URL(url);
    if (protocol.match(/^https?:/)) {
      void shell.openExternal(url);
    } else {
      log.error(`許可されないリンクです。url: ${url}`);
    }
    return { action: "deny" };
  });

  // ナビゲーションを無効化
  contents.on("will-navigate", (event) => {
    // preloadスクリプト変更時のホットリロードを許容する
    if (contents.getURL() !== event.url) {
      log.error(`ナビゲーションは無効化されています。url: ${event.url}`);
      event.preventDefault();
    }
  });
});

// Called before window closing
app.on("before-quit", async (event) => {
  appStateController.onQuitRequest({
    preventQuit: () => event.preventDefault(),
  });
});

app.once("will-finish-launching", () => {
  // macOS only
  app.once("open-file", (event, filePath) => {
    event.preventDefault();
    initialFilePath = filePath;
  });
});

void app.whenReady().then(async () => {
  await configManager.initialize().catch(async (e) => {
    log.error(e);

    const appExit = async () => {
      await configManager?.ensureSaved();
      app.exit(1);
    };
    const openConfigFolderAndExit = async () => {
      await shell.openPath(app.getPath("userData"));
      // 直後にexitするとフォルダが開かないため
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      await appExit();
    };
    const resetConfig = async () => {
      configManager.reset();
      await configManager.ensureSaved();
    };

    // 実利用時はconfigファイル削除で解決する可能性があることを案内して終了
    if (!isDevelopment) {
      await dialog
        .showMessageBox({
          type: "error",
          title: "設定ファイルの読み込みエラー",
          message: `設定ファイルの読み込みに失敗しました。${app.getPath(
            "userData",
          )} にある config.json の名前を変えることで解決することがあります（ただし設定がすべてリセットされます）。設定ファイルがあるフォルダを開きますか？`,
          buttons: ["いいえ", "はい"],
          noLink: true,
          cancelId: 0,
        })
        .then(async ({ response }) => {
          switch (response) {
            case 0:
              await appExit();
              break;
            case 1:
              await openConfigFolderAndExit();
              break;
            default:
              throw new Error(`Unknown response: ${response}`);
          }
        });
    }

    // 開発時はconfigをリセットして起動を続行するかも問う
    else {
      await dialog
        .showMessageBox({
          type: "error",
          title: "設定ファイルの読み込みエラー（開発者向け案内）",
          message: `設定ファイルの読み込みに失敗しました。設定ファイルの名前を変更するか、設定をリセットしてください。`,
          buttons: [
            "何もせず終了",
            "設定ファイルのフォルダを開いて終了",
            "設定をリセットして続行",
          ],
          noLink: true,
          cancelId: 0,
        })
        .then(async ({ response }) => {
          switch (response) {
            case 0:
              await appExit();
              break;
            case 1:
              await openConfigFolderAndExit();
              break;
            case 2:
              await resetConfig();
              break;
            default:
              throw new Error(`Unknown response: ${response}`);
          }
        });
    }
  });

  // 多重起動防止
  // TODO: readyを待たずにもっと早く実行すべき
  if (
    !isDevelopment &&
    !isTest &&
    !app.requestSingleInstanceLock({
      filePath: initialFilePath,
    } satisfies SingleInstanceLockData)
  ) {
    log.info("VOICEVOX already running. Cancelling launch.");
    log.info(`File path sent: ${initialFilePath}`);
    getAppStateController().shutdown();
    return;
  }

  if (initialFilePath) {
    log.info(`Initial file path provided: ${initialFilePath}`);
    if (isVvppFile(initialFilePath)) {
      log.info(`vvpp file install: ${initialFilePath}`);
      // FIXME: GUI側に合流させる
      if (checkMultiEngineEnabled()) {
        await engineAndVvppController.installVvppEngineWithWarning({
          vvppPath: initialFilePath,
          asDefaultVvppEngine: false,
          reloadNeeded: false,
        });
      }
    }
  }

  await appStateController.startup();
});

// 他のプロセスが起動したとき、`requestSingleInstanceLock`経由で`rawData`が送信される。
app.on("second-instance", async (_event, _argv, _workDir, rawData) => {
  const data = rawData as SingleInstanceLockData;
  const win = mainWindowManager.win;
  if (win == undefined) {
    // TODO: 起動シーケンス中の場合はWindowが作られるまで待つ
    log.warn("A 'second-instance' event was emitted but there is no window.");
    return;
  }
  if (!data.filePath) {
    log.info("No file path sent");
  } else if (isVvppFile(data.filePath)) {
    log.info("Second instance launched with vvpp file");
    // FIXME: GUI側に合流させる
    if (checkMultiEngineEnabled()) {
      await engineAndVvppController.installVvppEngineWithWarning({
        vvppPath: data.filePath,
        asDefaultVvppEngine: false,
        reloadNeeded: true,
        reloadCallback: () => {
          mainWindowManager.ipc.CHECK_EDITED_AND_NOT_SAVE({
            nextAction: "reload",
          });
        },
      });
    }
  } else if (data.filePath.endsWith(".vvproj")) {
    log.info("Second instance launched with vvproj file");
    mainWindowManager.ipc.LOAD_PROJECT_FILE({
      filePath: data.filePath,
    });
  }
  mainWindowManager.restoreAndFocus();
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
