import fs from "node:fs";
import path from "node:path";
import { app, nativeTheme, shell } from "electron";
import { hasSupportedGpu } from "./device";
import { getConfigManager } from "./electronConfig";
import { getEngineAndVvppController } from "./engineAndVvppController";
import { writeFileSafely } from "./fileHelper";
import type { IpcMainHandle } from "./ipc";
import { getEngineInfoManager } from "./manager/engineInfoManager";
import { getEngineProcessManager } from "./manager/engineProcessManager";
import { getMainWindowManager } from "./manager/windowManager/main";
import { getAppStateController } from "./appStateController";
import type { IpcIHData } from "./ipcType";
import { AssetTextFileNames } from "@/type/staticResources";
import { failure, success } from "@/type/result";
import {
  defaultToolbarButtonSetting,
  type EngineId,
  type SystemError,
  type TextAsset,
} from "@/type/preload";

// エンジンのフォルダを開く
function openEngineDirectory(engineId: EngineId) {
  const engineDirectory = getEngineInfoManager().fetchEngineDirectory(engineId);

  // Windows環境だとスラッシュ区切りのパスが動かない。
  // path.resolveはWindowsだけバックスラッシュ区切りにしてくれるため、path.resolveを挟む。
  void shell.openPath(path.resolve(engineDirectory));
}

/**
 * 保存に適した場所を選択するかキャンセルするまでダイアログを繰り返し表示する。
 * アンインストール等で消えうる場所などを避ける。
 * @param showDialogFunction ダイアログを表示する関数
 */
async function retryShowSaveDialogWhileSafeDir<
  T extends Electron.OpenDialogReturnValue | Electron.SaveDialogReturnValue,
>(showDialogFunction: () => Promise<T>, appDirPath: string): Promise<T> {
  /**
   * 指定されたパスが安全でないかどうかを判断する
   */
  const isUnsafePath = (filePath: string) => {
    const unsafeSaveDirs = [appDirPath, app.getPath("userData")]; // アンインストールで消えうるフォルダ
    return unsafeSaveDirs.some((unsafeDir) => {
      const relativePath = path.relative(unsafeDir, filePath);
      return !(
        path.isAbsolute(relativePath) ||
        relativePath.startsWith(`..${path.sep}`) ||
        relativePath === ".."
      );
    });
  };

  /**
   * 警告ダイアログを表示し、ユーザーが再試行を選択したかどうかを返す
   */
  const showWarningDialog = async () => {
    const windowManager = getMainWindowManager();
    const productName = app.getName().toUpperCase();
    const warningResult = await windowManager.showMessageBox({
      message: `指定された保存先は${productName}により自動的に削除される可能性があります。\n他の場所に保存することをおすすめします。`,
      type: "warning",
      buttons: ["保存場所を変更", "無視して保存"],
      defaultId: 0,
      title: "警告",
      cancelId: 0,
    });
    return warningResult.response === 0 ? "retry" : "forceSave";
  };

  while (true) {
    const result = await showDialogFunction();
    // キャンセルされた場合、結果を直ちに返す
    if (result.canceled) return result;

    // 選択されたファイルパスを取得
    const filePath =
      "filePaths" in result ? result.filePaths[0] : result.filePath;

    // 選択されたパスが安全かどうかを確認
    if (isUnsafePath(filePath)) {
      const result = await showWarningDialog();
      if (result === "retry") continue; // ユーザーが保存場所を変更を選択した場合
    }
    return result; // 安全なパスが選択された場合
  }
}

export function getIpcMainHandle(params: {
  staticDirPath: string;
  appDirPath: string;
  initialFilePathGetter: () => string | undefined;
}): IpcMainHandle<IpcIHData> {
  const { staticDirPath, appDirPath, initialFilePathGetter } = params;

  const configManager = getConfigManager();
  const appStateController = getAppStateController();
  const engineAndVvppController = getEngineAndVvppController();
  const engineInfoManager = getEngineInfoManager();
  const engineProcessManager = getEngineProcessManager();
  return {
    GET_TEXT_ASSET: async (_, textType) => {
      const fileName = path.join(staticDirPath, AssetTextFileNames[textType]);
      const text = await fs.promises.readFile(fileName, "utf-8");
      if (textType === "OssLicenses" || textType === "UpdateInfos") {
        return JSON.parse(text) as TextAsset[typeof textType];
      }
      return text;
    },

    GET_ALT_PORT_INFOS: () => {
      return engineInfoManager.altPortInfos;
    },

    GET_INITIAL_PROJECT_FILE_PATH: async () => {
      const initialFilePath = initialFilePathGetter();
      if (initialFilePath && initialFilePath.endsWith(".vvproj")) {
        return initialFilePath;
      }
    },

    /**
     * 保存先になるディレクトリを選ぶダイアログを表示する。
     */
    SHOW_SAVE_DIRECTORY_DIALOG: async (_, { title }) => {
      const windowManager = getMainWindowManager();
      const result = await retryShowSaveDialogWhileSafeDir(
        () =>
          windowManager.showOpenDialog({
            title,
            properties: [
              "openDirectory",
              "createDirectory",
              "treatPackageAsDirectory",
            ],
          }),
        appDirPath,
      );
      if (result.canceled) {
        return undefined;
      }
      return result.filePaths[0];
    },

    /**
     * ディレクトリ選択ダイアログを表示する。
     * 保存先として選ぶ場合は SHOW_SAVE_DIRECTORY_DIALOG を使うべき。
     */
    SHOW_OPEN_DIRECTORY_DIALOG: async (_, { title }) => {
      const windowManager = getMainWindowManager();
      const result = await windowManager.showOpenDialog({
        title,
        properties: [
          "openDirectory",
          "createDirectory",
          "treatPackageAsDirectory",
        ],
      });
      if (result.canceled) {
        return undefined;
      }
      return result.filePaths[0];
    },

    SHOW_WARNING_DIALOG: (_, { title, message }) => {
      const windowManager = getMainWindowManager();
      return windowManager.showMessageBox({
        type: "warning",
        title,
        message,
      });
    },

    SHOW_ERROR_DIALOG: (_, { title, message }) => {
      const windowManager = getMainWindowManager();
      return windowManager.showMessageBox({
        type: "error",
        title,
        message,
      });
    },

    SHOW_OPEN_FILE_DIALOG: (_, { title, name, extensions, defaultPath }) => {
      const windowManager = getMainWindowManager();
      return windowManager.showOpenDialogSync({
        title,
        defaultPath,
        filters: [{ name, extensions }],
        properties: ["openFile", "createDirectory", "treatPackageAsDirectory"],
      })?.[0];
    },

    SHOW_SAVE_FILE_DIALOG: async (
      _,
      { title, defaultPath, name, extensions },
    ) => {
      const windowManager = getMainWindowManager();
      const result = await retryShowSaveDialogWhileSafeDir(
        () =>
          windowManager.showSaveDialog({
            title,
            defaultPath,
            filters: [{ name, extensions }],
            properties: ["createDirectory"],
          }),
        appDirPath,
      );
      if (result.canceled) {
        return undefined;
      }
      return result.filePath;
    },

    IS_AVAILABLE_GPU_MODE: () => {
      return hasSupportedGpu(process.platform);
    },

    IS_MAXIMIZED_WINDOW: () => {
      const windowManager = getMainWindowManager();
      return windowManager.isMaximized();
    },

    CLOSE_WINDOW: () => {
      const appStateController = getAppStateController();
      appStateController.shutdown();
    },

    SWITCH_TO_WELCOME_WINDOW: async () => {
      await appStateController.switchToWelcomeWindow();
    },

    MINIMIZE_WINDOW: () => {
      const windowManager = getMainWindowManager();
      windowManager.minimize();
    },

    TOGGLE_MAXIMIZE_WINDOW: () => {
      const windowManager = getMainWindowManager();
      windowManager.toggleMaximizeWindow();
    },

    TOGGLE_FULLSCREEN: () => {
      const windowManager = getMainWindowManager();
      windowManager.toggleFullScreen();
    },

    /** UIの拡大 */
    ZOOM_IN: () => {
      const windowManager = getMainWindowManager();
      windowManager.zoomIn();
    },

    /** UIの縮小 */
    ZOOM_OUT: () => {
      const windowManager = getMainWindowManager();
      windowManager.zoomOut();
    },

    /** UIの拡大率リセット */
    ZOOM_RESET: () => {
      const windowManager = getMainWindowManager();
      windowManager.zoomReset();
    },

    OPEN_LOG_DIRECTORY: () => {
      void shell.openPath(app.getPath("logs"));
    },

    ENGINE_INFOS: () => {
      // エンジン情報を設定ファイルに保存しないためにelectron-storeは使わない
      return engineInfoManager.fetchEngineInfos();
    },

    RESTART_ENGINE: async (_, { engineId }) => {
      return engineProcessManager.restartEngine(engineId);
    },

    OPEN_ENGINE_DIRECTORY: async (_, { engineId }) => {
      openEngineDirectory(engineId);
    },

    HOTKEY_SETTINGS: (_, { newData }) => {
      if (newData != undefined) {
        const hotkeySettings = configManager.get("hotkeySettings");
        const hotkeySetting = hotkeySettings.find(
          (hotkey) => hotkey.action == newData.action,
        );
        if (hotkeySetting != undefined) {
          hotkeySetting.combination = newData.combination;
        }
        configManager.set("hotkeySettings", hotkeySettings);
      }
      return configManager.get("hotkeySettings");
    },

    ON_VUEX_READY: () => {
      const windowManager = getMainWindowManager();
      windowManager.show();
    },

    CHECK_FILE_EXISTS: (_, { file }) => {
      return fs.existsSync(file);
    },

    CHANGE_PIN_WINDOW: () => {
      const windowManager = getMainWindowManager();
      windowManager.togglePinWindow();
    },

    GET_DEFAULT_TOOLBAR_SETTING: () => {
      return defaultToolbarButtonSetting;
    },

    GET_SETTING: (_, key) => {
      return configManager.get(key);
    },

    SET_SETTING: (_, key, newValue) => {
      configManager.set(key, newValue);
      return configManager.get(key);
    },

    SET_ENGINE_SETTING: async (_, engineId, engineSetting) => {
      const engineSettings = configManager.get("engineSettings");
      engineSettings[engineId] = engineSetting;
      configManager.set("engineSettings", engineSettings);
    },

    SET_NATIVE_THEME: (_, source) => {
      nativeTheme.themeSource = source;
    },

    INSTALL_VVPP_ENGINE: async (_, path: string) => {
      await engineAndVvppController.installVvppEngine({
        vvppPath: path,
        asDefaultVvppEngine: false,
        immediate: false,
      });
    },

    UNINSTALL_VVPP_ENGINE: async (_, engineId: EngineId) => {
      await engineAndVvppController.uninstallVvppEngine(engineId);
    },

    VALIDATE_ENGINE_DIR: (_, { engineDir }) => {
      return engineInfoManager.validateEngineDir(engineDir);
    },

    RELOAD_APP: async (_, { isMultiEngineOffMode }) => {
      const windowManager = getMainWindowManager();
      await windowManager.reload(isMultiEngineOffMode);
    },

    WRITE_FILE: (_, { filePath, buffer }) => {
      try {
        writeFileSafely(
          filePath,
          new DataView(buffer instanceof Uint8Array ? buffer.buffer : buffer),
        );
        return success(undefined);
      } catch (e) {
        // throwだと`.code`の情報が消えるのでreturn
        const a = e as SystemError;
        return failure(a.code, a);
      }
    },

    READ_FILE: async (_, { filePath }) => {
      try {
        const result = await fs.promises.readFile(filePath);
        return success(new Uint8Array(result.buffer));
      } catch (e) {
        // throwだと`.code`の情報が消えるのでreturn
        const a = e as SystemError;
        return failure(a.code, a);
      }
    },
  };
}
